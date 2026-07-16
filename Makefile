# Bug Hunter — common commands. Run `make` or `make help` to list targets.
# Recipes are tab-indented (required by make).

.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help install setup dev build start \
        db-up db-down migrate seed db-reset \
        lint format format-check typecheck test check \
        gen clean

help: ## List available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | sort \
	  | awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

setup: install db-up migrate seed ## First-time setup: install + start db + migrate + seed
	@echo "Setup complete. Run 'make dev'."

# ── App ──────────────────────────────────────────────────────────────
dev: ## Run the dev server
	npm run dev

build: ## Production build
	npm run build

start: ## Serve the production build
	npm run start

# ── Database (Postgres via docker compose) ───────────────────────────
db-up: ## Start Postgres and wait until it is ready
	docker compose up -d --wait db

db-down: ## Stop Postgres
	docker compose down

migrate: ## Apply database migrations
	npm run db:migrate

seed: ## Seed challenges from seed/challenges.json (git-ignored)
	npm run db:seed

db-reset: ## Recreate the database from scratch (drops data)
	docker compose down -v
	docker compose up -d --wait db
	npm run db:migrate
	npm run db:seed

# ── Quality gates (mirror CI) ────────────────────────────────────────
lint: ## Lint
	npm run lint

format: ## Format all files
	npm run format

format-check: ## Check formatting
	npm run format:check

typecheck: ## Typecheck
	npm run typecheck

test: ## Run tests once
	npm run test:run

check: lint format-check typecheck test build ## Run the full CI gauntlet locally
	@echo "All checks passed."

# ── Content pipeline ─────────────────────────────────────────────────
gen: ## Generate + verify challenges (LANG=javascript N=8 [DB=1])
	npm run gen:challenges -- $(or $(LANG),javascript) $(or $(N),8) $(if $(DB),--write-db,)

clean: ## Remove build artifacts
	rm -rf .next
