package api

import (
	"context"
	"sync"
	"time"

	"kangourou/internal/apperr"
	"kangourou/internal/browse"
	"kangourou/internal/connections"
	"kangourou/internal/session"
)

type BrowseService struct {
	sessions *session.Manager
	schemas  *SchemaService
	store    *connections.Store
	mu       sync.Mutex
	running  map[string]context.CancelFunc
}

func NewBrowseService(sessions *session.Manager, schemas *SchemaService, store *connections.Store) *BrowseService {
	return &BrowseService{sessions: sessions, schemas: schemas, store: store, running: map[string]context.CancelFunc{}}
}

// FetchRows runs one page request; requestID lets the frontend cancel it once superseded.
func (s *BrowseService) FetchRows(connID, requestID string, req browse.Request) (*browse.Result, error) {
	pool, sessionCtx, err := s.sessions.Session(connID)
	if err != nil {
		return nil, apperr.FromSession(err)
	}
	t, err := s.schemas.table(connID, req.Schema, req.Table)
	if err != nil {
		return nil, err
	}
	cfg, err := s.store.Get(connID)
	if err != nil {
		return nil, apperr.FromSession(err)
	}
	timeout := time.Duration(cfg.WithDefaults().StatementTimeoutSeconds) * time.Second
	ctx, cancel := context.WithTimeout(sessionCtx, timeout+5*time.Second)
	s.mu.Lock()
	s.running[requestID] = cancel
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.running, requestID)
		s.mu.Unlock()
		cancel()
	}()

	res, err := browse.Fetch(ctx, pool, t, req, browse.Options{StatementTimeout: timeout, CountTimeout: 2 * time.Second})
	if err != nil {
		if ctx.Err() == context.Canceled {
			return nil, apperr.New(apperr.CodeCanceled, "Requête annulée")
		}
		return nil, apperr.FromSession(err)
	}
	return res, nil
}

func (s *BrowseService) CancelFetch(requestID string) {
	s.mu.Lock()
	cancel := s.running[requestID]
	s.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}
