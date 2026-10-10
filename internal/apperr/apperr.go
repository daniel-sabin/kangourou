// Package apperr defines the structured error returned to the frontend.
package apperr

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

const (
	CodeValidation      = "kangourou.validation"
	CodeNotConnected    = "kangourou.not_connected"
	CodeConnectionLost  = "kangourou.connection_lost"
	CodeConnectFailed   = "kangourou.connect_failed"
	CodeTimeout         = "kangourou.timeout"
	CodeCanceled        = "kangourou.canceled"
	CodeNotFound        = "kangourou.not_found"
	CodeOpenTransaction = "kangourou.open_transaction"
	CodeInternal        = "kangourou.internal"
)

// Error is serialized as JSON in Error() so that Wails hands the frontend a parseable string.
type Error struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Detail   string `json:"detail,omitempty"`
	Hint     string `json:"hint,omitempty"`
	Position int    `json:"position,omitempty"`
	Column   string `json:"column,omitempty"`
}

func (e *Error) Error() string {
	b, _ := json.Marshal(e)
	return string(b)
}

func New(code, message string) *Error { return &Error{Code: code, Message: message} }

func Validation(column, message string) *Error {
	return &Error{Code: CodeValidation, Message: message, Column: column}
}

// From maps any error to an *Error. It returns nil for nil.
func From(err error) error {
	if err == nil {
		return nil
	}
	var ae *Error
	if errors.As(err, &ae) {
		return ae
	}
	if errors.Is(err, context.Canceled) {
		return New(CodeCanceled, "Requête annulée")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return New(CodeTimeout, "Délai dépassé")
	}
	var connectErr *pgconn.ConnectError
	if errors.As(err, &connectErr) {
		return New(CodeConnectFailed, connectErr.Error())
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch {
		case pgErr.Code == "57014":
			return New(CodeTimeout, "La requête a dépassé le délai autorisé (statement_timeout)")
		case strings.HasPrefix(pgErr.Code, "08"), pgErr.Code == "57P01", pgErr.Code == "57P02", pgErr.Code == "57P03":
			return &Error{Code: CodeConnectionLost, Message: pgErr.Message}
		}
		return &Error{Code: pgErr.Code, Message: pgErr.Message, Detail: pgErr.Detail, Hint: pgErr.Hint, Position: int(pgErr.Position)}
	}
	var netErr net.Error
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) || errors.As(err, &netErr) || strings.Contains(err.Error(), "conn closed") {
		return New(CodeConnectionLost, "Connexion perdue : "+err.Error())
	}
	return New(CodeInternal, err.Error())
}
