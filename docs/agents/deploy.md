# Deploy

What a production deploy does and how to check one from a workstation. The migration runbook, rollback and the Sentry checks after a deploy live in [`DEPLOY.md`](../../DEPLOY.md).

## What a merge to `main` sets off

- **Trigger**: every push to `main` on Forgejo (a PR merge) starts a Coolify deploy through a webhook. The deploy does not wait for CI, so the CI run on the new `main` head is a separate check.
- **Build**: Coolify builds with Railpack from `railpack.json`: the Bun version pinned there, `HUSKY=0` during install, then `bun build/index.js` with `NODE_ENV=production`, `PROTOCOL_HEADER` and `HOST_HEADER`.
- **Source maps**: with `SENTRY_AUTH_TOKEN` set at build time, the `diversif:sentry-upload-after-adapter` plugin in `vite.config.ts` creates the Sentry release once the adapter has run, uploads the source maps of `./build` and deletes every `.map` file, so the image never serves them.
- **Release name**: Coolify sets `SOURCE_COMMIT` to the commit it builds. `vite.config.ts` uses it as the Sentry release and as SvelteKit's `version.name`, so `/_app/version.json` reports the SHA that is live.
- **Start**: the new container runs the migrations and the food-catalog seed on boot (see `DEPLOY.md`), and Coolify swaps it in once it is healthy.
- **Duration**: about 4 minutes from the merge until `/_app/version.json` shows the new SHA.

## Check a deploy

After a merge, run `scripts/smoke-prod.sh <sha>` with the new `main` head SHA (`git fetch origin && git rev-parse origin/main`). It polls `/_app/version.json` until that SHA is live (10 minutes at most, `SMOKE_WAIT` in seconds overrides it), then runs public HTTP checks only. Its last line reads `smoke-prod: N of N checks passed on https://diversif.app`, and it exits 1 on any failure. What it expects:

- `/`, `/guide` and `/en` answer 200 `text/html`.
- `/` carries a `Content-Security-Policy` with `default-src 'self'`, `Strict-Transport-Security` (sent only when `NODE_ENV=production`, see `src/hooks.server.ts`) and `X-Frame-Options: DENY`.
- `/healthz` answers 200 with `"ok":true` and `"db":"ok"` in its JSON (it also carries `uptimeMs`).
- `/service-worker.js` answers 200 JavaScript: `src/lib/components/ReloadPrompt.svelte` registers it.
- `/sw.js` answers 404 on purpose. It was the old vite-pwa worker, gone since the SvelteKit 3 migration.
- `/offline` (prerendered) answers 200 HTML. It comes back with no `Content-Type` header today, which the script accepts.

To check the service worker by hand, open the site in a browser (the Playwright MCP tools work): once `document.documentElement.dataset.hydrated === 'true'`, the worker at `/service-worker.js` is active and the `app-env` and `workbox-precache-v2-…` caches exist.

The deployment queue, the build log, the container's health and the source-map upload are prod internals. Check them from the private homelab repo (homelab-stacks `scripts/coolify-deploy-status.sh`), not from here.
