// Package session keeps one pgx pool per connected connection ID.
package session

import (
	"context"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"

	"kangourou/internal/apperr"
)

// entry pairs a pool with a context that is canceled when the pool is closed or replaced,
// so in-flight work on it stops instead of holding the pool open.
type entry struct {
	pool   *pgxpool.Pool
	ctx    context.Context
	cancel context.CancelFunc
}

type Manager struct {
	mu      sync.RWMutex
	entries map[string]entry
}

func NewManager() *Manager { return &Manager{entries: map[string]entry{}} }

func connect(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// release cancels in-flight work and closes the pool in the background:
// pgxpool.Close waits for every borrowed connection, which can take as long as a dead socket.
func release(e entry) {
	e.cancel()
	go e.pool.Close()
}

// Open connects and registers the pool under id, releasing any previous pool for that id.
func (m *Manager) Open(ctx context.Context, id, dsn string) error {
	pool, err := connect(ctx, dsn)
	if err != nil {
		return err
	}
	sctx, cancel := context.WithCancel(context.Background())
	m.mu.Lock()
	old, had := m.entries[id]
	m.entries[id] = entry{pool: pool, ctx: sctx, cancel: cancel}
	m.mu.Unlock()
	if had {
		release(old)
	}
	return nil
}

// Test connects and disconnects without registering anything.
func (m *Manager) Test(ctx context.Context, dsn string) error {
	pool, err := connect(ctx, dsn)
	if err != nil {
		return err
	}
	pool.Close()
	return nil
}

func (m *Manager) Pool(id string) (*pgxpool.Pool, error) {
	pool, _, err := m.Session(id)
	return pool, err
}

// Session returns the pool and a context canceled when that pool is closed or replaced.
func (m *Manager) Session(id string) (*pgxpool.Pool, context.Context, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	e, ok := m.entries[id]
	if !ok {
		return nil, nil, apperr.New(apperr.CodeNotConnected, "Connexion non ouverte")
	}
	return e.pool, e.ctx, nil
}

func (m *Manager) Close(id string) {
	m.mu.Lock()
	e, ok := m.entries[id]
	delete(m.entries, id)
	m.mu.Unlock()
	if ok {
		release(e)
	}
}

func (m *Manager) CloseAll() {
	m.mu.Lock()
	entries := m.entries
	m.entries = map[string]entry{}
	m.mu.Unlock()
	for _, e := range entries {
		release(e)
	}
}
