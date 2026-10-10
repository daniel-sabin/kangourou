package browse

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"kangourou/internal/apperr"
	"kangourou/internal/schema"
)

func ident(parts ...string) string { return pgx.Identifier(parts).Sanitize() }

func escapeLike(v string) string {
	v = strings.ReplaceAll(v, `\`, `\\`)
	v = strings.ReplaceAll(v, `%`, `\%`)
	return strings.ReplaceAll(v, `_`, `\_`)
}

func needsCast(op string) bool {
	switch op {
	case OpEq, OpNeq, OpLt, OpGt, OpBetween:
		return true
	}
	return false
}

func buildWhere(t *schema.Table, filters []Filter) (string, []any, error) {
	var conds []string
	var args []any
	arg := func(v string) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}
	for _, f := range filters {
		col, ok := t.Column(f.Column)
		if !ok {
			return "", nil, apperr.Validation(f.Column, "Colonne inconnue")
		}
		if !slices.Contains(AllowedOps(col.Category), f.Op) {
			return "", nil, apperr.Validation(col.Name, "Opérateur non supporté pour ce type : "+f.Op)
		}
		if f.Op == OpBetween && f.Value2 == "" {
			return "", nil, apperr.Validation(col.Name, "« entre » nécessite deux valeurs")
		}
		id := ident(col.Name)
		cast := func(v string) string { return "CAST(" + arg(v) + "::text AS " + col.CastType + ")" }
		switch f.Op {
		case OpEq:
			conds = append(conds, id+" = "+cast(f.Value))
		case OpNeq:
			conds = append(conds, id+" <> "+cast(f.Value))
		case OpLt:
			conds = append(conds, id+" < "+cast(f.Value))
		case OpGt:
			conds = append(conds, id+" > "+cast(f.Value))
		case OpBetween:
			conds = append(conds, id+" BETWEEN "+cast(f.Value)+" AND "+cast(f.Value2))
		case OpContains:
			conds = append(conds, id+"::text ILIKE '%' || "+arg(escapeLike(f.Value))+" || '%'")
		case OpStartsWith:
			conds = append(conds, id+"::text ILIKE "+arg(escapeLike(f.Value))+" || '%'")
		case OpIsNull:
			conds = append(conds, id+" IS NULL")
		case OpIsNotNull:
			conds = append(conds, id+" IS NOT NULL")
		case OpIsEmpty:
			conds = append(conds, id+" = ''")
		}
	}
	if len(conds) == 0 {
		return "", nil, nil
	}
	return " WHERE " + strings.Join(conds, " AND "), args, nil
}

func selectExpr(c schema.Column) string {
	id := ident(c.Name)
	if c.CastType == "bytea" {
		return fmt.Sprintf(`CASE WHEN octet_length(%[1]s) > 64 THEN '\x' || encode(substring(%[1]s FROM 1 FOR 64), 'hex') || '… (' || octet_length(%[1]s) || ' bytes)' ELSE %[1]s::text END`, id)
	}
	return id + "::text"
}

// orderBy qualifies columns with the table name: a bare "id" would resolve to the
// "id"::text output column and sort lexicographically.
func orderBy(t *schema.Table, sort *Sort) (string, error) {
	var parts []string
	if sort != nil {
		col, ok := t.Column(sort.Column)
		if !ok {
			return "", apperr.Validation(sort.Column, "Colonne inconnue")
		}
		if !col.Sortable {
			return "", apperr.Validation(col.Name, "Cette colonne ne peut pas être triée")
		}
		dir := "ASC"
		if sort.Desc {
			dir = "DESC"
		}
		parts = append(parts, ident(t.Schema, t.Name, col.Name)+" "+dir)
	}
	for _, pk := range t.PrimaryKey {
		if sort != nil && pk == sort.Column {
			continue
		}
		parts = append(parts, ident(t.Schema, t.Name, pk)+" ASC")
	}
	if len(parts) == 0 {
		return "", nil
	}
	return " ORDER BY " + strings.Join(parts, ", "), nil
}

func BuildSelect(t *schema.Table, req Request) (Query, error) {
	where, args, err := buildWhere(t, req.Filters)
	if err != nil {
		return Query{}, err
	}
	order, err := orderBy(t, req.Sort)
	if err != nil {
		return Query{}, err
	}
	exprs := make([]string, len(t.Columns))
	for i, c := range t.Columns {
		exprs[i] = selectExpr(c)
	}
	page := max(req.Page, 0)
	sql := fmt.Sprintf("SELECT %s FROM %s%s%s LIMIT %d OFFSET %d",
		strings.Join(exprs, ", "), ident(t.Schema, t.Name), where, order, PageSize+1, page*PageSize)
	return Query{SQL: sql, Args: args}, nil
}

func BuildCount(t *schema.Table, filters []Filter) (Query, error) {
	where, args, err := buildWhere(t, filters)
	if err != nil {
		return Query{}, err
	}
	return Query{SQL: "SELECT count(*) FROM " + ident(t.Schema, t.Name) + where, Args: args}, nil
}

func BuildExplain(t *schema.Table, filters []Filter) (Query, error) {
	where, args, err := buildWhere(t, filters)
	if err != nil {
		return Query{}, err
	}
	return Query{SQL: "EXPLAIN (FORMAT JSON) SELECT 1 FROM " + ident(t.Schema, t.Name) + where, Args: args}, nil
}

// CastChecks lists one probe per value that will be cast, so Postgres can validate it before the real query.
func CastChecks(t *schema.Table, filters []Filter) []CastCheck {
	var checks []CastCheck
	for _, f := range filters {
		col, ok := t.Column(f.Column)
		if !ok || !needsCast(f.Op) {
			continue
		}
		sql := "SELECT CAST($1::text AS " + col.CastType + ")"
		checks = append(checks, CastCheck{Column: col.Name, SQL: sql, Value: f.Value})
		if f.Op == OpBetween {
			checks = append(checks, CastCheck{Column: col.Name, SQL: sql, Value: f.Value2})
		}
	}
	return checks
}
