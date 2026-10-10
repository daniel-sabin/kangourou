package connections

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"kangourou/internal/apperr"
)

func newStore(t *testing.T) (*Store, string) {
	path := filepath.Join(t.TempDir(), "kangourou", "connections.json")
	return NewStore(path), path
}

func validConfig() Config {
	return Config{Name: "Local", Host: "localhost", User: "postgres", Database: "app"}
}

func TestListEmptyWhenFileMissing(t *testing.T) {
	s, _ := newStore(t)
	got, err := s.List()
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v, %v", got, err)
	}
}

func TestSaveAssignsIDDefaultsAndPersists(t *testing.T) {
	s, path := newStore(t)
	saved, err := s.Save(validConfig())
	if err != nil {
		t.Fatal(err)
	}
	if saved.ID == "" || saved.Port != 5432 || saved.SSLMode != "require" || saved.StatementTimeoutSeconds != 30 {
		t.Fatalf("defaults not applied: %+v", saved)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("file mode %v", info.Mode().Perm())
	}
	again, _ := NewStore(path).Get(saved.ID)
	if again != saved {
		t.Fatalf("reloaded %+v != %+v", again, saved)
	}
}

func TestSaveUpdatesExisting(t *testing.T) {
	s, _ := newStore(t)
	saved, _ := s.Save(validConfig())
	saved.Name = "Renamed"
	if _, err := s.Save(saved); err != nil {
		t.Fatal(err)
	}
	all, _ := s.List()
	if len(all) != 1 || all[0].Name != "Renamed" {
		t.Fatalf("got %+v", all)
	}
}

func TestListSortedByName(t *testing.T) {
	s, _ := newStore(t)
	b := validConfig()
	b.Name = "b"
	a := validConfig()
	a.Name = "A"
	_, _ = s.Save(b)
	_, _ = s.Save(a)
	all, _ := s.List()
	if all[0].Name != "A" || all[1].Name != "b" {
		t.Fatalf("not sorted case-insensitively: %+v", all)
	}
}

func TestSaveRejectsInvalid(t *testing.T) {
	s, _ := newStore(t)
	cases := map[string]func(*Config){
		"name":     func(c *Config) { c.Name = " " },
		"host":     func(c *Config) { c.Host = "" },
		"user":     func(c *Config) { c.User = "" },
		"database": func(c *Config) { c.Database = "" },
		"port":     func(c *Config) { c.Port = 70000 },
		"sslMode":  func(c *Config) { c.SSLMode = "prefer" },
	}
	for field, mutate := range cases {
		c := validConfig()
		mutate(&c)
		_, err := s.Save(c)
		var ae *apperr.Error
		if !errors.As(err, &ae) || ae.Code != apperr.CodeValidation || ae.Column != field {
			t.Errorf("%s: got %v", field, err)
		}
	}
}

func TestDeleteAndGetNotFound(t *testing.T) {
	s, _ := newStore(t)
	saved, _ := s.Save(validConfig())
	if err := s.Delete(saved.ID); err != nil {
		t.Fatal(err)
	}
	_, err := s.Get(saved.ID)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Code != apperr.CodeNotFound {
		t.Fatalf("got %v", err)
	}
}
