package browse

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"kangourou/internal/apperr"
	"kangourou/internal/schema"
)

func usersTable() *schema.Table {
	return &schema.Table{
		Schema: "public", Name: "users", Kind: "table",
		PrimaryKey: []string{"id"},
		Columns: []schema.Column{
			{Name: "id", CastType: "bigint", Category: schema.CategoryNumber, Sortable: true},
			{Name: "Email", CastType: "text", Category: schema.CategoryText, Sortable: true},
			{Name: "created_at", CastType: "timestamp with time zone", Category: schema.CategoryTemporal, Sortable: true},
			{Name: "active", CastType: "boolean", Category: schema.CategoryBoolean, Sortable: true},
			{Name: "raw", CastType: "json", Category: schema.CategoryJSON, Sortable: false},
			{Name: "avatar", CastType: "bytea", Category: schema.CategoryOther, Sortable: true},
		},
	}
}

func validationColumn(t *testing.T, err error) string {
	t.Helper()
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeValidation {
		t.Fatalf("expected validation error, got %v", err)
	}
	return ae.Column
}

func TestBuildSelectNoFilter(t *testing.T) {
	q, err := BuildSelect(usersTable(), Request{Schema: "public", Table: "users", Page: 2})
	if err != nil {
		t.Fatal(err)
	}
	want := `SELECT "id"::text, "Email"::text, "created_at"::text, "active"::text, "raw"::text, ` +
		`CASE WHEN octet_length("avatar") > 64 THEN '\x' || encode(substring("avatar" FROM 1 FOR 64), 'hex') || '… (' || octet_length("avatar") || ' bytes)' ELSE "avatar"::text END` +
		` FROM "public"."users" ORDER BY "public"."users"."id" ASC LIMIT 201 OFFSET 400`
	if q.SQL != want {
		t.Fatalf("sql:\n%s\nwant:\n%s", q.SQL, want)
	}
	if len(q.Args) != 0 {
		t.Fatalf("args %v", q.Args)
	}
}

func TestBuildWhereOperators(t *testing.T) {
	cases := []struct {
		f        Filter
		cond     string
		wantArgs []any
	}{
		{Filter{Column: "id", Op: OpEq, Value: "42"}, `"id" = CAST($1::text AS bigint)`, []any{"42"}},
		{Filter{Column: "id", Op: OpNeq, Value: "4"}, `"id" <> CAST($1::text AS bigint)`, []any{"4"}},
		{Filter{Column: "id", Op: OpLt, Value: "4"}, `"id" < CAST($1::text AS bigint)`, []any{"4"}},
		{Filter{Column: "id", Op: OpGt, Value: "4"}, `"id" > CAST($1::text AS bigint)`, []any{"4"}},
		{Filter{Column: "created_at", Op: OpBetween, Value: "2026-01-01", Value2: "2026-02-01"},
			`"created_at" BETWEEN CAST($1::text AS timestamp with time zone) AND CAST($2::text AS timestamp with time zone)`, []any{"2026-01-01", "2026-02-01"}},
		{Filter{Column: "Email", Op: OpContains, Value: "bob"}, `"Email"::text ILIKE '%' || $1 || '%'`, []any{"bob"}},
		{Filter{Column: "Email", Op: OpStartsWith, Value: "bob"}, `"Email"::text ILIKE $1 || '%'`, []any{"bob"}},
		{Filter{Column: "Email", Op: OpIsEmpty}, `"Email" = ''`, nil},
		{Filter{Column: "Email", Op: OpIsNull}, `"Email" IS NULL`, nil},
		{Filter{Column: "Email", Op: OpIsNotNull}, `"Email" IS NOT NULL`, nil},
		{Filter{Column: "active", Op: OpEq, Value: "true"}, `"active" = CAST($1::text AS boolean)`, []any{"true"}},
		{Filter{Column: "raw", Op: OpContains, Value: "x"}, `"raw"::text ILIKE '%' || $1 || '%'`, []any{"x"}},
	}
	for _, c := range cases {
		q, err := BuildCount(usersTable(), []Filter{c.f})
		if err != nil {
			t.Fatalf("%+v: %v", c.f, err)
		}
		want := `SELECT count(*) FROM "public"."users" WHERE ` + c.cond
		if q.SQL != want {
			t.Errorf("%s:\n got %s\nwant %s", c.f.Op, q.SQL, want)
		}
		if !reflect.DeepEqual(q.Args, c.wantArgs) && !(len(q.Args) == 0 && len(c.wantArgs) == 0) {
			t.Errorf("%s args %v want %v", c.f.Op, q.Args, c.wantArgs)
		}
	}
}

