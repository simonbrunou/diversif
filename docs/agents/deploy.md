# Deploy

What a production deploy does, how to check one from a workstation, and where to read a production environment value. The migration runbook, rollback and the Sentry checks after a deploy live in [`DEPLOY.md`](../../DEPLOY.md).

## What a merge to `main` sets off

- **Trigger**: every push to `main` on Forgejo (a PR merge) starts a Coolify deploy through a webhook. The deploy does not wait for CI, so the CI run on the new `main` head is a separate check.
- **Build**: Coolify builds with Railpack's node provider, set in `railpack.json`. It installs the Bun version pinned there, installs the dependencies with `HUSKY=0`, and runs the `build` script from `package.json` (the provider's default build step). The image then starts `bun build/index.js` with `NODE_ENV=production`, `PROTOCOL_HEADER` and `HOST_HEADER` (`deploy` in `railpack.json`).
- **Source maps**: with `SENTRY_AUTH_TOKEN` set at build time, the `diversif:sentry-upload-after-adapter` plugin in `vite.config.ts` creates the Sentry release once the adapter has run, uploads the source maps of `./build` and deletes every `.map` file, so the image never serves them.
- **Release name**: Coolify sets `SOURCE_COMMIT` to the commit it builds. Unless `SENTRY_RELEASE` overrides it, `vite.config.ts` uses it as the Sentry release and as SvelteKit's `version.name`, so `/_app/version.json` reports the SHA that is live.
- **Start**: the new container runs the migrations and the food-catalog seed on boot (see `DEPLOY.md`), and Coolify swaps it in once it is healthy.
- **Duration**: about 4 minutes from the merge until `/_app/version.json` shows the new SHA.

## Check a deploy

After a merge, run `scripts/smoke-prod.sh <sha>` with the new `main` head SHA (`git fetch origin && git rev-parse origin/main`). Run it in one foreground Bash call with `timeout: 600000`. It polls `/_app/version.json` until that SHA is live, for 540 s at most (`SMOKE_WAIT` in seconds overrides it), so a failed wait still ends inside that call. Then it runs public HTTP checks only. It fails at once on an argument that is not a SHA, and on a SHA that `origin/main` does not contain after a `git fetch origin`. When that fetch fails, it skips the `origin/main` check and waits. A newer `main` commit that contains the SHA counts as live, so a second merge during the wait does not fail the run. Its last line reads `smoke-prod: N of N checks passed on https://diversif.app`, and it exits 1 when a check fails. When the SHA does not go live within the wait, it exits 3 and skips the checks: the deploy is still running, or it failed. Tell which with homelab-stacks `scripts/coolify-deploy-status.sh`: its exit 3 (pending) means run `smoke-prod.sh` again, its exit 1 means the deploy failed. Deploy 2664 (09bc88c, merged at 03:27 Paris on 2026-10-26) took 11 minutes, so the wait expired on a deploy that then went live. What it expects:

- `/`, `/guide` and `/en` answer 200 `text/html`.
- `/` carries a `Content-Security-Policy` with `default-src 'self'`, `Strict-Transport-Security` (sent only when `NODE_ENV=production`, see `src/hooks.server.ts`) and `X-Frame-Options: DENY`.
- `/healthz` answers 200 with `"ok":true` and `"db":"ok"` in its JSON (it also carries `uptimeMs`).
- `/_app/env.js` answers 200 JavaScript. It holds the runtime public env values: the prerendered `/offline` page imports it, and the service worker keeps a copy in its `app-env` cache.
- `/service-worker.js` answers 200 JavaScript: `src/lib/components/ReloadPrompt.svelte` registers it.
- `/sw.js` answers 404 on purpose. It was the old vite-pwa worker, gone since the SvelteKit 3 migration.
- `/offline` (prerendered) answers 200 HTML. It comes back with no `Content-Type` header today, which the script accepts.

To check the service worker by hand, open the site in a browser (the Playwright MCP tools work). `ReloadPrompt.svelte` registers the worker after the page's `load` event, so hydration alone proves nothing: once `await navigator.serviceWorker.ready` resolves, the worker at `/service-worker.js` is active and its install has filled the `workbox-precache-v2-…` cache. It also warms the `app-env` cache, but only as best effort, so that cache can exist and still be empty.

The deployment queue, the build log, the container's health and the source-map upload are prod internals. Check them from the private homelab repo (homelab-stacks `scripts/coolify-deploy-status.sh`), not from here.

A production environment value, such as `BODY_SIZE_LIMIT`, is a prod internal too. The homelab-stacks runbook `docs/operations/runbooks/ct-103-diversif.md` has the command, under "Read one environment value". Print only that variable: the environment also holds secrets.
