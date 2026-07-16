# Bug Hunter — common commands. Run `make` or `make help` to list targets.
# Recipes are tab-indented (required by make).

.DEFAULT_GOAL := help
SHELL := /bin/bash

.PHONY: help install setup dev build start \
        db-up db-down migrate seed db-reset \
        lint format format-check typecheck test check \
        gen tunnel gen-prod drafts show publish unpublish clean deploy

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

# ── Content pipeline (local DB) ──────────────────────────────────────
gen: ## Generate + verify challenges (LANG=javascript N=8 [DB=1])
	npm run gen:challenges -- $(or $(LANG),javascript) $(or $(N),8) $(if $(DB),--write-db,)

# ── Content pipeline (production, via SSH tunnel to the VM) ──────────
# The prod DB has no public address, so every target below needs `make tunnel`
# running in another terminal. Generated challenges land as DRAFTS: they are
# invisible to players until `make publish` promotes them. Review first — the
# verify pass has approved challenges whose "correct" fix broke the code.
VM          ?= bug-hunter-db
ZONE        ?= us-central1-a
TUNNEL_PORT ?= 55432

# Reads the prod DATABASE_URL off the Cloud Run service and rewrites its host to
# the local tunnel. Kept in one place and never echoed — it carries the password.
GET_DB_URL = gcloud run services describe $(or $(SERVICE),bug-hunter) --region $(or $(REGION),us-central1) --format=json \
	| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const e=JSON.parse(s).spec.template.spec.containers[0].env||[];const v=(e.find(x=>x.name==="DATABASE_URL")||{}).value||"";if(!v){console.error("No DATABASE_URL on the Cloud Run service");process.exit(1)}process.stdout.write(v.replace(/@[^\/]+\//,"@localhost:$(TUNNEL_PORT)/"))})'

# Fails early with a useful message instead of silently hitting the local DB.
define require_tunnel
@nc -z localhost $(TUNNEL_PORT) >/dev/null 2>&1 || { \
	echo "No tunnel on localhost:$(TUNNEL_PORT). Run 'make tunnel' in another terminal."; exit 1; }
endef

tunnel: ## Open an SSH tunnel to the prod DB (leave running; Ctrl-C to stop)
	@echo "Tunnel: localhost:$(TUNNEL_PORT) -> $(VM):5432. Leave this running; Ctrl-C to stop."
	gcloud compute ssh $(VM) --zone=$(ZONE) -- -L $(TUNNEL_PORT):localhost:5432 -N

gen-prod: ## Generate challenges as DRAFTS in prod (LANG=python N=8; needs `make tunnel`)
	$(require_tunnel)
	@DATABASE_URL="$$($(GET_DB_URL))" npm run gen:challenges -- $(or $(LANG),python) $(or $(N),8) --write-db

drafts: ## List prod challenges awaiting review (needs `make tunnel`)
	$(require_tunnel)
	@DATABASE_URL="$$($(GET_DB_URL))" npm run --silent challenges -- drafts

show: ## Print one challenge in full, answers included (ID=some-id; needs `make tunnel`)
	@test -n "$(ID)" || { echo "Usage: make show ID=<challenge-id>"; exit 1; }
	$(require_tunnel)
	@DATABASE_URL="$$($(GET_DB_URL))" npm run --silent challenges -- show $(ID)

publish: ## Publish a reviewed draft — goes live instantly (ID=some-id; needs `make tunnel`)
	@test -n "$(ID)" || { echo "Usage: make publish ID=<challenge-id>"; exit 1; }
	$(require_tunnel)
	@DATABASE_URL="$$($(GET_DB_URL))" npm run --silent challenges -- publish $(ID)

unpublish: ## Pull a challenge back out of the game (ID=some-id; needs `make tunnel`)
	@test -n "$(ID)" || { echo "Usage: make unpublish ID=<challenge-id>"; exit 1; }
	$(require_tunnel)
	@DATABASE_URL="$$($(GET_DB_URL))" npm run --silent challenges -- unpublish $(ID)

clean: ## Remove build artifacts
	rm -rf .next

# ── Deploy (Cloud Run, $0-tier config) ───────────────────────────────
# Needs: `gcloud auth login` + a project set, and DATABASE_URL exported to your
# production Postgres (e.g. a free Neon/Supabase). Optional: SERVICE, REGION.
# Runs one always-available-when-busy instance that scales to zero when idle, so
# the in-memory rate limiter + sessions work without Redis.
deploy: ## Deploy to Cloud Run (export DATABASE_URL first)
	@test -n "$$DATABASE_URL" || { echo "Set DATABASE_URL to your prod Postgres first: export DATABASE_URL=..."; exit 1; }
	gcloud run deploy $(or $(SERVICE),bug-hunter) \
		--source . \
		--region $(or $(REGION),us-central1) \
		--allow-unauthenticated \
		--min-instances=0 --max-instances=1 --concurrency=80 \
		--memory=512Mi --cpu=1 \
		--set-env-vars "DATABASE_URL=$$DATABASE_URL"
