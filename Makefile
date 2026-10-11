.PHONY: test-go test-go-short test-front build dev bindings

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
