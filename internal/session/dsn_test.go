package session

import (
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestDSNRoundTripsSpecialCharacters(t *testing.T) {
	p := Params{Host: "db.example.com", Port: 6543, User: "o'brien", Password: `p@ss w'rd\x`, Database: "my db", SSLMode: "require"}
	cfg, err := pgxpool.ParseConfig(DSN(p))
	if err != nil {
		t.Fatal(err)
	}
	cc := cfg.ConnConfig
	if cc.Host != p.Host || cc.Port != 6543 || cc.User != p.User || cc.Password != p.Password || cc.Database != p.Database {
		t.Fatalf("round trip mismatch: %+v", cc)
	}
	if cfg.MaxConns != 5 {
		t.Fatalf("MaxConns = %d", cfg.MaxConns)
	}
	if cc.RuntimeParams["application_name"] != "kangourou" {
		t.Fatalf("application_name = %q", cc.RuntimeParams["application_name"])
	}
}

func TestDSNEmptyPassword(t *testing.T) {
	cfg, err := pgxpool.ParseConfig(DSN(Params{Host: "h", Port: 5432, User: "u", Database: "d", SSLMode: "disable"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Password != "" || cfg.ConnConfig.TLSConfig != nil {
		t.Fatalf("unexpected %+v", cfg.ConnConfig)
	}
}
