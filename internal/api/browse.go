package api

import (
	"context"
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
}

func NewBrowseService(sessions *session.Manager, schemas *SchemaService, store *connections.Store) *BrowseService {
	return &BrowseService{sessions: sessions, schemas: schemas, store: store}
}

func (s *BrowseService) FetchRows(connID string, req browse.Request) (*browse.Result, error) {
	pool, err := s.sessions.Pool(connID)
	if err != nil {
		return nil, apperr.From(err)
	}
	t, err := s.schemas.table(connID, req.Schema, req.Table)
	if err != nil {
		return nil, err
	}
	cfg, err := s.store.Get(connID)
	if err != nil {
		return nil, apperr.From(err)
	}
	timeout := time.Duration(cfg.WithDefaults().StatementTimeoutSeconds) * time.Second
	ctx, cancel := context.WithTimeout(context.Background(), timeout+5*time.Second)
	defer cancel()
	res, err := browse.Fetch(ctx, pool, t, req, browse.Options{StatementTimeout: timeout, CountTimeout: 2 * time.Second})
	if err != nil {
		return nil, apperr.From(err)
	}
	return res, nil
}
