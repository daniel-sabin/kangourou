// Package connections persists saved connection configs; passwords live in the OS keyring.
package connections

import (
	"strings"

	"kangourou/internal/apperr"
)

type Config struct {
	ID                      string `json:"id"`
	Name                    string `json:"name"`
	Host                    string `json:"host"`
	Port                    int    `json:"port"`
	User                    string `json:"user"`
	Database                string `json:"database"`
	SSLMode                 string `json:"sslMode"`
	StatementTimeoutSeconds int    `json:"statementTimeoutSeconds"`
}

var sslModes = map[string]bool{"disable": true, "require": true, "verify-full": true}

func (c Config) WithDefaults() Config {
	if c.Port == 0 {
		c.Port = 5432
	}
	if c.SSLMode == "" {
		c.SSLMode = "require"
	}
	if c.StatementTimeoutSeconds <= 0 {
		c.StatementTimeoutSeconds = 30
	}
	return c
}

func (c Config) Validate() error {
	required := []struct{ field, value string }{
		{"name", c.Name}, {"host", c.Host}, {"user", c.User}, {"database", c.Database},
	}
	for _, r := range required {
		if strings.TrimSpace(r.value) == "" {
			return apperr.Validation(r.field, "Champ obligatoire")
		}
	}
	if c.Port < 1 || c.Port > 65535 {
		return apperr.Validation("port", "Port invalide")
	}
	if !sslModes[c.SSLMode] {
		return apperr.Validation("sslMode", "sslmode doit être disable, require ou verify-full")
	}
	return nil
}
