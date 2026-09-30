# Production deployment

The 29 September 2026 incident was an undeployed Convex backend, not an HTTP
failure in Vercel. The browser reported `CONVEX Q(hubs:getPublicSnapshot)`;
production Convex logs said `Could not find public function`. The deployed browser
bundle correctly pointed to `https://vivid-wolf-310.eu-west-1.convex.cloud`.
Vercel's 200/204/307 logs only covered the initial page and redirects.

The existing backend from main commit `3b26f6a` was deployed after repository-wide
TypeScript and tests passed. No development data or credentials were copied to
production. Production environment-variable names were already present; presence
alone does not prove that every integration credential is correct.

## 30 September account-connection incident

PR #38 introduced `betaClerk:connectAccount` as a required step before rendering
any signed-in page. The frontend was released without those Convex functions.
Production `vivid-wolf-310` logged `Could not find public function for
'betaClerk:connectAccount'` at 12:28–12:29 Europe/Tallinn. Its live metadata listed
107 functions and no `betaClerk` or `betaAccess` functions. Production
`CLERK_SECRET_KEY` was present. Signing out and back in repeated the missing
function call; Vercel runtime logs did not contain that Convex failure.

The repair preserves beta approval, verified-email employee linking, and lifting
restrictions without recreating accounts. Account reconciliation now runs beside
the existing page. A failure displays a retry notice and reports the actual error
to the browser console. Convex continues to enforce membership and beta
permissions on every protected operation; a connection failure grants no access.
React effect replays share a request, and organization activation cannot restart
reconciliation or overwrite a workplace selected while the request was pending.

The language menu, sidebar icon colors, and workplace URL preview from PRs #36–37
remain intact. No production data, keys, or Clerk settings are changed while
preparing the repair PR.

## Prevent recurrence

The project uses two Convex backends: production and shared development.
Production releases must deploy matching Convex functions/schema alongside the
frontend. Previews and local development intentionally share the development
backend and its data.

`vercel.json` sets the Build Command to `bun run build:vercel`. Remove any
Dashboard override that invokes only `bun run build`. The guarded command selects
its behavior using `VERCEL_ENV`:

- **Production:** requires a valid `prod:` deploy key and runs:

  ```sh
  bunx convex deploy --cmd 'bun run typecheck && bun run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
  ```

  Convex supplies the production browser URL. Vercel only publishes the frontend
  if the entire command, including backend deployment, succeeds. The guard rejects
  missing, malformed, development, preview, admin, and project keys without
  printing their values. It does not fall back to `CONVEX_DEPLOYMENT` or a
  developer's login. Existing production encryption keys stay unchanged.
- **Preview:** requires `NEXT_PUBLIC_CONVEX_URL`, runs `bun run typecheck` followed
  by `bun run build`, and stops if either fails. It keeps the configured URL and
  Clerk environment, invokes no Convex command, and requires no deploy key. A stale
  deploy key is ignored and removed from the child build environment.
- **Local:** use `bun run dev` with `bunx convex dev` against the existing
  development backend. Ordinary `bun run build` never deploys Convex;
  `build:vercel` rejects missing or unsupported `VERCEL_ENV` values.

### Vercel dashboard configuration

In Project Settings → Environment Variables:

| Variable | Production scope | Preview scope |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | Retain the `prod:` key for `vivid-wolf-310`, scoped only to Production | Remove it, including branch-specific overrides; no key is required |
| `NEXT_PUBLIC_CONVEX_URL` | Retain the production URL; the deploy command supplies the matching URL during build | Set the existing shared development `.convex.cloud` URL used by local development |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Retain the production instance key | Use the matching development instance's `pk_test_` key |
| `CLERK_SECRET_KEY` | Retain the production instance key | Use the same development instance's `sk_test_` key |
| `CLERK_FRONTEND_API_URL` | Retain the production issuer | Use the development issuer configured on the shared development Convex backend |

Remove Preview branch overrides that would select isolated Convex backends or
another Clerk instance. Keep Production credentials scoped to Production.
Configure the shared development Convex deployment with the matching development
Clerk issuer/secret, webhook secret, and its existing encryption key. The Clerk
development webhook must target that shared backend's `.convex.site` endpoint.
Do not copy production credentials or data into development. Rebuild previews
after updating their environment variables; existing deployments retain their
build-time values. Existing isolated preview backends may be cleaned up separately;
this change does not delete them or their data.

### Testing backend changes in previews

Before testing a frontend preview that calls changed backend functions, deploy
those functions/schema to the existing development backend:

```sh
bun run typecheck
bunx convex dev --once
```

Confirm the CLI is targeting the development backend, with no production deploy
key in the local environment. Then build/redeploy and smoke-test the preview.
Continuous `bunx convex dev` also syncs local backend edits to this same deployment.
A preview build alone does not sync backend code, so a successful frontend build
cannot prove its required functions are available.

All previews and local sessions share data, function versions, and schema changes;
writes from one are visible to the others. Preserve compatibility with older
frontend branches: introduce new fields/functions additively, keep old contracts
available while callers and data migrate, and remove obsolete fields/functions
only after those branches no longer use them. Coordinate development deployments
rather than assuming branch isolation.

Existing `NEXT_PUBLIC_*` values are baked into the frontend and require a rebuild
to change. Never print or commit deploy keys.

This repository currently checks Convex through the root `tsconfig.json`; there
is no separate `convex/tsconfig.json`. Run `bun run typecheck` before a manual
`bunx convex deploy --codegen disable --typecheck disable`, or add an appropriate
Convex-specific config before requiring its separate typecheck. The standard CLI
uses `try` by default. Keep the repository-wide typecheck in CI.

Required production configuration:
- Vercel: production Clerk publishable/secret keys, matching Convex URL,
  `SITE_URL=https://app.workhal.com`, and Deputy OAuth settings if enabled.
- Convex: production Clerk issuer and secret key, webhook signing secret, existing credential
  encryption key, and Deputy OAuth settings if enabled. Never regenerate an
  encryption key to fix an unrelated deployment failure.
- Clerk: webhook URL for the production Convex `.convex.site` endpoint and the
  production app origin/redirects; use the correct instance for beta restrictions.

Smoke test `/en/join` after hydration and inspect browser console errors as well
as Vercel logs. Check Convex logs for backend function failures. Check sign-in,
organization creation, invitations and integrations with authorized test accounts.

References:
- https://docs.convex.dev/production/hosting/vercel
- https://vercel.com/docs/logs/runtime
