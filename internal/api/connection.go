package api

import (
	"context"
	"time"

	"kangourou/internal/apperr"
	"kangourou/internal/connections"
	"kangourou/internal/session"
)

type SaveInput struct {
	Config          connections.Config `json:"config"`
	Password        string             `json:"password"`
	PasswordChanged bool               `json:"passwordChanged"`
}

type ConnectionService struct {
	store    *connections.Store
	secrets  connections.Secrets
	sessions *session.Manager
	schemas  *SchemaService
}

func NewConnectionService(store *connections.Store, secrets connections.Secrets, sessions *session.Manager, schemas *SchemaService) *ConnectionService {
	return &ConnectionService{store: store, secrets: secrets, sessions: sessions, schemas: schemas}
}

func dsnFor(c connections.Config, password string) string {
	return session.DSN(session.Params{Host: c.Host, Port: c.Port, User: c.User, Password: password, Database: c.Database, SSLMode: c.SSLMode})
}

func connectCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 15*time.Second)
}

func (s *ConnectionService) List() ([]connections.Config, error) {
	cs, err := s.store.List()
	return cs, apperr.From(err)
}

func (s *ConnectionService) Save(in SaveInput) (connections.Config, error) {
	saved, err := s.store.Save(in.Config)
	if err != nil {
		return connections.Config{}, apperr.From(err)
	}
	if in.PasswordChanged {
		if err := s.secrets.Set(saved.ID, in.Password); err != nil {
			return connections.Config{}, apperr.From(err)
		}
	}
	return saved, nil
}

func (s *ConnectionService) Delete(id string) error {
	s.sessions.Close(id)
	s.schemas.invalidate(id)
	if err := s.store.Delete(id); err != nil {
		return apperr.From(err)
	}
	return apperr.From(s.secrets.Delete(id))
}

func (s *ConnectionService) Test(in SaveInput) error {
	cfg := in.Config.WithDefaults()
	if err := cfg.Validate(); err != nil {
		return err
	}
	password := in.Password
	if !in.PasswordChanged && cfg.ID != "" {
		stored, err := s.secrets.Get(cfg.ID)
		if err != nil {
			return apperr.From(err)
		}
		password = stored
	}
	ctx, cancel := connectCtx()
	defer cancel()
	return apperr.From(s.sessions.Test(ctx, dsnFor(cfg, password)))
}

func (s *ConnectionService) Connect(id string) error {
	cfg, err := s.store.Get(id)
	if err != nil {
		return apperr.From(err)
	}
	password, err := s.secrets.Get(id)
	if err != nil {
		return apperr.From(err)
	}
	ctx, cancel := connectCtx()
	defer cancel()
	if err := s.sessions.Open(ctx, id, dsnFor(cfg, password)); err != nil {
		return apperr.From(err)
	}
	s.schemas.invalidate(id)
	return nil
}

func (s *ConnectionService) Disconnect(id string) error {
	s.sessions.Close(id)
	s.schemas.invalidate(id)
	return nil
}
