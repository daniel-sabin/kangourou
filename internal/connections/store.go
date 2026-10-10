package connections

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"

	"github.com/google/uuid"

	"kangourou/internal/apperr"
)

func DefaultPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "kangourou", "connections.json"), nil
}

type Store struct {
	path string
	mu   sync.Mutex
}

func NewStore(path string) *Store { return &Store{path: path} }

func (s *Store) read() ([]Config, error) {
	b, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return []Config{}, nil
	}
	if err != nil {
		return nil, err
	}
	var cs []Config
	if err := json.Unmarshal(b, &cs); err != nil {
		return nil, err
	}
	return cs, nil
}

func (s *Store) write(cs []Config) error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(cs, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *Store) List() ([]Config, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cs, err := s.read()
	if err != nil {
		return nil, err
	}
	slices.SortFunc(cs, func(a, b Config) int { return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)) })
	return cs, nil
}

func (s *Store) Get(id string) (Config, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cs, err := s.read()
	if err != nil {
		return Config{}, err
	}
	for _, c := range cs {
		if c.ID == id {
			return c, nil
		}
	}
	return Config{}, apperr.New(apperr.CodeNotFound, "Connexion introuvable")
}

func (s *Store) Save(c Config) (Config, error) {
	c = c.WithDefaults()
	if err := c.Validate(); err != nil {
		return Config{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cs, err := s.read()
	if err != nil {
		return Config{}, err
	}
	if c.ID == "" {
		c.ID = uuid.NewString()
	}
	if i := slices.IndexFunc(cs, func(x Config) bool { return x.ID == c.ID }); i >= 0 {
		cs[i] = c
	} else {
		cs = append(cs, c)
	}
	return c, s.write(cs)
}

func (s *Store) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cs, err := s.read()
	if err != nil {
		return err
	}
	return s.write(slices.DeleteFunc(cs, func(c Config) bool { return c.ID == id }))
}
