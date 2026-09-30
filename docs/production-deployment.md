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

A Next.js build does not deploy Convex. For each release, deploy the matching
Convex functions/schema and then verify the frontend against that deployment.
Do not use development deploy keys in production or production keys in previews.

`vercel.json` sets the Build Command to `bun run build:vercel`. Remove any
Dashboard override that invokes only `bun run build`. The guarded command runs:

```sh
bunx convex deploy --cmd 'bun run typecheck && bun run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
```

Convex supplies the matching browser URL. Vercel only publishes the built
frontend if the entire command, including backend deployment, succeeds. Ordinary
`bun run build` remains a local build and never deploys Convex.

Configure `CONVEX_DEPLOY_KEY` separately in Vercel:

- **Production:** a `prod:` key for `vivid-wolf-310`, scoped only to Production.
- **Preview:** a `preview:` key for this Convex project, scoped only to Preview.
  Each branch gets its own backend. Configure the project's development/preview
  default environment variables with matching **development** Clerk keys/issuer,
  webhook secret, and an encryption key for those separate deployments.

The guard rejects missing keys, development/admin/project keys, and keys of the
wrong environment type before spawning the deployment command. It never prints
a key and does not fall back to a developer's `CONVEX_DEPLOYMENT`. Missing or
mis-scoped keys produce a failed release instead of publishing a frontend with
missing backend functions. Existing production encryption keys stay unchanged.
The PR does not create keys or edit Vercel settings; these settings must be ready
before its preview/production release can succeed.

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
