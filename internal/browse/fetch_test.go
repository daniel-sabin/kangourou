package browse

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"kangourou/internal/apperr"
	"kangourou/internal/schema"
	"kangourou/internal/testpg"
)

func TestMain(m *testing.M) { testpg.Main(m) }

const fetchFixture = `
CREATE TYPE mood AS ENUM ('happy', 'sad');
CREATE TABLE people (
  id int PRIMARY KEY, name text, mood mood, active boolean, born date,
  amount numeric(30,10), avatar bytea, ext_id uuid
);
INSERT INTO people
SELECT i, 'person ' || i, CASE WHEN i % 2 = 0 THEN 'happy' ELSE 'sad' END::mood, i % 3 = 0,
       date '2000-01-01' + i, 12345678901234567890.0123456789, NULL, NULL
FROM generate_series(1, 250) i;
UPDATE people SET name = '50% off_sale\x', avatar = decode(repeat('ab', 100), 'hex'),
       ext_id = '6f1c1b1e-0000-4000-8000-000000000001' WHERE id = 7;
UPDATE people SET name = NULL WHERE id = 8;
CREATE TABLE "Order Items" ("we""ird" int PRIMARY KEY, "Label" text);
INSERT INTO "Order Items" VALUES (1, 'a'), (2, 'b');
CREATE VIEW slow AS SELECT pg_sleep(1)::text AS x;
`

var defaultOpts = Options{StatementTimeout: 30 * time.Second, CountTimeout: 2 * time.Second}

func setup(t *testing.T) (*pgxpool.Pool, *schema.Schema) {
	pool, _ := testpg.DB(t)
	testpg.Exec(t, pool, fetchFixture)
	s, err := schema.Load(context.Background(), pool)
	if err != nil {
		t.Fatal(err)
	}
	return pool, s
}

func fetch(t *testing.T, pool *pgxpool.Pool, s *schema.Schema, table string, req Request, opt Options) (*Result, error) {
	t.Helper()
	tb, ok := s.Table("public", table)
	if !ok {
		t.Fatalf("no table %s", table)
	}
	req.Schema, req.Table = "public", table
	return Fetch(context.Background(), pool, tb, req, opt)
}

func col(r *Result, row int, name string) *string {
	for i, c := range r.Columns {
		if c == name {
			return r.Rows[row][i]
		}
	}
	panic("no column " + name)
}

func TestFetchFirstPage(t *testing.T) {
	pool, s := setup(t)
	r, err := fetch(t, pool, s, "people", Request{}, defaultOpts)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Rows) != PageSize || !r.HasMore || r.Total != 250 || r.TotalIsEstimate || r.PageSize != PageSize {
		t.Fatalf("rows=%d hasMore=%v total=%d est=%v", len(r.Rows), r.HasMore, r.Total, r.TotalIsEstimate)
	}
	if *col(r, 0, "id") != "1" || r.PrimaryKey[0] != "id" {
		t.Fatalf("first row id %s", *col(r, 0, "id"))
	}
}

func TestFetchSecondPage(t *testing.T) {
	pool, s := setup(t)
	r, _ := fetch(t, pool, s, "people", Request{Page: 1}, defaultOpts)
	if len(r.Rows) != 50 || r.HasMore || *col(r, 0, "id") != "201" {
		t.Fatalf("rows=%d hasMore=%v", len(r.Rows), r.HasMore)
	}
}

func TestFetchValueSerialization(t *testing.T) {
	pool, s := setup(t)
	r, _ := fetch(t, pool, s, "people", Request{Filters: []Filter{{Column: "id", Op: OpBetween, Value: "6", Value2: "8"}}}, defaultOpts)
	if len(r.Rows) != 3 {
		t.Fatalf("rows %d", len(r.Rows))
	}
	if *col(r, 0, "active") != "true" || *col(r, 1, "active") != "false" {
		t.Errorf("booleans %s %s", *col(r, 0, "active"), *col(r, 1, "active"))
	}
	if *col(r, 1, "amount") != "12345678901234567890.0123456789" {
		t.Errorf("numeric precision lost: %s", *col(r, 1, "amount"))
	}
	if got := *col(r, 1, "avatar"); got != `\x`+repeat("ab", 64)+"… (100 bytes)" {
		t.Errorf("bytea %q", got)
	}
	if *col(r, 1, "ext_id") != "6f1c1b1e-0000-4000-8000-000000000001" {
		t.Errorf("uuid %v", col(r, 1, "ext_id"))
	}
	if col(r, 2, "name") != nil {
		t.Errorf("NULL must be nil")
	}
}