func TestBuildWhereCombinesWithAndAndNumbersArgs(t *testing.T) {
	q, err := BuildCount(usersTable(), []Filter{
		{Column: "Email", Op: OpContains, Value: "a"},
		{Column: "id", Op: OpGt, Value: "10"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(q.SQL, `WHERE "Email"::text ILIKE '%' || $1 || '%' AND "id" > CAST($2::text AS bigint)`) {
		t.Fatalf("got %s", q.SQL)
	}
}

func TestBuildWhereContainsEscapes(t *testing.T) {
	q, _ := BuildCount(usersTable(), []Filter{{Column: "Email", Op: OpContains, Value: `50%_a\b`}})
	if q.Args[0] != `50\%\_a\\b` {
		t.Fatalf("escaped arg %q", q.Args[0])
	}
	q, _ = BuildCount(usersTable(), []Filter{{Column: "Email", Op: OpStartsWith, Value: `a_`}})
	if q.Args[0] != `a\_` {
		t.Fatalf("escaped arg %q", q.Args[0])
	}
}

func TestBuildRejectsUnknownColumnAndBadOp(t *testing.T) {
	_, err := BuildCount(usersTable(), []Filter{{Column: `id"; DROP TABLE users; --`, Op: OpEq, Value: "1"}})
	if c := validationColumn(t, err); c != `id"; DROP TABLE users; --` {
		t.Fatalf("column %q", c)
	}
	_, err = BuildCount(usersTable(), []Filter{{Column: "raw", Op: OpEq, Value: "{}"}})
	if c := validationColumn(t, err); c != "raw" {
		t.Fatalf("column %q", c)
	}
	_, err = BuildCount(usersTable(), []Filter{{Column: "created_at", Op: OpBetween, Value: "2026-01-01"}})
	if c := validationColumn(t, err); c != "created_at" {
		t.Fatalf("between without value2: column %q", c)
	}
}

func TestBuildSelectSort(t *testing.T) {
	q, err := BuildSelect(usersTable(), Request{Sort: &Sort{Column: "Email", Desc: true}})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(q.SQL, `ORDER BY "public"."users"."Email" DESC, "public"."users"."id" ASC LIMIT 201 OFFSET 0`) {
		t.Fatalf("got %s", q.SQL)
	}
	_, err = BuildSelect(usersTable(), Request{Sort: &Sort{Column: "raw"}})
	validationColumn(t, err)
	_, err = BuildSelect(usersTable(), Request{Sort: &Sort{Column: "nope"}})
	validationColumn(t, err)
}

func TestBuildSelectWithoutPrimaryKeyOrdersByPhysicalRow(t *testing.T) {
	tb := usersTable()
	tb.PrimaryKey = nil
	q, _ := BuildSelect(tb, Request{Page: -3})
	if !strings.HasSuffix(q.SQL, `ORDER BY "public"."users"."tableoid" ASC, "public"."users"."ctid" ASC LIMIT 201 OFFSET 0`) {
		t.Fatalf("got %s", q.SQL)
	}
	q, _ = BuildSelect(tb, Request{Sort: &Sort{Column: "Email"}})
	if !strings.Contains(q.SQL, `ORDER BY "public"."users"."Email" ASC, "public"."users"."tableoid" ASC, "public"."users"."ctid" ASC LIMIT`) {
		t.Fatalf("sorted without pk: %s", q.SQL)
	}
}

func TestBuildSelectViewOrdersBySortableColumns(t *testing.T) {
	tb := usersTable()
	tb.PrimaryKey = nil
	tb.Kind = "view"
	q, _ := BuildSelect(tb, Request{Sort: &Sort{Column: "Email", Desc: true}})
	want := `ORDER BY "public"."users"."Email" DESC, "public"."users"."id" ASC, "public"."users"."created_at" ASC, "public"."users"."active" ASC, "public"."users"."avatar" ASC LIMIT`
	if !strings.Contains(q.SQL, want) {
		t.Fatalf("got %s", q.SQL)
	}
}

func TestBuildExplainAndCastChecks(t *testing.T) {
	filters := []Filter{
		{Column: "id", Op: OpEq, Value: "abc"},
		{Column: "Email", Op: OpContains, Value: "x"},
		{Column: "created_at", Op: OpBetween, Value: "a", Value2: "b"},
	}
	q, err := BuildExplain(usersTable(), filters)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(q.SQL, `EXPLAIN (FORMAT JSON) SELECT 1 FROM "public"."users" WHERE `) {
		t.Fatalf("got %s", q.SQL)
	}
	checks := CastChecks(usersTable(), filters)
	want := []CastCheck{
		{Column: "id", SQL: "SELECT CAST($1::text AS bigint)", Value: "abc"},
		{Column: "created_at", SQL: "SELECT CAST($1::text AS timestamp with time zone)", Value: "a"},
		{Column: "created_at", SQL: "SELECT CAST($1::text AS timestamp with time zone)", Value: "b"},
	}
	if !reflect.DeepEqual(checks, want) {
		t.Fatalf("checks %+v", checks)
	}
}

func TestAllowedOps(t *testing.T) {
	if !reflect.DeepEqual(AllowedOps(schema.CategoryEnum), []string{OpEq, OpIsNull, OpIsNotNull}) {
		t.Fatalf("enum ops %v", AllowedOps(schema.CategoryEnum))
	}
	if len(AllowedOps("nonsense")) != 0 {
		t.Fatal("unknown category must allow nothing")
	}
}
