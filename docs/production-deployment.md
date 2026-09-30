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

## Deployment workflow

Use two Convex backends: production and shared development. Vercel's built-in
`VERCEL_ENV` chooses the build command in `package.json`:

- Production: `bunx convex deploy --cmd 'bun run build'`. Convex supplies the
  production URL to Next.js and deploys the matching backend. A missing deploy
  key fails the build instead of falling back to a local deployment.
- Preview: `bun run build`, using the shared development URL and Clerk keys
  configured in Vercel. It runs no Convex command and needs no deploy key.

Next.js checks TypeScript during `bun run build`; no separate build-time
TypeScript command is needed. `vercel.json` and the Vercel dashboard use
`bun run build:vercel`.

### Environment settings

| Setting | Production | Preview |
| --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | Production deployment's `prod:` key | Unset, including branch overrides |
| `NEXT_PUBLIC_CONVEX_URL` | Production URL; Convex supplies it during the build | Existing shared development URL |
| Clerk publishable and secret keys | Production instance | Matching development instance |

Configure each Convex backend with its matching Clerk issuer, secret key,
webhook secret, and existing encryption key. Clerk webhooks must target that
backend's `.convex.site` endpoint. Keep integration credentials and redirects
scoped to their environment. Do not copy production credentials into development.
Remove Preview branch overrides that select old isolated backends or a different
Clerk instance, and rebuild previews after changing their settings.

### Development and preview testing

Local development and all previews share backend code and data. Before testing
backend changes in a preview, sync them with `bunx convex dev --once` against the
existing development deployment, without a production deploy key. A preview
build alone does not update the backend. Keep backend APIs and schemas compatible
with frontend branches still in use. Existing isolated backends can be cleaned up
separately; this build command does not delete them.

After a release, smoke-test sign-in, account connection, workplace creation,
and invitations. Inspect browser errors and Convex logs as well as Vercel logs.

Reference: [Convex's Vercel deployment guide](https://docs.convex.dev/production/hosting/vercel).
