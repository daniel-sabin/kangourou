package schema

import (
	"context"
	"slices"
	"testing"

	"kangourou/internal/testpg"
)

func TestMain(m *testing.M) { testpg.Main(m) }

const fixture = `
CREATE TYPE mood AS ENUM ('happy', 'sad');
CREATE DOMAIN email AS text;
CREATE TABLE users (
  id bigserial PRIMARY KEY,
  mail email NOT NULL,
  name varchar(50),
  code char(3),
  mood mood,
  active boolean,
  created_at timestamptz,
  profile jsonb,
  raw json,
  ext_id uuid
);
CREATE TABLE orders (id serial PRIMARY KEY, user_id bigint REFERENCES users(id), total numeric(10,2));
CREATE TABLE order_items (order_id int REFERENCES orders(id), line_no int, PRIMARY KEY (order_id, line_no));
CREATE TABLE shipments (id int PRIMARY KEY, order_id int, line_no int,
  CONSTRAINT shipments_item_fk FOREIGN KEY (line_no, order_id) REFERENCES order_items(line_no, order_id));
CREATE SCHEMA billing;
CREATE TABLE billing.invoices (id int PRIMARY KEY, order_id int REFERENCES public.orders(id));
CREATE TABLE logs (msg text);
CREATE VIEW active_users AS SELECT id, mail FROM users WHERE active;
CREATE TABLE "Order Items" ("we""ird" int);
CREATE TABLE events (id int, at date NOT NULL) PARTITION BY RANGE (at);
CREATE TABLE events_2026 PARTITION OF events FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
`

func load(t *testing.T) *Schema {
	pool, _ := testpg.DB(t)
	testpg.Exec(t, pool, fixture)
	s, err := Load(context.Background(), pool)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func mustTable(t *testing.T, s *Schema, schema, name string) *Table {
	t.Helper()
	tb, ok := s.Table(schema, name)
	if !ok {
		t.Fatalf("table %s.%s missing", schema, name)
	}
	return tb
}

func TestLoadTablesAndKinds(t *testing.T) {
	s := load(t)
	if tb := mustTable(t, s, "public", "active_users"); tb.Kind != "view" {
		t.Errorf("view kind = %s", tb.Kind)
	}
	if tb := mustTable(t, s, "public", "events"); tb.Kind != "table" {
		t.Errorf("partitioned kind = %s", tb.Kind)
	}
	if _, ok := s.Table("public", "events_2026"); ok {
		t.Error("partitions must be hidden")
	}
	mustTable(t, s, "public", "Order Items")
	for _, tb := range s.Tables {
		if tb.Schema == "pg_catalog" || tb.Schema == "information_schema" {
			t.Fatalf("system table leaked: %s.%s", tb.Schema, tb.Name)
		}
	}
}

func TestLoadColumns(t *testing.T) {
	users := mustTable(t, load(t), "public", "users")
	want := map[string]struct {
		typ, cast, cat     string
		nullable, sortable bool
	}{
		"id":         {"bigint", "bigint", CategoryNumber, false, true},
		"mail":       {"email", "email", CategoryText, false, true},
		"name":       {"character varying(50)", "character varying", CategoryText, true, true},
		"code":       {"character(3)", "bpchar", CategoryText, true, true},
		"mood":       {"mood", "mood", CategoryEnum, true, true},
		"active":     {"boolean", "boolean", CategoryBoolean, true, true},
		"created_at": {"timestamp with time zone", "timestamp with time zone", CategoryTemporal, true, true},
		"profile":    {"jsonb", "jsonb", CategoryJSON, true, true},
		"raw":        {"json", "json", CategoryJSON, true, false},
		"ext_id":     {"uuid", "uuid", CategoryOther, true, true},
	}
	if len(users.Columns) != len(want) || users.Columns[0].Name != "id" || users.Columns[9].Name != "ext_id" {
		t.Fatalf("columns not in attnum order: %+v", users.Columns)
	}
	for name, w := range want {
		c, ok := users.Column(name)
		if !ok {
			t.Fatalf("column %s missing", name)
		}
		if c.Type != w.typ || c.CastType != w.cast || c.Category != w.cat || c.Nullable != w.nullable || c.Sortable != w.sortable {
			t.Errorf("%s: got %+v want %+v", name, *c, w)
		}
	}
	mood, _ := users.Column("mood")
	if !slices.Equal(mood.EnumValues, []string{"happy", "sad"}) {
		t.Errorf("enum values %v", mood.EnumValues)
	}
}

func TestLoadPrimaryKeys(t *testing.T) {
	s := load(t)
	if pk := mustTable(t, s, "public", "order_items").PrimaryKey; !slices.Equal(pk, []string{"order_id", "line_no"}) {
		t.Errorf("composite pk %v", pk)
	}
	if pk := mustTable(t, s, "public", "logs").PrimaryKey; pk != nil {
		t.Errorf("logs pk must be nil, got %v", pk)
	}
}

func TestLoadForeignKeys(t *testing.T) {
	s := load(t)
	ship := mustTable(t, s, "public", "shipments")
	if len(ship.ForeignKeys) != 1 {
		t.Fatalf("shipments fks %+v", ship.ForeignKeys)
	}
	fk := ship.ForeignKeys[0]
	if fk.Name != "shipments_item_fk" || fk.ToTable != "order_items" ||
		!slices.Equal(fk.FromColumns, []string{"line_no", "order_id"}) ||
		!slices.Equal(fk.ToColumns, []string{"line_no", "order_id"}) {
		t.Errorf("composite fk %+v", fk)
	}

	orders := mustTable(t, s, "public", "orders")
	var refs []string
	for _, r := range orders.ReferencedBy {
		refs = append(refs, r.FromSchema+"."+r.FromTable+"."+r.FromColumns[0])
	}
	slices.Sort(refs)
	if !slices.Equal(refs, []string{"billing.invoices.order_id", "public.order_items.order_id"}) {
		t.Errorf("orders referenced by %v", refs)
	}
	if logs := mustTable(t, s, "public", "logs"); logs.ForeignKeys == nil || logs.ReferencedBy == nil {
		t.Error("fk slices must be non-nil")
	}
}
