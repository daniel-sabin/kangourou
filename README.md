# Kangourou 🦘

Client PostgreSQL desktop (Go + Wails + React) : connexions enregistrées, arbre du schéma, onglets de tables groupés, filtres par colonne, navigation par clé étrangère (et « Référencé par »), éditeur SQL.

## Développement

Prérequis : Go ≥ 1.25, Node 24 (`nvm use`), Wails v2 (`go install github.com/wailsapp/wails/v2/cmd/wails@v2.16.0`), Docker (tests d'intégration).

```bash
make dev            # application en mode développement
make test-go        # tests Go (démarre Postgres 16 via testcontainers)
make test-go-short  # tests Go unitaires uniquement
make test-front     # tests Vitest
make bindings       # régénère frontend/wailsjs après modification des services Go
make build          # binaire dans build/bin
make install        # build + installe Kangourou.app dans /Applications
```

## Architecture

- `internal/api` : services exposés au frontend (connexions, schéma, navigation, requêtes). Toute erreur est un JSON `{code, message, …}`.
- `internal/browse` : SQL de navigation (identifiants validés contre le schéma et échappés, valeurs toujours paramétrées), transaction `READ ONLY` avec `statement_timeout`.
- `internal/connections` : configuration dans `<UserConfigDir>/kangourou/connections.json`, mots de passe dans le trousseau du système.
- `frontend/src/tabs/store.ts` : modèle des onglets (groupes par table, vues, historique de navigation).

## Raccourcis

| Raccourci | Action |
|---|---|
| Cmd/Ctrl+clic sur une table | ouvre une nouvelle vue dans le groupe |
| Clic sur une valeur de FK | ouvre la ligne référencée |
| Clic droit sur une ligne | « Référencé par » |
| Cmd/Ctrl+[ | vue précédente du groupe |
| Cmd/Ctrl+Entrée | exécute la sélection ou l'instruction sous le curseur |
| Cmd/Ctrl+Maj+Entrée | exécute tout |
