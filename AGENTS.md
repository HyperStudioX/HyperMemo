# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds TypeScript sources: popup/dashboard React UIs (`src/pages/**`), contexts (`src/contexts`), Chrome scripts (`src/background`, `src/content`), and domain services (`src/services`).  
- Static HTML entry points live under `pages/`, while icons reside in `public/icons`.  
- `functions/` contains the Python Firebase Functions backend (Vertex AI, Firestore, Docs export).  
- Build artifacts are emitted to `dist/` after running `pnpm run build`. Avoid hand-editing generated files.

## Build, Test, and Development Commands
- Front-end: `pnpm install`, `pnpm run dev`, `pnpm run build`, `pnpm run lint`.  
- Makefile shortcuts: `make install`, `make front-dev`, `make front-build`, `make front-lint`, `make backend-install`, `make backend-deploy`.  
- Backend manual workflow: `cd functions && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` (installs firebase-functions, firebase-admin, google-cloud-firestore>=2.19.0, etc.), then `firebase deploy --only functions`.

## Coding Style & Naming Conventions
- TypeScript/React code uses ES modules, React 18 function components, and absolute imports via the `@/` alias.  
- Prefer descriptive camelCase for variables/functions and PascalCase for components/context providers.  
- Run `pnpm run lint` before committing; Biome enforces spacing, quote style, and basic best practices. Keep files ASCII unless a dependency already uses Unicode.

## Testing Guidelines
- Automated tests are not yet implemented. When adding tests, colocate them next to source files (e.g., `bookmarkService.test.ts`) and wire a `pnpm run test` script.  
- Strive for coverage of bookmarking workflows, runtime messaging, and Firebase/auth helpers.

## Commit & Pull Request Guidelines
- Use conventional, action-oriented commit messages (e.g., `feat: add popup summary autosuggest`).  
- Each pull request should include: purpose summary, screenshots/gifs for UI changes (popup + dashboard), and references to related issues.  
- Verify `pnpm run build` and `pnpm run lint` succeed before requesting review; attach any manual test notes (e.g., “loaded unpacked extension in Chrome 129”).

## Security & Configuration Tips
- Store Firebase and Google API credentials in `.env` files (prefixed with `VITE_…`); never commit secrets.  
- When implementing Drive exports or real RAG backends, route privileged calls through Firebase Functions or another server-side layer to keep tokens out of the extension bundle.
