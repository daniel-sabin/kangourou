package api

import (
	"context"
	"sync"

	"kangourou/internal/apperr"
	"kangourou/internal/session"
	"kangourou/internal/sqlexec"
)

type QueryService struct {
	sessions *session.Manager
	mu       sync.Mutex
	running  map[string]context.CancelFunc
}

func NewQueryService(sessions *session.Manager) *QueryService {
	return &QueryService{sessions: sessions, running: map[string]context.CancelFunc{}}
}

func (s *QueryService) Execute(connID, queryID, sql string) ([]sqlexec.Result, error) {
	pool, err := s.sessions.Pool(connID)
	if err != nil {
		return nil, apperr.From(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.mu.Lock()
	s.running[queryID] = cancel
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.running, queryID)
		s.mu.Unlock()
		cancel()
	}()

	res, err := sqlexec.Execute(ctx, pool, sql)
	if err != nil {
		if ctx.Err() != nil {
			return nil, apperr.New(apperr.CodeCanceled, "Requête annulée")
		}
		return nil, apperr.From(err)
	}
	return res, nil
}

func (s *QueryService) Cancel(queryID string) {
	s.mu.Lock()
	cancel := s.running[queryID]
	s.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}
