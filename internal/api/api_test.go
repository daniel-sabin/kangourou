package api

import (
	"context"
	"errors"
	"io"
	"net"
	"path/filepath"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/zalando/go-keyring"

	"kangourou/internal/apperr"
	"kangourou/internal/browse"
	"kangourou/internal/connections"
	"kangourou/internal/session"
	"kangourou/internal/testpg"
)

func TestMain(m *testing.M) { testpg.Main(m) }

type services struct {
	conn   *ConnectionService
	schema *SchemaService
	browse *BrowseService
	query  *QueryService
}

func newServices(t *testing.T) services {
	keyring.MockInit()
	sessions := session.NewManager()
	t.Cleanup(sessions.CloseAll)
	store := connections.NewStore(filepath.Join(t.TempDir(), "connections.json"))
	schemas := NewSchemaService(sessions)
	return services{
		conn:   NewConnectionService(store, connections.Keyring{}, sessions, schemas),
		schema: schemas,
		browse: NewBrowseService(sessions, schemas, store),
		query:  NewQueryService(sessions),
	}
}

func saveInput(info testpg.Info) SaveInput {
	return SaveInput{
		Config:          connections.Config{Name: "test", Host: info.Host, Port: info.Port, User: info.User, Database: info.Database, SSLMode: "disable"},
		Password:        info.Password,
		PasswordChanged: true,
	}
}

func errCode(err error) string {
	var ae *apperr.Error
	if errors.As(err, &ae) {
		return ae.Code
	}
	return ""
}

