.PHONY: test-go test-go-short test-front build dev bindings install

# testcontainers does not follow `docker context`; point it at the active context (OrbStack, Docker Desktop…).
export DOCKER_HOST ?= $(shell docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null)

test-go:
	go test ./...

test-go-short:
	go test -short ./...

test-front:
	cd frontend && npm test

bindings:
	wails generate module

dev:
	wails dev

build:
	wails build

# Copies the built bundle into $(APP_DIR) (override with `make install APP_DIR=~/Applications`).
APP_DIR ?= /Applications
APP := Kangourou.app

install: build
	@osascript -e 'quit app "Kangourou"' 2>/dev/null || true
	rm -rf "$(APP_DIR)/$(APP)"
	ditto build/bin/$(APP) "$(APP_DIR)/$(APP)"
	touch "$(APP_DIR)/$(APP)"
	@echo "Installé dans $(APP_DIR)/$(APP)"
