# CLAUDE.md

Guidance for AI coding agents working in this repository.

## Commands

```bash
yarn dev            # Next.js dev server (Turbopack)
yarn build          # Production build
yarn lint           # ESLint
yarn typecheck      # tsc --noEmit
yarn test           # node:test suites under scripts/test-*.ts (no database needed)
yarn db:generate    # Drizzle migration from src/db/schema.ts
yarn db:migrate     # Apply migrations
docker compose up -d  # Local Postgres
```

`postinstall` runs `scripts/patch-filerobot-react-imports.mjs`, which patches `react-filerobot-image-editor` for React 19. The package is pinned to an exact beta because newer betas already carry the import in some files.

## Architecture

Single Next.js 16 app that is also an npm package (`bananaflow`) consumed by the hosted product. Every file under `src/` uses **relative imports only**; a `@/` alias would resolve against the consuming app when this repo is installed from git.

- **Canvas** `src/components/flow/**`, `src/stores/board-store.tsx` (Zustand store per board), `src/stores/board-tabs-store.ts`. Node types: `inputNode`, `outputNode`, `videoNode`, `seedNode`, `upscaleNode`, `removeBgNode`, `faceConsistencyNode` (legacy `promptNode`, `imageNode` still render).
- **Canvas host** `src/components/canvas-host/context.tsx`. Client components never import server code; they read `actions` (server-action wrappers), `costPreview`, `onLimit`, `onGenerationSettled` and `track` from `useCanvasHost()`.
- **Engine** `src/lib/**`. Model registries (`image-models.ts`, `video-generation-service.ts`), provider calls, job helpers (`image-jobs.ts`, `video-jobs.ts`), action implementations (`lib/actions/*`, first parameter is always `host`), route-handler factories (`lib/routes/*`, `createXxxRoute(host)`), scheduler functions (`lib/scheduler/*`), storage implementations (`lib/storage/*`), key encryption (`lib/keys/*`).
- **Host adapter** `src/lib/host/types.ts`. `HostAdapter` = `{ db, auth, keys, policy, limits, storage, callbacks }`. Only `src/app/**` and `src/host/**` may import the `host` singleton from `src/host/index.ts`; engine modules receive it as a parameter. A `Denial` from the host becomes an HTTP response via `denialResponse()` or an action result via `denialActionResult()`.
- **Local host** `src/host/local/*`: user id is always `"local"`, policy allows everything, keys come from the `provider_keys` table (AES-256-GCM with `APP_SECRET`) then `KIE_SECRET`, storage is local disk or S3, callbacks use `PUBLIC_BASE_URL` or null.
- **Database** `src/db/schema.ts` (Drizzle, bare `pgTable`), `src/db/index.ts` (node-postgres pool). `updatedAt` columns set their value JS-side on every insert/update.
- **Scheduler** `instrumentation.ts` starts `src/lib/scheduler/in-process.ts` when `ENABLE_INPROCESS_SCHEDULER=true`. The same functions back `/api/cron/*`.

## Generation pipeline

1. Route factory: `host.auth.getUserId()`, validate body, resolve model config.
2. `host.keys.resolveProviderKey(userId, "kie")`; `host.callbacks.publicBaseUrl()` (null means no webhook, the poller finalizes).
3. `host.policy.beforeGenerate(...)` (no-op locally, returns a `Denial` in hosted products).
4. Insert the job row, create the provider task.
5. Webhook or poller: download the asset, `host.storage.uploadAsset`, persist media, `adjustBoardStorage`, `host.policy.afterGenerate(...)`.

Adding a model: add it to the registry; per-model `successStates`/`failStates`/`statusField`/`videoUrlField` drive the polling.

## Conventions

TypeScript everywhere, double quotes, trailing commas on multi-line. Components PascalCase; `src/lib` files hyphenated. Bigints stay bigint until serialized. Don't use native `alert`/`confirm`; use `notifyDialog` / `confirmDialog` from `src/components/ui/dialog-host.tsx`.
