package connections

import (
	"errors"

	"github.com/zalando/go-keyring"
)

const keyringService = "kangourou"

type Secrets interface {
	Get(id string) (string, error)
	Set(id, password string) error
	Delete(id string) error
}

// Keyring stores passwords in the OS keychain (macOS Keychain, Windows Credential Manager, Secret Service).
type Keyring struct{}

func (Keyring) Get(id string) (string, error) {
	pw, err := keyring.Get(keyringService, id)
	if errors.Is(err, keyring.ErrNotFound) {
		return "", nil
	}
	return pw, err
}

func (k Keyring) Set(id, password string) error {
	if password == "" {
		return k.Delete(id)
	}
	return keyring.Set(keyringService, id, password)
}

func (Keyring) Delete(id string) error {
	if err := keyring.Delete(keyringService, id); err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return err
	}
	return nil
}
