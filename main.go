package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"kangourou/internal/api"
	"kangourou/internal/connections"
	"kangourou/internal/session"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	path, err := connections.DefaultPath()
	if err != nil {
		log.Fatal(err)
	}
	sessions := session.NewManager()
	store := connections.NewStore(path)
	schemas := api.NewSchemaService(sessions)

	err = wails.Run(&options.App{
		Title:            "Kangourou",
		Width:            1400,
		Height:           900,
		AssetServer:      &assetserver.Options{Assets: assets},
		BackgroundColour: &options.RGBA{R: 24, G: 26, B: 31, A: 1},
		OnShutdown:       func(context.Context) { sessions.CloseAll() },
		Bind: []interface{}{
			api.NewConnectionService(store, connections.Keyring{}, sessions, schemas),
			schemas,
			api.NewBrowseService(sessions, schemas, store),
			api.NewQueryService(sessions),
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
