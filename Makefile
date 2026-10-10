.PHONY: test-go test-go-short test-front build dev bindings

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