func TestEndToEnd(t *testing.T) {
	pool, info := testpg.DB(t)
	testpg.Exec(t, pool, `CREATE TABLE users (id int PRIMARY KEY, name text);
		CREATE TABLE orders (id int PRIMARY KEY, user_id int REFERENCES users(id));
		INSERT INTO users VALUES (1, 'ann'), (2, 'bob'); INSERT INTO orders VALUES (10, 2);`)
	s := newServices(t)

	if err := s.conn.Test(saveInput(info)); err != nil {
		t.Fatalf("test: %v", err)
	}
	cfg, err := s.conn.Save(saveInput(info))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.browse.FetchRows(cfg.ID, "r", browse.Request{Schema: "public", Table: "users"}); errCode(err) != apperr.CodeNotConnected {
		t.Fatalf("expected not_connected, got %v", err)
	}
	if err := s.conn.Connect(cfg.ID); err != nil {
		t.Fatalf("connect: %v", err)
	}
	sch, err := s.schema.GetSchema(cfg.ID)
	if err != nil {
		t.Fatal(err)
	}
	orders, _ := sch.Table("public", "orders")
	if len(orders.ForeignKeys) != 1 {
		t.Fatalf("fks %+v", orders.ForeignKeys)
	}
	res, err := s.browse.FetchRows(cfg.ID, "r", browse.Request{Schema: "public", Table: "users",
		Filters: []browse.Filter{{Column: "id", Op: browse.OpEq, Value: "2"}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Rows) != 1 || *res.Rows[0][1] != "bob" {
		t.Fatalf("rows %+v", res.Rows)
	}
	if _, err := s.browse.FetchRows(cfg.ID, "r", browse.Request{Schema: "public", Table: "nope"}); errCode(err) != apperr.CodeNotFound {
		t.Fatalf("expected not_found, got %v", err)
	}
	qres, err := s.query.Execute(cfg.ID, "q1", "SELECT count(*) FROM orders")
	if err != nil || *qres[0].Rows[0][0] != "1" {
		t.Fatalf("execute %v %v", qres, err)
	}
	if _, err := s.query.Execute(cfg.ID, "q2", "SELECT * FROM nope"); errCode(err) != "42P01" {
		t.Fatalf("expected 42P01, got %v", err)
	}
}

func TestPasswordKeptWhenUnchanged(t *testing.T) {
	_, info := testpg.DB(t)
	s := newServices(t)
	cfg, _ := s.conn.Save(saveInput(info))
	edit := SaveInput{Config: cfg, Password: "", PasswordChanged: false}
	edit.Config.Name = "renamed"
	if _, err := s.conn.Save(edit); err != nil {
		t.Fatal(err)
	}
	if err := s.conn.Test(edit); err != nil {
		t.Fatalf("stored password must be used: %v", err)
	}
	if err := s.conn.Connect(cfg.ID); err != nil {
		t.Fatalf("connect with stored password: %v", err)
	}
}

func TestWrongPasswordIsConnectFailed(t *testing.T) {
	_, info := testpg.DB(t)
	s := newServices(t)
	in := saveInput(info)
	in.Password = "wrong"
	if code := errCode(s.conn.Test(in)); code != apperr.CodeConnectFailed {
		t.Fatalf("got %s", code)
	}
}

func TestQueryCancel(t *testing.T) {
	_, info := testpg.DB(t)
	s := newServices(t)
	cfg, _ := s.conn.Save(saveInput(info))
	_ = s.conn.Connect(cfg.ID)
	time.AfterFunc(200*time.Millisecond, func() { s.query.Cancel("slow") })
	_, err := s.query.Execute(cfg.ID, "slow", "SELECT pg_sleep(10)")
	if errCode(err) != apperr.CodeCanceled {
		t.Fatalf("got %v", err)
	}
}

func TestBrowseAfterBackendTerminated(t *testing.T) {
	pool, info := testpg.DB(t)
	testpg.Exec(t, pool, "CREATE TABLE users (id int PRIMARY KEY)")
	s := newServices(t)
	cfg, _ := s.conn.Save(saveInput(info))
	_ = s.conn.Connect(cfg.ID)
	req := browse.Request{Schema: "public", Table: "users"}
	if _, err := s.browse.FetchRows(cfg.ID, "r", req); err != nil {
		t.Fatal(err)
	}
	_, err := pool.Exec(context.Background(),
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'kangourou' AND datname = current_database()")
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.browse.FetchRows(cfg.ID, "r", req)
	if err != nil && errCode(err) != apperr.CodeConnectionLost {
		t.Fatalf("a dead pooled connection must surface as connection_lost, got %v", err)
	}
	if err := s.conn.Connect(cfg.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.browse.FetchRows(cfg.ID, "r", req); err != nil {
		t.Fatalf("after reconnect: %v", err)
	}
}

// tcpProxy forwards a local port to target; stop() closes the listener and every live connection,
// which looks to the client like the server went away.
func tcpProxy(t *testing.T, target string) (addr string, stop func()) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var conns []net.Conn
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			up, err := net.Dial("tcp", target)
			if err != nil {
				c.Close()
				continue
			}
			mu.Lock()
			conns = append(conns, c, up)
			mu.Unlock()
			go func() { _, _ = io.Copy(up, c); up.Close() }()
			go func() { _, _ = io.Copy(c, up); c.Close() }()
		}
	}()
	stop = func() {
		ln.Close()
		mu.Lock()
		defer mu.Unlock()
		for _, c := range conns {
			c.Close()
		}
	}
	t.Cleanup(stop)
	return ln.Addr().String(), stop
}

func TestBrowseWhenServerUnreachableIsConnectionLost(t *testing.T) {
	pool, info := testpg.DB(t)
	testpg.Exec(t, pool, "CREATE TABLE users (id int PRIMARY KEY)")
	addr, stop := tcpProxy(t, net.JoinHostPort(info.Host, strconv.Itoa(info.Port)))
	host, port, _ := net.SplitHostPort(addr)
	p, _ := strconv.Atoi(port)
	proxied := info
	proxied.Host, proxied.Port = host, p

	s := newServices(t)
	cfg, _ := s.conn.Save(saveInput(proxied))
	if err := s.conn.Connect(cfg.ID); err != nil {
		t.Fatal(err)
	}
	req := browse.Request{Schema: "public", Table: "users"}
	if _, err := s.browse.FetchRows(cfg.ID, "r", req); err != nil {
		t.Fatal(err)
	}
	stop()
	_, err := s.browse.FetchRows(cfg.ID, "r", req)
	if errCode(err) != apperr.CodeConnectionLost {
		t.Fatalf("expected connection_lost, got %v", err)
	}
	if _, err := s.query.Execute(cfg.ID, "q", "SELECT 1"); errCode(err) != apperr.CodeConnectionLost {
		t.Fatalf("query: expected connection_lost, got %v", err)
	}
}

func TestDisconnectDoesNotWaitForRunningQuery(t *testing.T) {
	_, info := testpg.DB(t)
	s := newServices(t)
	cfg, _ := s.conn.Save(saveInput(info))
	_ = s.conn.Connect(cfg.ID)
	done := make(chan error, 1)
	go func() {
		_, err := s.query.Execute(cfg.ID, "long", "SELECT pg_sleep(10)")
		done <- err
	}()
	time.Sleep(300 * time.Millisecond)
	start := time.Now()
	_ = s.conn.Disconnect(cfg.ID)
	if d := time.Since(start); d > time.Second {
		t.Fatalf("Disconnect blocked %v", d)
	}
	select {
	case err := <-done:
		if errCode(err) != apperr.CodeCanceled {
			t.Fatalf("running query must be canceled, got %v", err)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("running query was not interrupted")
	}
}

func TestCancelFetch(t *testing.T) {
	pool, info := testpg.DB(t)
	testpg.Exec(t, pool, "CREATE VIEW slow AS SELECT pg_sleep(10)::text AS x")
	s := newServices(t)
	cfg, _ := s.conn.Save(saveInput(info))
	_ = s.conn.Connect(cfg.ID)
	time.AfterFunc(300*time.Millisecond, func() { s.browse.CancelFetch("r1") })
	start := time.Now()
	_, err := s.browse.FetchRows(cfg.ID, "r1", browse.Request{Schema: "public", Table: "slow"})
	if errCode(err) != apperr.CodeCanceled || time.Since(start) > 3*time.Second {
		t.Fatalf("got %v after %v", err, time.Since(start))
	}
}
