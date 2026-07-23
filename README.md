# Operations hub

A multi-workplace operations portal built with Next.js 16, React 19, Convex, Clerk, Tailwind CSS, and shadcn/ui. Managers administer a workplace through Clerk Organizations. Employees may use their own Clerk accounts, while public, join-code, and private-link accountless access remains available for shared published content.

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

The Convex deployment also expects:

- `CLERK_FRONTEND_API_URL` (the Clerk issuer already used by `convex/auth.config.ts`)
- `CLERK_WEBHOOK_SIGNING_SECRET` (the signing secret for the direct Convex webhook endpoint)

The same `CLERK_FRONTEND_API_URL` issuer must be configured in the Convex development deployment. Keep all secret values out of source control and documentation. Clerk project configuration can be checked with `clerk doctor`; Convex configuration can be validated with `bunx convex dev --once`.

For a Clerk development instance, the issuer has the form `https://verb-noun-00.clerk.accounts.dev`. Copy it from Clerk's Convex integration screen rather than deriving it from another Clerk URL.

## Sources of truth

Clerk owns the global person identity, authentication sessions, verified identifiers, Organizations, Organization memberships, invitations, default `org:admin` and `org:member` roles, and the active Organization. Convex owns hubs and settings, the unique hub-to-Organization mapping, employee workplace profiles, invitation correlation state, event data, event-to-employee relationships, and guest credentials.

An Organization ID maps to exactly one Convex hub through `hubs.clerkOrganizationId`. Application URLs continue to use the existing Convex hub slug; Clerk Organization slugs are not required. All authenticated Convex authorization derives the active Organization and role from Clerk’s verified v2 session-token Organization claim. A client-supplied hub ID never grants access.

Clerk Organization membership can remain optional. A signed-in Personal Account has no active workplace and must choose an existing Organization or create a manager workplace. Switching Organizations refreshes the Clerk session token, changes the active Convex hub, and rechecks the user’s role.

## Manager onboarding

Open `/manager` and sign in or sign up with Clerk. A new manager creates a workplace through Clerk's native Organization dialog, where the workplace name and logo are configured. The application then completes an idempotent hub setup:

1. Clerk creates and activates the Organization with the user as its creator/admin.
2. The server applies the 20-membership limit to that active Organization.
3. The employee address is derived automatically from Clerk's Organization slug; managers do not configure a second public identifier.
4. The client requests an Organization-scoped Clerk token.
5. Convex creates the mapped hub and optional sample content exactly once.

## Employee profiles and invitations

Managers create Convex employee profiles before an account exists. Profiles move through `unclaimed`, `invited`, `active`, and `deactivated`. Optional email, department/team, and job title remain Convex data and are never returned to guests.

Email invitations are Clerk Organization invitations with role `org:member`. A random opaque correlation credential is stored in Clerk invitation public metadata and stored only as a hash in Convex. Clerk transfers that metadata to the accepted membership. The completion route immediately links and activates the matching profile; webhooks reconcile delayed or external lifecycle changes. Sending, resending, revoking, and completion are retry-safe.

Deactivation removes the Organization membership without deleting the global Clerk account, revokes pending invitations, and preserves the profile plus historical event links. Reactivation returns the profile to an unclaimed state. Permanent removal also deletes the workplace-specific profile, pending invitation, employee-linked notifications and read state, and event links, but never deletes the person's global account or their access to other workplaces. Each profile stores one application access tier: `viewer` (published content only), `editor` (update existing content), or `manager` (create, update, and delete content). Existing profiles without the field safely default to `viewer`. Clerk Organization admins are workplace owners and retain exclusive control over employees, invitations, establishment settings, access controls, credentials, help requests, and manager notifications. The application blocks removal of the last Organization admin.

Permissions are resolved in Convex from the authenticated identity and active employee profile on every protected query or mutation. Editors and full-content employees receive only the employee display-name/status projection needed for event assignment; employee contact, invitation, and access-level data remain owner-only. Editors cannot create or delete content. Per-item edit grants are intentionally not stored; the global tier is the single source of truth.

## Clerk webhook setup

The webhook is a public but signature-protected Convex HTTP action at:

```text
https://<deployment-name>.convex.site/clerk-webhooks
```

In Clerk Dashboard → Configure → Webhooks, subscribe to:

- `organizationInvitation.created`
- `organizationInvitation.accepted`
- `organizationInvitation.revoked`
- `organizationMembership.created`
- `organizationMembership.updated`
- `organizationMembership.deleted`

Copy the endpoint signing secret into the matching Convex deployment as `CLERK_WEBHOOK_SIGNING_SECRET`. The handler verifies every signature, uses the `svix-id` as an idempotency key, validates event-specific data through Clerk’s typed verified payload, and calls only internal Convex mutations. Use a separate endpoint and signing secret for development and production. Send a test event from Clerk and confirm HTTP 200 and one `clerkWebhookEvents` row even if the same event is replayed.

Invitation completion does not depend solely on webhooks; it calls Clerk and Convex synchronously, while webhooks provide reconciliation.

## Organization member limit

Every created workplace Organization sets `maxAllowedMemberships` to 20, matching the included Clerk limit. Invitation errors that indicate a full Organization are shown as a clear manager-facing message. Remove an inactive member before inviting another employee; this implementation does not enable or require a Clerk add-on.

## Employee access

Employee-facing pages do not require Clerk accounts. A hub is selected with its stable slug, for example `/?hub=north-pine`.

- Public mode allows anyone with the hub URL to read published content.
- Restricted mode accepts the hub join code or a private link carrying a separate bearer credential in its URL fragment, which is not sent to server logs.
- Valid anonymous access is remembered in that browser for 30 days.
- “Leave hub” forgets the saved access.
- Rotating credentials immediately invalidates previously issued codes and links.
- A signed-in active `org:member` can open the same published workplace content for the active Organization without entering the shared code.
- The workplace switcher supports users who belong to multiple Organizations. Personal Account remains available because Organization membership is optional.

Only credential hashes are stored in Convex. The readable code and private link remain in the owner's current browser, so rotating from a different browser creates new credentials there. Draft and expired content are filtered in Convex rather than only hidden by the UI.

Guests never receive employee profile records, email addresses, statuses, invitation data, or membership records. Published events include only linked employee display names.

## Calendar event employees

Calendar events use normalized `eventEmployees` rows, allowing zero, one, or multiple employee profiles while enforcing same-hub relationships and preventing duplicates. The manager picker includes active, invited, and unclaimed profiles, excludes deactivated profiles from new links, and keeps existing deactivated links visible for history. Event deletion removes all event-employee rows in the same Convex transaction.

## Development commands

```bash
bun test                 # date and shared utility tests
bun run test:convex      # Convex access and isolation tests
bun run typecheck
bun run lint
bun run build
bunx convex dev --once   # validate and sync Convex functions
```

For production, configure the production Clerk issuer and webhook secret on the production Convex deployment, deploy the schema and functions, deploy the Next.js application, and test new-workplace provisioning.

Convex's generated AI guidance and local skills are installed for development. No production MCP access or model credentials are configured by this repository.

## AI feature assessment

Grounded staff Q&A was assessed as the most useful small follow-up: it could answer a question from the current hub's published guides and link back to its sources. It is intentionally not exposed in the interface yet because no model credentials are configured. A future implementation must apply the same hub-access check before retrieval, filter out drafts, scope every vector query by `hubId`, and return source links. The current global search is a real Convex-backed keyword search and does not pretend to be AI.
