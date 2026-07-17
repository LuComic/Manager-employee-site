# Operations hub

A multi-hub operations portal built with Next.js 16, React 19, Convex, Clerk, Tailwind CSS, and shadcn/ui. Managers use Clerk accounts to own and maintain a hub. Employees open published content without creating an account.

## Local setup

Install dependencies and start the web app:

```bash
bun install
bun run dev
```

In another terminal, connect or start the Convex development deployment:

```bash
bunx convex dev
```

The project expects these environment variable names in `.env.local`:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `CLERK_FRONTEND_API_URL`

The same `CLERK_FRONTEND_API_URL` issuer must be configured in the Convex development deployment. Keep all secret values out of source control and documentation. Clerk project configuration can be checked with `clerk doctor`; Convex configuration can be validated with `bunx convex dev --once`.

For a Clerk development instance, the issuer has the form `https://verb-noun-00.clerk.accounts.dev`. Copy it from Clerk's Convex integration screen rather than deriving it from another Clerk URL.

## Manager ownership and seeding

Open `/manager` and sign in or sign up with Clerk. The first signed-in manager who does not yet own a hub is offered a safe development setup action. It creates a new hub owned by that Clerk identity and seeds the North & Pine sample categories, guides, events, and announcements once. Returning to the page is idempotent and does not duplicate the seed data.

Ownership is enforced inside every Convex manager query and mutation. Signing in does not grant access to another manager's hub.

## Employee access

Employee-facing pages do not require Clerk accounts. A hub is selected with its stable slug, for example `/?hub=north-pine`.

- Public mode allows anyone with the hub URL to read published content.
- Restricted mode accepts the hub join code or a private link carrying a separate bearer credential in its URL fragment, which is not sent to server logs.
- Valid anonymous access is remembered in that browser for 30 days.
- “Leave hub” forgets the saved access.
- Rotating credentials immediately invalidates previously issued codes and links.

Only credential hashes are stored in Convex. The readable code and private link remain in the owner's current browser, so rotating from a different browser creates new credentials there. Draft and expired content are filtered in Convex rather than only hidden by the UI.

## Development commands

```bash
bun test                 # date and shared utility tests
bun run test:convex      # Convex access and isolation tests
bun run typecheck
bun run lint
bun run build
bunx convex dev --once   # validate and sync Convex functions
```

Convex's generated AI guidance and local skills are installed for development. No production MCP access or model credentials are configured by this repository.

## AI feature assessment

Grounded staff Q&A was assessed as the most useful small follow-up: it could answer a question from the current hub's published guides and link back to its sources. It is intentionally not exposed in the interface yet because no model credentials are configured. A future implementation must apply the same hub-access check before retrieval, filter out drafts, scope every vector query by `hubId`, and return source links. The current global search is a real Convex-backed keyword search and does not pretend to be AI.
