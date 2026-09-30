# Beta signup and organization access

PR #35 originally documented manual Clerk approvals; the implementation now has
one operator-controlled policy and automatically includes employee emails.

## Behavior

- `creatorEmails` is the exact, case-insensitive email list for approved beta
  creators/managers. These emails can sign up; a **verified** matching email
  enables Clerk organization creation. Being on the list does not grant access
  to someone else's organization.
- The signup allowlist is the union of that list and emails on non-deactivated
  employee profiles. Adding or editing an employee requests a Clerk sync;
  invitations are optional for account creation. No invitation email is sent by
  this synchronization. Changes normally appear after the scheduled sync finishes;
  the five-minute reconciliation retries failures.
- On ordinary sign-in, Workhal fetches the user's verified addresses directly
  from Clerk, creates only `org:member` memberships in matching workplaces, and
  links the original employee profiles. Existing assignments and access levels
  survive. If multiple unclaimed profiles in one workplace match the same account,
  use an explicit invitation to choose the intended profile. An existing active
  profile remains authoritative. Unverified addresses, deactivated profiles, pending removals, and
  profiles already owned by another account cannot be claimed.
- An employee can read and use their workplace with its usual permissions, but
  cannot create a new workplace during beta. Owner/manager capabilities in Workhal
  require central approval while beta is enabled. Stored roles are not rewritten.
- Existing invitation completion and accountless workplace links/codes still work.
  Account synchronization runs without replacing the current page; failures show
  a retry notice while server-side membership and permission checks remain active.
  Signup approval is separate from guest access and organization membership.

## Configure before enabling beta

Deploy the frontend and Convex functions together through `bun run build:vercel`
as described in [production deployment](production-deployment.md). Production
and Preview each need their own scoped Vercel `CONVEX_DEPLOY_KEY`. In the
**same Clerk instance** as the app, configure the following:

1. Use **Open** access mode (not Invite-only or Waitlist); require email
   verification. Clerk's native allowlist requires a paid plan in production.
2. Turn **Allow user-created organizations** and automatic first-organization
   creation **off**. Keep organization membership optional. This is essential:
   it blocks a new employee from creating an organization before synchronization.
   The SDK does not expose this global setting, so set it in the Dashboard.
3. Add `CLERK_SECRET_KEY` to the Convex deployment using its secrets/environment
   settings. Use the key for the app's Clerk instance, never a frontend variable.
   The existing webhook endpoint also needs `user.created` and `user.updated`,
   in addition to the existing organization events. User events fetch fresh Clerk
   state rather than trusting potentially out-of-order webhook payloads.
4. Keep Clerk's allowlist from applying to sign-in on older Clerk instances. The
   beta list controls signup; removing an email must not erase an existing account.
5. Configure the policy through the operator-only Convex function. Example for
   development (replace these example emails; add `--prod` only for production):

   ```sh
   bunx convex run betaAccess:configure '{"enabled":true,"creatorEmails":["approved@example.com"]}'
   bunx convex run betaClerk:sync '{}'
   ```

   Inspect the scheduled action result in Convex. The action manages the **entire
   Clerk allowlist**, removing stale entries and domain-wide entries; maintain the
   creator list here rather than making separate Dashboard allowlist changes.
   Do not consider beta enabled until sync succeeds and the Clerk settings above
   have been verified. Clerk/API failures appear as failed scheduled actions and
   retry on the reconciliation cron. Configuration changes while a sync is running
   queue a new serialized pass.

6. Verify with an approved creator, a manager-added employee, and an unrelated
   address. The employee should sign up, verify their email, and land in their
   workplace without needing an invitation. They must be denied organization
   creation both in Clerk and by `hubs:create`. The unrelated address must be
   denied signup by Clerk itself, including OAuth/account-portal entry points.

Clerk organization admins remain trusted to manage Clerk memberships. If existing
admins must not delegate *Clerk-level* admin permissions, restrict those Clerk
permissions too. Workhal's central beta checks independently cap unapproved
owner/manager capabilities in the application. Editor access and explicitly
configured employee editing features continue to follow workplace permissions.

## Lift the restrictions without migrating accounts

```sh
bunx convex run betaAccess:configure '{"enabled":false,"creatorEmails":[]}'
bunx convex run betaClerk:sync '{}'
```

Then enable **Allow user-created organizations** in Clerk for future accounts.
Use the matching production deployment when opening production access.

The disabled policy bypasses the application beta checks. Synchronization disables
Clerk's signup allowlist and enables organization creation for every existing user,
including users who joined as employees. Existing accounts, user IDs, profiles,
assignments and memberships remain intact. Normal workplace roles still apply:
an employee does not become the owner of their employer's workplace, but can create
their own workplace. No account recreation or data migration is necessary. Reload
an already-open browser session to refresh Clerk's displayed creation controls.

## Source references

- [Clerk signup restrictions](https://clerk.com/docs/guides/secure/restricting-access)
- [Clerk user creation permissions](https://clerk.com/docs/reference/backend/user/update-user)
- [Clerk organization settings](https://clerk.com/docs/guides/organizations/configure)
