package browse

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"kangourou/internal/apperr"
	"kangourou/internal/schema"
)

type Options struct {
	StatementTimeout time.Duration
	CountTimeout     time.Duration
}

type countResult struct {
	total    int64
	estimate bool
}

func Fetch(ctx context.Context, pool *pgxpool.Pool, t *schema.Table, req Request, opt Options) (*Result, error) {
	sel, err := BuildSelect(t, req)
	if err != nil {
		return nil, err
	}
	counted := make(chan countResult, 1)
	go func() { counted <- count(ctx, pool, t, req.Filters, opt.CountTimeout) }()

	rows, err := readPage(ctx, pool, t, req.Filters, sel, opt.StatementTimeout)
	if err != nil {
		return nil, err
	}
	c := <-counted

	cols := make([]string, len(t.Columns))
	for i, column := range t.Columns {
		cols[i] = column.Name
	}
	hasMore := len(rows) > PageSize
	if hasMore {
		rows = rows[:PageSize]
	}
	return &Result{
		Columns: cols, Rows: rows, PrimaryKey: t.PrimaryKey,
		Total: c.total, TotalIsEstimate: c.estimate, HasMore: hasMore,
		Page: max(req.Page, 0), PageSize: PageSize,
	}, nil
}

func readPage(ctx context.Context, pool *pgxpool.Pool, t *schema.Table, filters []Filter, sel Query, timeout time.Duration) ([][]*string, error) {
	tx, err := pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(context.Background()) }()

	if _, err := tx.Exec(ctx, fmt.Sprintf("SET LOCAL statement_timeout = %d", timeout.Milliseconds())); err != nil {
		return nil, err
	}
	for _, chk := range CastChecks(t, filters) {
		if _, err := tx.Exec(ctx, chk.SQL, chk.Value); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && strings.HasPrefix(pgErr.Code, "22") {
				return nil, apperr.Validation(chk.Column, pgErr.Message)
			}
			return nil, err
		}
	}

	rows, err := tx.Query(ctx, sel.SQL, sel.Args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	n := len(t.Columns)
	out := [][]*string{}
	for rows.Next() {
		values := make([]*string, n)
		dest := make([]any, n)
		for i := range values {
			dest[i] = &values[i]
		}
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		out = append(out, values)
	}
	return out, rows.Err()
}

// count returns the exact total, or the planner estimate when counting takes longer than timeout.
// A total of -1 means unknown.
func count(ctx context.Context, pool *pgxpool.Pool, t *schema.Table, filters []Filter, timeout time.Duration) countResult {
	q, err := BuildCount(t, filters)
	if err != nil {
		return countResult{total: -1, estimate: true}
	}
	cctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	var n int64
	if err := pool.QueryRow(cctx, q.SQL, q.Args...).Scan(&n); err == nil {
		return countResult{total: n}
	}
	e, _ := BuildExplain(t, filters)
	var raw []byte
	if err := pool.QueryRow(ctx, e.SQL, e.Args...).Scan(&raw); err != nil {
		return countResult{total: -1, estimate: true}
	}
	var plan []struct {
		Plan struct {
			Rows float64 `json:"Plan Rows"`
		} `json:"Plan"`
	}
	if err := json.Unmarshal(raw, &plan); err != nil || len(plan) == 0 {
		return countResult{total: -1, estimate: true}
	}
	return countResult{total: int64(plan[0].Plan.Rows), estimate: true}
}
