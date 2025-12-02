# Repository Guidelines

## Project Overview
HyperMemo is a Chrome extension (Manifest v3) that provides AI-powered bookmark management with RAG-based chat functionality.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + CRXJS
- Backend: Supabase Edge Functions (Deno runtime)
- Database: Postgres with pgvector for embeddings
- AI: OpenAI (summaries, tags, embeddings, RAG)
- Testing: Vitest (frontend) + Deno test (backend)
- Linting: Biome (frontend) + Deno lint (backend)

## Project Structure & Module Organization

### Frontend (`src/`)
- **`src/pages/popup/`** - Quick capture UI (extension icon popup)
- **`src/pages/dashboard/`** - Full dashboard with RAG chat and note builder
- **`src/background/`** - Service worker for Chrome runtime APIs
- **`src/content/`** - Content scripts for page content extraction
- **`src/services/`** - API client and service layer (bookmarks, tags, RAG, auth, subscriptions)
- **`src/contexts/`** - React contexts (AuthContext, BookmarkContext)
- **`src/components/`** - Reusable React components
- **`src/types/`** - TypeScript type definitions
- **`src/utils/`** - Shared utilities
- **`src/i18n/`** - Internationalization (i18next)
- **`src/manifest.ts`** - Chrome extension manifest definition

**Path Aliases:** Use `@/components/*`, `@/services/*`, `@/contexts/*`, `@/hooks/*`, `@/types/*`, `@/utils/*` instead of relative paths.

### Backend (`supabase/`)
- **`supabase/migrations/`** - SQL schema migrations
- **`supabase/functions/bookmarks/`** - CRUD + AI summaries + embeddings
- **`supabase/functions/summaries/`** - AI summary and tag generation
- **`supabase/functions/tags/`** - Tag CRUD with bookmark counts
- **`supabase/functions/rag_query/`** - Hybrid semantic + tag-based search
- **`supabase/functions/notes/`** - Placeholder for Google Docs export
- **`supabase/functions/_shared/`** - Shared utilities:
  - `ai.ts` - OpenAI integration
  - `cors.ts`, `response.ts`, `request.ts` - HTTP helpers
  - `supabaseClient.ts` - Database client
  - `bookmarks.ts`, `tagUtils.ts` - Business logic and types
  - `prompts.ts` - AI prompt templates

### Other Directories
- **`pages/`** - HTML entry points for Vite
- **`public/icons/`** - Extension icons
- **`docs/`** - Documentation (architecture, release guide, auth setup)
- **`scripts/`** - Admin CLI tools (subscription management, stats)
- **`dist/`** - Build output (git-ignored, auto-generated)

## Build, Test, and Development Commands

### Frontend (Chrome Extension)
```bash
make frontend-install      # Install dependencies (or: pnpm install)
make frontend-dev          # Start Vite dev server (or: pnpm run dev)
make frontend-build        # Type-check + production build (or: pnpm run build)
make frontend-lint         # Run Biome linter (or: pnpm run lint)
make frontend-test         # Run Vitest tests (or: pnpm vitest run)
pnpm vitest               # Run tests in watch mode
```

### Backend (Supabase Edge Functions)
```bash
make backend-db            # Apply SQL migrations (or: supabase db push)
make backend-functions     # Deploy all Edge Functions
make backend-lint          # Run Deno linter (or: deno lint supabase/functions)
make backend-test          # Run Deno tests (or: deno test supabase/functions)
```

### Release
```bash
make release              # Build, validate, and package for Chrome Web Store
```

### Admin Scripts
```bash
pnpm run sub              # Manage user subscriptions (tsx scripts/manage-subscription.ts)
pnpm run stats            # View admin statistics (tsx scripts/admin-stats.ts)
```

### Environment Setup

