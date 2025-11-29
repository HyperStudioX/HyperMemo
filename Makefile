.PHONY: frontend-install frontend-dev frontend-build frontend-lint backend-venv backend-install backend-build backend-deploy backend-logs clean

UV ?= uv
UV_PYTHON_VERSION ?= 3.13

frontend-install: ## Install front-end dependencies
	pnpm install

frontend-dev: ## Start Vite dev server (Chrome extension)
	pnpm run dev

frontend-build: ## Type-check and produce production build
	pnpm run build

frontend-lint: ## Run Biome lint
	pnpm run lint

backend-venv: ## Create/update uv-managed virtualenv at functions/venv
	cd functions && UV_VENV_CLEAR=1 $(UV) venv venv --python $(UV_PYTHON_VERSION)

backend-install: backend-venv ## Install Firebase Functions dependencies via uv
	cd functions && $(UV) pip install --python venv/bin/python -r requirements.txt

backend-build: ## Run basic type/bytecode check for Firebase Functions
	cd functions && $(UV) run --venv venv python -m py_compile main.py

backend-deploy:
	firebase deploy --only functions

backend-logs: ## Show latest Firebase Functions logs
	firebase functions:log --only summary-tags,rag-query

clean: ## Remove build artifacts and caches
	rm -rf dist
	rm -rf functions/lib functions/node_modules functions/venv functions/.venv functions/__pycache__ functions/.uv-cache
