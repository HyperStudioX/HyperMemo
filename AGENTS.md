# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds TypeScript sources: popup/dashboard React UIs (`src/pages/**`), contexts (`src/contexts`), Chrome scripts (`src/background`, `src/content`), and domain services (`src/services`).  
- Static HTML entry points live under `pages/`, while icons reside in `public/icons`.  
- Build artifacts are emitted to `dist/` after running `pnpm run build`. Avoid hand-editing generated files.

## Build, Test, and Development Commands
- `pnpm install` – install workspace dependencies.  
- `pnpm run dev` – starts Vite in watch mode with the CRX plugin; load the generated `dist/` folder as an unpacked extension for live reloads.  
- `pnpm run build` – type-checks (`tsc --noEmit`) and produces production-ready bundles in `dist/`.  
- `pnpm run lint` – runs Biome across the repo to enforce formatting/style. No automated test suite exists yet; add scripts under `package.json` when tests land.

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
