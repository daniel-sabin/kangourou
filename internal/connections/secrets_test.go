package connections

import (
	"testing"

	"github.com/zalando/go-keyring"
)

func TestKeyringSetGetDelete(t *testing.T) {
	keyring.MockInit()
	k := Keyring{}
	if pw, err := k.Get("missing"); err != nil || pw != "" {
		t.Fatalf("missing: %q %v", pw, err)
	}
	if err := k.Set("c1", "s3cret"); err != nil {
		t.Fatal(err)
	}
	if pw, _ := k.Get("c1"); pw != "s3cret" {
		t.Fatalf("got %q", pw)
	}
	if err := k.Set("c1", ""); err != nil {
		t.Fatal(err)
	}
	if pw, _ := k.Get("c1"); pw != "" {
		t.Fatalf("empty password must delete, got %q", pw)
	}
	if err := k.Delete("never-set"); err != nil {
		t.Fatalf("deleting a missing secret must not fail: %v", err)
	}
}
