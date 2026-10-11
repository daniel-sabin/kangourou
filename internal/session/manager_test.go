package session

import (
	"context"
	"errors"
	"testing"
	"time"

	"kangourou/internal/apperr"
	"kangourou/internal/testpg"
)

func TestMain(m *testing.M) { testpg.Main(m) }

func params(i testpg.Info) Params {
	return Params{Host: i.Host, Port: i.Port, User: i.User, Password: i.Password, Database: i.Database, SSLMode: "disable"}
}

func TestManagerOpenPoolClose(t *testing.T) {
	_, info := testpg.DB(t)
	m := NewManager()
	defer m.CloseAll()
	ctx := context.Background()

	if err := m.Open(ctx, "c1", DSN(params(info))); err != nil {
		t.Fatal(err)
	}
	pool, err := m.Pool("c1")
	if err != nil {
		t.Fatal(err)
	}
	var one int
	if err := pool.QueryRow(ctx, "SELECT 1").Scan(&one); err != nil || one != 1 {
		t.Fatalf("query: %v %d", err, one)
	}
	m.Close("c1")
	_, err = m.Pool("c1")
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeNotConnected {
		t.Fatalf("expected not_connected, got %v", err)
	}
}

func TestManagerReopenReplacesPool(t *testing.T) {
	_, info := testpg.DB(t)
	m := NewManager()
	defer m.CloseAll()
	ctx := context.Background()
	_ = m.Open(ctx, "c1", DSN(params(info)))
	first, _ := m.Pool("c1")
	if err := m.Open(ctx, "c1", DSN(params(info))); err != nil {
		t.Fatal(err)
	}
	second, _ := m.Pool("c1")
	if first == second {
		t.Fatal("reopen must create a new pool")
	}
	// the old pool is closed in the background
	deadline := time.Now().Add(2 * time.Second)
	for first.Ping(ctx) == nil {
		if time.Now().After(deadline) {
			t.Fatal("old pool must be closed")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestManagerWrongPassword(t *testing.T) {
	_, info := testpg.DB(t)
	p := params(info)
	p.Password = "wrong"
	m := NewManager()
	if err := m.Test(context.Background(), DSN(p)); err == nil {
		t.Fatal("expected auth error")
	}
	if err := m.Open(context.Background(), "c1", DSN(p)); err == nil {
		t.Fatal("expected auth error")
	}
	if _, err := m.Pool("c1"); err == nil {
		t.Fatal("failed open must not register a pool")
	}
}
