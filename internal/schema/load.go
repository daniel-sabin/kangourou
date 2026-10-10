package schema

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

const excludedNamespaces = `n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'`

const columnsSQL = `
SELECT n.nspname::text, c.relname::text, c.relkind::text,
       a.attname::text,
       format_type(a.atttypid, a.atttypmod),
       -- format_type(bpchar, NULL) yields "character" = char(1), which would truncate filter values
       CASE WHEN a.atttypid = 'bpchar'::regtype THEN 'bpchar' ELSE format_type(a.atttypid, NULL) END,
       bt.typname::text,
       bt.typcategory::text,
       NOT a.attnotnull,
       CASE WHEN bt.typtype = 'e'
            THEN array(SELECT e.enumlabel::text FROM pg_enum e WHERE e.enumtypid = bt.oid ORDER BY e.enumsortorder)
       END
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_type bt ON bt.oid = CASE WHEN t.typtype = 'd' THEN t.typbasetype ELSE t.oid END
WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
  AND NOT c.relispartition
  AND ` + excludedNamespaces + `
ORDER BY n.nspname, c.relname, a.attnum`

const keysSQL = `
SELECT con.contype::text, con.conname::text,
       n.nspname::text, c.relname::text,
       array(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum ORDER BY k.ord),
       COALESCE(tn.nspname::text, ''), COALESCE(tc.relname::text, ''),
       array(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.attnum ORDER BY k.ord)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_class tc ON tc.oid = con.confrelid
LEFT JOIN pg_namespace tn ON tn.oid = tc.relnamespace
WHERE con.contype IN ('p', 'f') AND con.conparentid = 0 AND ` + excludedNamespaces + `
ORDER BY con.conname`

func Load(ctx context.Context, q Querier) (*Schema, error) {
	s := &Schema{Tables: []Table{}}
	index := map[string]int{}
	key := func(schema, name string) string { return schema + "\x00" + name }

	rows, err := q.Query(ctx, columnsSQL)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var (
			nsp, rel, relkind                            string
			attname, typ, castType, typname, typcategory *string
			nullable                                     *bool
			enumValues                                   []string
		)
		if err := rows.Scan(&nsp, &rel, &relkind, &attname, &typ, &castType, &typname, &typcategory, &nullable, &enumValues); err != nil {
			rows.Close()
			return nil, err
		}
		i, ok := index[key(nsp, rel)]
		if !ok {
			s.Tables = append(s.Tables, Table{Schema: nsp, Name: rel, Kind: kind(relkind), Columns: []Column{}, ForeignKeys: []ForeignKey{}, ReferencedBy: []ForeignKey{}})
			i = len(s.Tables) - 1
			index[key(nsp, rel)] = i
		}
		if attname == nil {
			continue
		}
		s.Tables[i].Columns = append(s.Tables[i].Columns, Column{
			Name: *attname, Type: *typ, CastType: *castType,
			Category: category(*typname, *typcategory), Nullable: *nullable,
			Sortable: sortable(*typname), EnumValues: enumValues,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	rows, err = q.Query(ctx, keysSQL)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var contype, name, nsp, rel, toNsp, toRel string
		var fromCols, toCols []string
		if err := rows.Scan(&contype, &name, &nsp, &rel, &fromCols, &toNsp, &toRel, &toCols); err != nil {
			return nil, err
		}
		from, ok := index[key(nsp, rel)]
		if !ok {
			continue
		}
		if contype == "p" {
			s.Tables[from].PrimaryKey = fromCols
			continue
		}
		to, ok := index[key(toNsp, toRel)]
		if !ok {
			continue
		}
		fk := ForeignKey{Name: name, FromSchema: nsp, FromTable: rel, FromColumns: fromCols, ToSchema: toNsp, ToTable: toRel, ToColumns: toCols}
		s.Tables[from].ForeignKeys = append(s.Tables[from].ForeignKeys, fk)
		s.Tables[to].ReferencedBy = append(s.Tables[to].ReferencedBy, fk)
	}
	return s, rows.Err()
}
