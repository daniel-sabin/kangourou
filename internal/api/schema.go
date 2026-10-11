// Package api holds the services bound to the Wails frontend. Every error returned is an *apperr.Error.
package api

import (
	"context"
	"sync"
	"time"

	"kangourou/internal/apperr"
	"kangourou/internal/schema"
	"kangourou/internal/session"
)

type SchemaService struct {
	sessions *session.Manager
	mu       sync.Mutex
	cache    map[string]*schema.Schema
}

func NewSchemaService(sessions *session.Manager) *SchemaService {
	return &SchemaService{sessions: sessions, cache: map[string]*schema.Schema{}}
}

func (s *SchemaService) GetSchema(connID string) (*schema.Schema, error) {
	s.mu.Lock()
	cached := s.cache[connID]
	s.mu.Unlock()
	if cached != nil {
		return cached, nil
	}
	pool, err := s.sessions.Pool(connID)
	if err != nil {
		return nil, apperr.FromSession(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	loaded, err := schema.Load(ctx, pool)
	if err != nil {
		return nil, apperr.FromSession(err)
	}
	s.mu.Lock()
	s.cache[connID] = loaded
	s.mu.Unlock()
	return loaded, nil
}

func (s *SchemaService) RefreshSchema(connID string) (*schema.Schema, error) {
	s.invalidate(connID)
	return s.GetSchema(connID)
}

func (s *SchemaService) invalidate(connID string) {
	s.mu.Lock()
	delete(s.cache, connID)
	s.mu.Unlock()
}

func (s *SchemaService) table(connID, schemaName, name string) (*schema.Table, error) {
	sch, err := s.GetSchema(connID)
	if err != nil {
		return nil, err
	}
	t, ok := sch.Table(schemaName, name)
	if !ok {
		return nil, apperr.New(apperr.CodeNotFound, "Table introuvable : "+schemaName+"."+name)
	}
	return t, nil
}
