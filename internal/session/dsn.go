package session

import (
	"strconv"
	"strings"
)

type Params struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
}

// DSN builds a keyword/value connection string with every value quoted.
func DSN(p Params) string {
	return strings.Join([]string{
		kv("host", p.Host),
		kv("port", strconv.Itoa(p.Port)),
		kv("user", p.User),
		kv("password", p.Password),
		kv("dbname", p.Database),
		kv("sslmode", p.SSLMode),
		"connect_timeout=10",
		"application_name=kangourou",
		"pool_max_conns=5",
	}, " ")
}

func kv(key, value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `'`, `\'`)
	return key + "='" + value + "'"
}
