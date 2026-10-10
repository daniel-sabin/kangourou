package sqlexec

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"kangourou/internal/apperr"
	"kangourou/internal/testpg"
)

func TestMain(m *testing.M) { testpg.Main(m) }

func TestExecuteMultipleResults(t *testing.T) {
	pool, _ := testpg.DB(t)
	res, err := Execute(context.Background(), pool, `
		CREATE TABLE t (id int, ok boolean, b bytea);
		INSERT INTO t VALUES (1, true, NULL), (2, false, decode(repeat('ff', 100), 'hex'));
		SELECT id, ok, b FROM t ORDER BY id;`)
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 3 {
		t.Fatalf("results %d", len(res))
	}
	if res[0].HasRows || res[0].CommandTag != "CREATE TABLE" {
		t.Errorf("create: %+v", res[0])
	}
	if res[1].RowsAffected != 2 || !strings.HasPrefix(res[1].CommandTag, "INSERT") {
		t.Errorf("insert: %+v", res[1])
	}
	sel := res[2]
	if !sel.HasRows || len(sel.Rows) != 2 || strings.Join(sel.Columns, ",") != "id,ok,b" {
		t.Fatalf("select: %+v", sel)
	}
	if *sel.Rows[0][1] != "true" || *sel.Rows[1][1] != "false" || sel.Rows[0][2] != nil {
		t.Errorf("bool/null formatting: %v %v %v", *sel.Rows[0][1], *sel.Rows[1][1], sel.Rows[0][2])
	}
	if got := *sel.Rows[1][2]; got != `\x`+strings.Repeat("ff", 64)+"… (100 bytes)" {
		t.Errorf("bytea %q", got)
	}
}

func TestExecuteEmptySelectHasRowsTrue(t *testing.T) {
	pool, _ := testpg.DB(t)
	res, err := Execute(context.Background(), pool, "SELECT 1 AS a WHERE false")
	if err != nil {
		t.Fatal(err)
	}
	if !res[0].HasRows || res[0].Rows == nil || len(res[0].Rows) != 0 {
		t.Fatalf("%+v", res[0])
	}
}

func TestExecuteTruncatesLargeResults(t *testing.T) {
	pool, _ := testpg.DB(t)
	res, err := Execute(context.Background(), pool, "SELECT generate_series(1, 10005)")
	if err != nil {
		t.Fatal(err)
	}
	if len(res[0].Rows) != MaxRows || !res[0].Truncated {
		t.Fatalf("rows %d truncated %v", len(res[0].Rows), res[0].Truncated)
	}
}

func TestExecuteErrorPosition(t *testing.T) {
	pool, _ := testpg.DB(t)
	_, err := Execute(context.Background(), pool, "SELECT * FROM nope")
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "42P01" || pgErr.Position != 15 {
		t.Fatalf("got %v", err)
	}
}

func TestExecuteCancel(t *testing.T) {
	pool, _ := testpg.DB(t)
	ctx, cancel := context.WithCancel(context.Background())
	time.AfterFunc(200*time.Millisecond, cancel)
	start := time.Now()
	_, err := Execute(ctx, pool, "SELECT pg_sleep(10)")
	if err == nil || ctx.Err() == nil || time.Since(start) > 5*time.Second {
		t.Fatalf("err=%v after %v", err, time.Since(start))
	}
	// the pool must still be usable afterwards
	if _, err := Execute(context.Background(), pool, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
}

func TestExecuteRollsBackOpenTransaction(t *testing.T) {
	pool, _ := testpg.DB(t)
	testpg.Exec(t, pool, "CREATE TABLE t (id int)")
	_, err := Execute(context.Background(), pool, "BEGIN; INSERT INTO t VALUES (1);")
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeOpenTransaction {
		t.Fatalf("got %v", err)
	}
	res, _ := Execute(context.Background(), pool, "SELECT count(*) FROM t")
	if *res[0].Rows[0][0] != "0" {
		t.Fatalf("open transaction must be rolled back, count=%s", *res[0].Rows[0][0])
	}
}
