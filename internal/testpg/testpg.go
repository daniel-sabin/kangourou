// Package testpg runs one Postgres 16 container per test package and hands each test a fresh database.
package testpg

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
)

type Info struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
}

var (
	admin *pgxpool.Pool
	base  Info
)

// Main must be called from TestMain. Under -short it only runs the tests (DB() then skips).
func Main(m *testing.M) {
	flag.Parse()
	if testing.Short() {
		os.Exit(m.Run())
	}
	ctx := context.Background()
	ctr, err := postgres.Run(ctx, "postgres:16-alpine",
		postgres.WithDatabase("kangourou"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		fmt.Fprintln(os.Stderr, "testpg: start container:", err)
		os.Exit(1)
	}
	host, _ := ctr.Host(ctx)
	port, _ := ctr.MappedPort(ctx, "5432/tcp")
	p, _ := strconv.Atoi(port.Port())
	base = Info{Host: host, Port: p, User: "postgres", Password: "postgres", Database: "kangourou"}
	admin, err = pgxpool.New(ctx, connString(base))
	if err != nil {
		fmt.Fprintln(os.Stderr, "testpg: admin pool:", err)
		os.Exit(1)
	}
	code := m.Run()
	admin.Close()
	_ = testcontainers.TerminateContainer(ctr)
	os.Exit(code)
}

// DB creates a fresh database for the test and drops it at cleanup.
func DB(t *testing.T) (*pgxpool.Pool, Info) {
	t.Helper()
	if testing.Short() {
		t.Skip("integration test skipped in -short mode")
	}
	ctx := context.Background()
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	name := "t_" + hex.EncodeToString(buf)
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	info := base
	info.Database = name
	pool, err := pgxpool.New(ctx, connString(info))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP DATABASE "+name+" WITH (FORCE)")
	})
	return pool, info
}

// Exec runs setup SQL (may contain several statements) and fails the test on error.
func Exec(t *testing.T, pool *pgxpool.Pool, sql string) {
	t.Helper()
	conn, err := pool.Acquire(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Release()
	if _, err := conn.Conn().PgConn().Exec(context.Background(), sql).ReadAll(); err != nil {
		t.Fatalf("setup sql: %v", err)
	}
}

func connString(i Info) string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=disable", i.Host, i.Port, i.User, i.Password, i.Database)
}