func repeat(s string, n int) string {
	out := ""
	for range n {
		out += s
	}
	return out
}

func TestFetchFiltersByType(t *testing.T) {
	pool, s := setup(t)
	cases := []struct {
		f    Filter
		want int64
	}{
		{Filter{Column: "mood", Op: OpEq, Value: "happy"}, 125},
		{Filter{Column: "active", Op: OpEq, Value: "true"}, 83},
		{Filter{Column: "born", Op: OpLt, Value: "2000-01-06"}, 4},
		{Filter{Column: "ext_id", Op: OpEq, Value: "6f1c1b1e-0000-4000-8000-000000000001"}, 1},
		{Filter{Column: "name", Op: OpIsNull}, 1},
		{Filter{Column: "name", Op: OpStartsWith, Value: "PERSON 1"}, 111},
	}
	for _, c := range cases {
		r, err := fetch(t, pool, s, "people", Request{Filters: []Filter{c.f}}, defaultOpts)
		if err != nil {
			t.Fatalf("%+v: %v", c.f, err)
		}
		if r.Total != c.want {
			t.Errorf("%+v: total %d want %d", c.f, r.Total, c.want)
		}
	}
}

func TestFetchContainsEscapesLikeMetacharacters(t *testing.T) {
	pool, s := setup(t)
	for _, v := range []string{"50%", "off_sale", `sale\x`} {
		r, err := fetch(t, pool, s, "people", Request{Filters: []Filter{{Column: "name", Op: OpContains, Value: v}}}, defaultOpts)
		if err != nil {
			t.Fatal(err)
		}
		if r.Total != 1 || *col(r, 0, "id") != "7" {
			t.Errorf("contains %q matched %d rows", v, r.Total)
		}
	}
}

func TestFetchInvalidFilterValueIsValidationError(t *testing.T) {
	pool, s := setup(t)
	_, err := fetch(t, pool, s, "people", Request{Filters: []Filter{{Column: "born", Op: OpEq, Value: "not a date"}}}, defaultOpts)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeValidation || ae.Column != "born" {
		t.Fatalf("got %v", err)
	}
}

func TestFetchSortDesc(t *testing.T) {
	pool, s := setup(t)
	r, _ := fetch(t, pool, s, "people", Request{Sort: &Sort{Column: "id", Desc: true}}, defaultOpts)
	if *col(r, 0, "id") != "250" {
		t.Fatalf("first %s", *col(r, 0, "id"))
	}
}

func TestFetchWeirdIdentifiers(t *testing.T) {
	pool, s := setup(t)
	r, err := fetch(t, pool, s, "Order Items", Request{
		Filters: []Filter{{Column: `we"ird`, Op: OpEq, Value: "2"}},
		Sort:    &Sort{Column: "Label"},
	}, defaultOpts)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Rows) != 1 || *col(r, 0, "Label") != "b" {
		t.Fatalf("rows %+v", r.Rows)
	}
}

func TestFetchCountFallsBackToEstimate(t *testing.T) {
	pool, s := setup(t)
	opts := defaultOpts
	opts.CountTimeout = time.Nanosecond
	r, err := fetch(t, pool, s, "people", Request{}, opts)
	if err != nil {
		t.Fatal(err)
	}
	if !r.TotalIsEstimate || r.Total <= 0 {
		t.Fatalf("total=%d estimate=%v", r.Total, r.TotalIsEstimate)
	}
}

func TestFetchStatementTimeout(t *testing.T) {
	pool, s := setup(t)
	_, err := fetch(t, pool, s, "slow", Request{}, Options{StatementTimeout: 100 * time.Millisecond, CountTimeout: 50 * time.Millisecond})
	var ae *apperr.Error
	if !errors.As(apperr.From(err), &ae) || ae.Code != apperr.CodeTimeout {
		t.Fatalf("got %v", err)
	}
}
