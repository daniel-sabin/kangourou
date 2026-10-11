package apperr

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func code(t *testing.T, err error) string {
	t.Helper()
	var ae *Error
	if !errors.As(From(err), &ae) {
		t.Fatalf("From(%v) is not *Error", err)
	}
	return ae.Code
}

func TestFromNil(t *testing.T) {
	if From(nil) != nil {
		t.Fatal("From(nil) must be nil")
	}
}

func TestErrorIsJSON(t *testing.T) {
	e := &Error{Code: "42P01", Message: "relation \"x\" does not exist", Position: 15}
	var got map[string]any
	if err := json.Unmarshal([]byte(e.Error()), &got); err != nil {
		t.Fatal(err)
	}
	if got["code"] != "42P01" || got["position"] != float64(15) {
		t.Fatalf("unexpected json %v", got)
	}
	if _, ok := got["detail"]; ok {
		t.Fatal("empty detail must be omitted")
	}
}

func TestFromKeepsAppError(t *testing.T) {
	v := Validation("age", "invalid input syntax for type integer")
	wrapped := fmt.Errorf("wrap: %w", v)
	var ae *Error
	if !errors.As(From(wrapped), &ae) || ae != v {
		t.Fatal("app error must pass through unchanged")
	}
}

func TestFromPgError(t *testing.T) {
	pgErr := &pgconn.PgError{Code: "42P01", Message: "relation does not exist", Detail: "d", Hint: "h", Position: 15}
	var ae *Error
	errors.As(From(pgErr), &ae)
	if ae.Code != "42P01" || ae.Message != "relation does not exist" || ae.Detail != "d" || ae.Hint != "h" || ae.Position != 15 {
		t.Fatalf("unexpected %+v", ae)
	}
}

func TestFromStatementTimeout(t *testing.T) {
	if c := code(t, &pgconn.PgError{Code: "57014"}); c != CodeTimeout {
		t.Fatalf("got %s", c)
	}
}

func TestFromContext(t *testing.T) {
	if c := code(t, context.Canceled); c != CodeCanceled {
		t.Fatalf("got %s", c)
	}
	if c := code(t, context.DeadlineExceeded); c != CodeTimeout {
		t.Fatalf("got %s", c)
	}
}

func TestFromConnectionLostPgCodes(t *testing.T) {
	for _, c := range []string{"57P01", "57P02", "57P03", "08006", "08003"} {
		if got := code(t, &pgconn.PgError{Code: c}); got != CodeConnectionLost {
			t.Errorf("%s → %s", c, got)
		}
	}
}

func TestFromConnectionLostIO(t *testing.T) {
	for _, err := range []error{io.EOF, io.ErrUnexpectedEOF, fmt.Errorf("read: %w", io.ErrUnexpectedEOF), errors.New("conn closed")} {
		if got := code(t, err); got != CodeConnectionLost {
			t.Errorf("%v → %s", err, got)
		}
	}
}

func TestFromUnknown(t *testing.T) {
	var ae *Error
	errors.As(From(errors.New("boom")), &ae)
	if ae.Code != CodeInternal || ae.Message != "boom" {
		t.Fatalf("unexpected %+v", ae)
	}
}

func TestFromSessionKeepsOtherMappings(t *testing.T) {
	var ae *Error
	errors.As(FromSession(&pgconn.PgError{Code: "42P01", Message: "m"}), &ae)
	if ae.Code != "42P01" {
		t.Fatalf("got %s", ae.Code)
	}
	if FromSession(nil) != nil {
		t.Fatal("nil must stay nil")
	}
}