**Frontend** (`.env` or `.env.local`):
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_FUNCTION_URL=https://YOUR_PROJECT_REF.functions.supabase.co  # optional
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_GOOGLE_OAUTH_CLIENT_ID=...
VITE_AUTO_ANON_LOGIN=false
VITE_AUTH_WAIT_TIMEOUT_MS=5000
```

**Backend** (Set via `supabase secrets set KEY=VALUE`):
```
OPENAI_API_KEY=...           # Required
OPENAI_MODEL=...             # Optional, defaults to gpt-4o-mini
OPENAI_EMBEDDING_MODEL=...   # Optional, defaults to text-embedding-3-small
OPENAI_BASE_URL=...          # Optional for compatible providers
AI_PROVIDER=openai           # Currently only openai supported
REQUIRE_AUTH=true            # Set false for local dev
ANON_UID=...                 # Fallback user for local dev
```

## Coding Style & Naming Conventions

### General
- TypeScript/React code uses ES modules, React 18 function components, and strict TypeScript
- Use absolute imports via `@/` alias for frontend code (e.g., `@/services/bookmarkService`)
- Prefer descriptive camelCase for variables/functions and PascalCase for components/context providers
- Run `make frontend-lint` and `make backend-lint` before committing (enforced by pre-commit hooks)

### Frontend Patterns
- All API calls go through the service layer (`src/services/`), not direct Supabase client
- Use React contexts (AuthContext, BookmarkContext) for shared state
- Components should be functional with hooks, avoid class components
- Chrome APIs accessed via `chrome.*` (types from `@types/chrome`)
- Error handling: Services throw errors, components handle with error states
- Use ErrorBoundary component for React error boundaries

### Backend Patterns (Edge Functions)
All Edge Functions follow this standard structure:
```typescript
Deno.serve(async (req: Request): Promise<Response> => {
  // 1. Handle CORS preflight
  const cors = handleCors(req);
  if (cors) return cors;

  // 2. Require authentication and get user_id
  const userId = await requireUserId(req);

  // 3. Route and handle business logic
  // ...

  // 4. Return JSON response with CORS headers
});
```

**Key Requirements:**
- Import shared utilities from `../_shared/` (relative imports)
- Use `deno.json` for import maps (npm: prefix for Node modules)
- All database queries MUST filter by `user_id` for security
- Always use `requireUserId(req)` for authentication
- Use `jsonResponse()` helper to ensure CORS headers
- Test with `deno test` before deploying

### Tag Handling
- Always lowercase and trim tag names (use `normalizeTags()` from `_shared/bookmarks.ts`)
- Maximum 5 tags per bookmark (enforced in Edge Functions)
- Tags are per-user (user_id in tags table)

## Testing Guidelines

### Automated Testing
The project has dual testing environments:

**Frontend Tests (Vitest with jsdom)**
```bash
make frontend-test        # Run all tests once
pnpm vitest              # Run in watch mode
```
- Test files: `src/**/*.{test,spec}.{ts,tsx}`
- Environment: jsdom for React component testing
- Config: `vitest.config.ts` (integrated in `vite.config.ts`)
- Examples: `src/services/bookmarkService.test.ts`, `src/components/TagInput.test.tsx`

**Backend Tests (Deno test)**
```bash
make backend-test        # Run all tests once
deno test supabase/functions
```
- Test files: `supabase/functions/**/*test.ts`
- Examples: `supabase/functions/_shared/bookmarks.test.ts`, `supabase/functions/_shared/tagUtils.test.ts`

**Pre-commit Hooks:**
- Runs lint-staged which executes:
  - Biome lint for `src/**/*.{ts,tsx}`
  - Deno lint for `supabase/functions/**/*.{ts,tsx}`
- Runs Vitest and Deno tests before every commit

### Manual Verification (Chrome Extension)
For testing the extension UI and Chrome-specific features:

1. **Start Dev Server**: Run `make frontend-dev` (or `pnpm run dev`)
2. **Load Extension**:
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode**
   - Click **Load unpacked** and select the `dist/` folder
   - Changes hot-reload automatically during development
3. **Key Test Scenarios**:
   - **Popup**: Click extension icon, test bookmark capture with AI summary/tags
   - **Dashboard**: Open dashboard (`chrome-extension://ID/pages/dashboard/index.html`), test RAG chat, tag management, bookmark editing
   - **Authentication**: Test Google OAuth login/logout flows
   - **Subscriptions**: Test free tier limits (50 bookmarks, 5 tags per bookmark)
4. **Debugging**:
   - Popup: Right-click extension icon → "Inspect popup"
   - Background: Go to `chrome://extensions/` → Click "service worker" link
   - Dashboard: Right-click page → "Inspect"
   - Check console for API or Supabase errors

### Static Analysis
- **Linting**: `make frontend-lint` (Biome) and `make backend-lint` (Deno)
- **Type Checking**: `make frontend-build` runs TypeScript compiler with `--noEmit`

## Key Architecture Patterns

### Database Schema
- **`bookmarks`** - Stores title, url, summary, raw_content, embedding vector (pgvector)
- **`tags`** - Stores tag names per user
- **`bookmark_tags`** - Junction table for many-to-many bookmark-tag relationship
- **`user_profiles`** - Stores subscription tier (free/pro) and usage limits
- **Row-level security (RLS)** enforces user isolation on all tables
- Auto-updated `updated_at` triggers on bookmarks table

See `supabase/migrations/` for full schema.

### Subscription System
- **Free tier**: 50 bookmarks max, 5 tags per bookmark
- **Pro tier**: Unlimited bookmarks and tags
- Feature gating in `subscriptionService.ts`
- Admin management via `pnpm run sub` script
- Check subscription before creating bookmarks/tags

### RAG Implementation
- **Embeddings**: Computed via OpenAI on bookmark creation, stored as pgvector
- **Hybrid scoring**: Semantic similarity (cosine distance) + tag matching boost
- **Search flow**:
  1. Embed user question via OpenAI
  2. Fetch user's bookmarks with embeddings from Postgres
  3. Calculate cosine similarity for each bookmark
  4. Apply tag boost if question tags match bookmark tags
  5. Rank and return top 5 results
  6. Send to OpenAI with sources for RAG answer
