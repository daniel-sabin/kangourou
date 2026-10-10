// Package session keeps one pgx pool per connected connection ID.
package session

import (
	"context"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"

	"kangourou/internal/apperr"
)

type Manager struct {
	mu    sync.RWMutex
	pools map[string]*pgxpool.Pool
}

func NewManager() *Manager { return &Manager{pools: map[string]*pgxpool.Pool{}} }

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

// Open connects and registers the pool under id, closing any previous pool for that id.
func (m *Manager) Open(ctx context.Context, id, dsn string) error {
	pool, err := connect(ctx, dsn)
	if err != nil {
		return err
	}
	m.mu.Lock()
	old := m.pools[id]
	m.pools[id] = pool
	m.mu.Unlock()
	if old != nil {
		old.Close()
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
	m.mu.RLock()
	defer m.mu.RUnlock()
	pool, ok := m.pools[id]
	if !ok {
		return nil, apperr.New(apperr.CodeNotConnected, "Connexion non ouverte")
	}
	return pool, nil
}

func (m *Manager) Close(id string) {
	m.mu.Lock()
	pool := m.pools[id]
	delete(m.pools, id)
	m.mu.Unlock()
	if pool != nil {
		pool.Close()
	}
}

func (m *Manager) CloseAll() {
	m.mu.Lock()
	pools := m.pools
	m.pools = map[string]*pgxpool.Pool{}
	m.mu.Unlock()
	for _, p := range pools {
		p.Close()
	}
}
