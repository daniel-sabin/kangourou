// Package sqlexec runs free SQL typed in the editor using the simple protocol (multi-statement, text results).
package sqlexec

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"kangourou/internal/apperr"
)

const MaxRows = 10000

type Result struct {
	Columns      []string    `json:"columns"`
	Rows         [][]*string `json:"rows"`
	CommandTag   string      `json:"commandTag"`
	RowsAffected int64       `json:"rowsAffected"`
	HasRows      bool        `json:"hasRows"`
	Truncated    bool        `json:"truncated"`
}

func Execute(ctx context.Context, pool *pgxpool.Pool, sql string) ([]Result, error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Release()
	pgConn := conn.Conn().PgConn()
	defer reset(conn) // runs before Release
	results, err := run(ctx, pgConn, sql)
	if err != nil {
		return nil, err
	}
	if pgConn.TxStatus() != 'I' {
		return nil, apperr.New(apperr.CodeOpenTransaction,
			"Transaction laissée ouverte : elle a été annulée. Exécutez BEGIN … COMMIT en une seule fois.")
	}
	return results, nil
}

// reset puts the connection back to a clean session before it returns to the pool, so SET,
// temp tables or a dangling transaction from the editor never leak into browsing or other runs.
// A connection that cannot be reset is closed (the pool then drops it).
func reset(conn *pgxpool.Conn) {
	pgConn := conn.Conn().PgConn()
	if pgConn.IsClosed() {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if pgConn.TxStatus() != 'I' {
		if _, err := pgConn.Exec(ctx, "ROLLBACK").ReadAll(); err != nil {
			_ = conn.Conn().Close(ctx)
			return
		}
	}
	if _, err := pgConn.Exec(ctx, "DISCARD ALL").ReadAll(); err != nil {
		_ = conn.Conn().Close(ctx)
	}
}

func run(ctx context.Context, pgConn *pgconn.PgConn, sql string) ([]Result, error) {
	results := []Result{}
	mrr := pgConn.Exec(ctx, sql)
	for mrr.NextResult() {
		rr := mrr.ResultReader()
		fds := rr.FieldDescriptions()
		res := Result{HasRows: len(fds) > 0}
		if res.HasRows {
			res.Rows = [][]*string{}
			for _, fd := range fds {
				res.Columns = append(res.Columns, fd.Name)
			}
		}
		for rr.NextRow() {
			if len(res.Rows) >= MaxRows {
				res.Truncated = true
				continue
			}
			vals := rr.Values()
			row := make([]*string, len(vals))
			for i, v := range vals {
				if v != nil {
					s := formatValue(fds[i].DataTypeOID, v)
					row[i] = &s
				}
			}
			res.Rows = append(res.Rows, row)
		}
		tag, err := rr.Close()
		if err != nil {
			_ = mrr.Close()
			return nil, err
		}
		res.CommandTag = tag.String()
		res.RowsAffected = tag.RowsAffected()
		results = append(results, res)
	}
	if err := mrr.Close(); err != nil {
		return nil, err
	}
	return results, nil
}

func formatValue(oid uint32, v []byte) string {
	switch oid {
	case pgtype.BoolOID:
		if string(v) == "t" {
			return "true"
		}
		return "false"
	case pgtype.ByteaOID:
		// text format is \x followed by two hex chars per byte
		if len(v) > 2+128 {
			return string(v[:130]) + fmt.Sprintf("… (%d bytes)", (len(v)-2)/2)
		}
	}
	return string(v)
}
