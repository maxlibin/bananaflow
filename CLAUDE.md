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
- **Engine** `src/lib/**`. Provider-agnostic model registry (`model-registry.ts`: `IMAGE_MODELS`, `VIDEO_MODELS`, `EDIT_MODEL_BY_PROVIDER`), provider adapters (`lib/providers/{openai,google,kie}.ts` behind the `Provider` interface in `lib/providers/types.ts`: `createImageTask` / `createVideoTask` return a synchronous result or an async task id, `fetch*Task` and `parse*Callback` return a normalised `TaskStatus`), job helpers (`image-jobs.ts`, `video-jobs.ts`: `applyImageTaskStatus`, `completeImageJob`), action implementations (`lib/actions/*`, first parameter is always `host`), route-handler factories (`lib/routes/*`, `createXxxRoute(host)`), scheduler functions (`lib/scheduler/*`), storage implementations (`lib/storage/*`), key encryption (`lib/keys/*`). Kie-specific request builders live in `image-models.ts` / `video-generation-service.ts` and are only used by the Kie adapter.
- **Host adapter** `src/lib/host/types.ts`. `HostAdapter` = `{ db, auth, providers.enabled, keys, policy, limits, storage, callbacks }`. `providers.enabled` is the ordered list of providers a deployment offers; pickers filter by it and advanced ops use the first one's editing model. Only `src/app/**` and `src/host/**` may import the `host` singleton from `src/host/index.ts`; engine modules receive it as a parameter. A `Denial` from the host becomes an HTTP response via `denialResponse()` or an action result via `denialActionResult()`.
- **Local host** `src/host/local/*`: user id is always `"local"`, enabled providers are `google` then `openai`, policy allows everything, keys come from the `provider_keys` table (AES-256-GCM with `APP_SECRET`) then the provider's env var, storage is local disk or S3, callbacks use `PUBLIC_BASE_URL` or null.
- **Database** `src/db/schema.ts` (Drizzle, bare `pgTable`), `src/db/index.ts` (node-postgres pool). `updatedAt` columns set their value JS-side on every insert/update.
- **Scheduler** `instrumentation.ts` starts `src/lib/scheduler/in-process.ts` when `ENABLE_INPROCESS_SCHEDULER=true`. The same functions back `/api/cron/*`.

## Generation pipeline

1. Route factory: `host.auth.getUserId()`, validate body, look the model up in `IMAGE_MODELS` / `VIDEO_MODELS`, reject providers not in `host.providers.enabled`.
2. `host.keys.resolveProviderKey(userId, info.provider)`; `host.callbacks.publicBaseUrl()` (null means no webhook).
3. `host.policy.beforeGenerate(...)` (no-op locally, returns a `Denial` in hosted products).
4. Insert the job row, `getProvider(info.provider).createImageTask(...)`. Reference images are built by `buildReferenceImages(host, urls)`: a public URL for URL-taking providers, lazy bytes (via `host.storage.resolveAssetUrl`) for the rest.
5. Synchronous result: `completeImageJob` at once, respond `status: "completed"`. Asynchronous: store the task id; the poller (or a Kie webhook) calls `applyImageTaskStatus` with the normalised status.
6. `completeImageJob`: materialise assets, `host.storage.uploadAsset`, persist media, `adjustBoardStorage`, `host.policy.afterGenerate(...)`.

Adding a model: add an entry to `model-registry.ts` (provider + providerModel + capabilities) and UI options to `output-node.tsx` / `video-models.ts`. Adding a provider: implement `Provider` in `lib/providers/`, register it in `lib/providers/index.ts` and `PROVIDERS` in `types.ts`.

## Conventions

TypeScript everywhere, double quotes, trailing commas on multi-line. Components PascalCase; `src/lib` files hyphenated. Bigints stay bigint until serialized. Don't use native `alert`/`confirm`; use `notifyDialog` / `confirmDialog` from `src/components/ui/dialog-host.tsx`.