- **In-memory ranking**: Currently loads all user bookmarks (optimize for large collections)

### Service Layer Architecture
Frontend services abstract all backend communication:
- `apiClient.ts` - Base HTTP client with Supabase auth headers
- `bookmarkService.ts` - Calls `/bookmarks` Edge Function
- `tagService.ts` - Calls `/tags` Edge Function
- `ragService.ts` - Calls `/rag_query` Edge Function
- `subscriptionService.ts` - Checks limits via Supabase direct queries
- `auth/chromeIdentity.ts` - Google OAuth via Chrome Identity API

**Pattern**: Never call Supabase client directly from components, always use service layer.

## Common Development Workflows

### Adding a New Edge Function
1. Create directory: `supabase/functions/<name>/`
2. Create `index.ts` with `Deno.serve()` handler
3. Import shared utilities from `../_shared/`
4. Use `handleCors()` and `requireUserId()`
5. Add function name to `make backend-functions` in Makefile
6. Add tests co-located or in `_shared/`
7. Deploy: `make backend-functions`

### Adding a New Frontend Service
1. Create file: `src/services/<name>Service.ts`
2. Import `apiClient` for HTTP calls
3. Export typed functions for each operation
4. Add tests: `src/services/<name>Service.test.ts`
5. Import and use in components/contexts

### Database Schema Changes
1. Create migration: `supabase migration new <description>`
2. Write SQL in `supabase/migrations/<timestamp>_<description>.sql`
3. Test locally: `make backend-db` (or `supabase db push`)
4. Verify in Supabase Studio
5. Commit migration file
6. Deploy to production via Supabase CLI or GitHub Actions

### Debugging Edge Functions Locally
```bash
# Start local Supabase (requires Docker)
supabase start

# Deploy functions locally
supabase functions serve

# Test with curl
curl -X POST http://localhost:54321/functions/v1/bookmarks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test", "url": "https://example.com"}'
```

## Commit & Pull Request Guidelines
- Use conventional, action-oriented commit messages (e.g., `feat: add popup summary autosuggest`)
- Each pull request should include: purpose summary, screenshots/gifs for UI changes (popup + dashboard), and references to related issues
- Verify `make frontend-build` and `make frontend-lint` succeed before requesting review
- Pre-commit hooks automatically run linting and tests

## Security & Configuration

### Secrets Management
- **Frontend**: Use `.env` or `.env.local` with `VITE_` prefix (only public keys, no secrets)
- **Backend**: Use `supabase secrets set KEY=VALUE` for Edge Function secrets (never commit)
- **Never commit**: API keys, tokens, private keys, or any credentials to git
- Add `.env` and `.env.local` to `.gitignore` (already configured)

### Security Best Practices

**Authentication & Authorization:**
- All Edge Functions MUST use `requireUserId(req)` to enforce authentication
- All database queries MUST filter by `user_id` to prevent data leakage
- Row-level security (RLS) policies enforce access control at database level
- Google OAuth via Chrome Identity API (no password storage)

**Input Validation:**
- Validate and sanitize all user input in Edge Functions
- Use `normalizeTags()` for tag input (lowercase, trim, max 5 per bookmark)
- Check required fields before database operations
- Validate URLs and content lengths

**CORS & Headers:**
- Use `handleCors()` helper in all Edge Functions
- Always use `jsonResponse()` to ensure proper CORS headers
- Support preflight OPTIONS requests

**API Key Protection:**
- OpenAI API key stored in Supabase secrets (server-side only)
- Never expose API keys in frontend code or extension bundle
- Route all AI calls through Edge Functions, never directly from extension

**Chrome Extension Security:**
- Manifest v3 with Content Security Policy (CSP)
- Service worker for background tasks (no eval or inline scripts)
- Host permissions limited to necessary domains
- Web-accessible resources restricted to assets only

### Common Pitfalls to Avoid
- ❌ Calling OpenAI directly from frontend (exposes API key)
- ❌ Skipping `user_id` filter in database queries (data leakage)
- ❌ Forgetting CORS headers in Edge Function responses (breaks frontend)
- ❌ Not checking subscription limits before creating resources (quota bypass)
- ❌ Hardcoding credentials in code (security vulnerability)

## Documentation & Resources
- [docs/functions-architecture.md](docs/functions-architecture.md) - Detailed Edge Function architecture review
- [docs/release.md](docs/release.md) - Chrome Web Store release process
- [docs/google-auth.md](docs/google-auth.md) - Google OAuth setup guide
- [docs/admin-cli.md](docs/admin-cli.md) - Admin CLI tools usage
- [README.md](README.md) - Project overview and quick start

## Version Management
- Version defined in `package.json` (single source of truth)
- Manifest version synchronized during Vite build
- `make release` packages with version from package.json
- Update CHANGELOG.md for each release
- Create git tags for releases: `git tag v0.x.x && git push origin v0.x.x`
