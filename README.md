# HyperMemo Chrome Extension

TypeScript + React Chrome extension that captures bookmarks, ships them to an AWS Bedrock + Aurora pgvector backend, lets you chat with your saved knowledge, and exports notes to Google Docs using Firebase-authenticated Google credentials.

## Features
- **Quick capture popup**: grab the active tab, request Bedrock summaries/tags, and persist the page with metadata + content to the backend.
- **RAG workspace**: questions are embedded via Bedrock and compared in Aurora pgvector; the dashboard surfaces source citations next to each answer.
- **Note builder + Docs export**: select bookmarks, compose a draft locally, then ask the backend to exchange the Firebase ID token for Drive scopes and create a Google Doc.
- **Firebase-first auth**: the front-end only needs `VITE_FIREBASE_*` keys; API calls include the user’s ID token and the backend handles token verification.

## Scripts
```bash
pnpm install
pnpm run dev        # Vite dev server + CRX reloader (load dist/ as unpacked extension)
pnpm run build      # type-check + production build into dist/
pnpm run lint       # Biome formatting + lint rules
```
If pnpm warns about ignored install scripts (e.g., `@firebase/util`, `esbuild`), run `pnpm approve-builds` once to whitelist them.

## Environment
Create `.env` (or `.env.local`) with:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=https://your-api-gateway.example.com
```
`VITE_API_BASE_URL` should point to the API layer that talks to Bedrock for embeddings/summaries, writes embeddings to Aurora pgvector, and exports notes to Google Docs.

## Backend expectations
- `/bookmarks` (GET/POST/PUT/DELETE) stores bookmark metadata + embeddings in Aurora pgvector (use RDS Proxy where possible).
- `/summaries` + `/summaries/tags` call Bedrock Titan text-embeddings/LLMs to summarize content and suggest tags.
- `/rag/query` embeds the question, performs pgvector similarity search, and returns `{ answer, matches }`.
- `/notes/export` receives `{ note }`, exchanges the Firebase ID token for Google Drive credentials, and invokes the Docs API; the response should echo `exportUrl` & `driveFileId`.

## Project layout
- `src/pages/popup` – capture UI + styles.
- `src/pages/dashboard` – chat workspace and note builder.
- `src/services` – Firebase wiring, API client, bookmark/notes/RAG helpers.
- `src/background` / `src/content` – Chrome runtime scripts for page capture and messaging.
- `pages/` – HTML entrypoints consumed by Vite/CRXJS.

Feel free to extend the Service Worker, add offline caching, or plug in additional API endpoints (e.g., analytics, spaced repetition) as the backend grows.
