```text
Implement the complete manager, employee-account, Clerk Organizations, employee-profile, invitation/claiming, and calendar-event employee flow for this project.

Repository:
 /Users/ainurakk/Documents/code stuff/onboarding-site

This is an existing application. Do not treat it as a greenfield project. Inspect and preserve its architecture, UI conventions, naming, data-access patterns, security behavior, tests, and code style.

## Existing external configuration

Clerk Organizations are already enabled in the Clerk Dashboard.

The current Clerk Organization membership mode is:

- Membership optional

Therefore:

- Do not ask me to enable Organizations.
- Do not switch Organizations to membership required.
- Do not assume that every signed-in user already has an active Organization.
- If changing a Clerk Dashboard setting becomes necessary, notify me before relying on that change.
- Use only Clerk’s included Organization functionality.
- Do not require Clerk’s Enhanced B2B Authentication add-on.
- Use the default Organization roles:
  - org:admin for managers
  - org:member for employees
- Assume the current limit of 20 authenticated members per Organization.
- Do not add Clerk Billing, Verified Domains, Enterprise SSO, or advanced Role Sets.

Whenever I need to perform something manually in Clerk, Convex, hosting, environment settings, or another dashboard:

1. Notify me immediately in commentary.
2. Explain why the action is required.
3. Give the exact dashboard page and exact value, JSON, URL, event, secret, or environment variable needed.
4. State whether you can continue working while I complete it.
5. Do not pretend the external action succeeded.
6. Complete everything else that is not blocked.
7. Include a consolidated “Manual actions still required” checklist in the final response.
8. Explain how I can verify each manual action.

## Mandatory project instructions

Before writing code:

1. Read AGENTS.md completely.
2. Read the relevant current Next.js documentation under:
   node_modules/next/dist/docs/

   This project uses Next.js 16.2.6. Its APIs and conventions may differ from older versions and from training knowledge.
3. Read:
   convex/_generated/ai/guidelines.md

   These instructions override prior assumptions about Convex APIs.
4. Inspect package.json and use the installed versions, including:
   - Next.js 16.2.6
   - React 19.2.4
   - @clerk/nextjs 7.5.20
   - Convex 1.42.3
5. Use bun and bunx for all package and project commands.
6. Use the available Clerk and Convex skills where appropriate.
7. Verify current Clerk behavior against official Clerk documentation.
8. Preserve unrelated changes in the worktree.
9. Use apply_patch for file changes.
10. Do not use destructive Git or filesystem commands.

First inspect the existing implementation and produce a concise implementation plan. Then implement the feature end to end unless blocked by a required manual action.

## Scope

Implement:

- One Clerk Organization per workplace/hub
- Manager Organization membership and authorization
- Employee Organization membership and authorization
- Convex employee profiles
- Manager-created employee profiles
- Employee invitations
- Secure employee profile claiming
- Employee activation and deactivation
- Multiple managers through org:admin
- Multiple workplace memberships and active Organization handling
- Replacement of the calendar event’s free-text “Responsible person” with linked “Employees”
- Manager UI for adding one or more employees to calendar events
- Calendar display of the employees connected to an event
- Existing-hub migration from single owner to Organization membership
- Preservation of accountless shared hub access

Do not build:

- Generic employee-to-content relationships
- Work-item systems
- Employee progress tracking
- Completion or acknowledgement tracking
- Due dates
- Personal work dashboards
- Task functionality
- Guide-to-employee functionality
- Document-to-employee functionality
- Announcement-to-employee functionality

The only employee-to-content relationship in this implementation is between employee profiles and calendar events.

## Current behavior to preserve

The application currently has:

- Clerk authentication for the manager area
- One manager/owner identity associated with a Convex hub
- A shared employee-facing knowledge base
- Public or restricted hub access
- Restricted accountless access through:
  - a shared employee join code
  - a private bearer link
- Published workplace content such as:
  - guides
  - calendar events
  - announcements
  - documents
  - categories
  - FAQs
- Convex as the application database
- Content scoped by hubId
- A manager interface
- A separate employee-facing knowledge-base interface
- ConvexProviderWithClerk
- Existing authorization and anonymous-access tests

Relevant files include, but are not limited to:

- convex/schema.ts
- convex/hubs.ts
- convex/content.ts
- convex/search.ts
- convex/lib/access.ts
- convex/lib/snapshot.ts
- convex/access.vitest.ts
- convex/auth.config.ts
- lib/operations.ts
- components/providers/operations-provider.tsx
- components/providers/convex-client-provider.tsx
- components/operations/hub-access-gate.tsx
- components/manager/access-manager.tsx
- components/manager/manager-shell.tsx
- components/manager/event-manager.tsx
- components/calendar/event-detail.tsx
- app/manager/layout.tsx
- app/sign-in/
- app/sign-up/

Inspect all affected code before deciding on exact implementation details.

Accountless public and restricted access must continue working. A guest with the shared join code or private link must not be forced to create an account merely to read common published hub content.

## Source-of-truth boundaries

Use the following ownership model.

### Clerk user

A Clerk user represents a real person’s authentication identity.

Employees must create and control their own Clerk accounts. A manager must never create or control an employee’s password.

Clerk owns:

- Authentication
- Sessions
- Verified email or phone identities
- Organization membership
- Organization invitations
- Organization role
- Active Organization context

### Clerk Organization

Each workplace/hub corresponds to exactly one Clerk Organization.

The Organization represents workplace membership and coarse authorization. It does not store the workplace’s content or employee work data.

Use:

- org:admin for managers
- org:member for employees

Do not use Clerk roles for:

- department
- job title
- employee status
- event participation
- internal profile fields

Do not depend on Clerk Organization slugs being enabled. Store and use the Clerk Organization ID. Continue using the application’s existing hub slug for application URLs.

### Convex hub

The Convex hub remains the source of truth for:

- workplace identity inside the application
- workplace settings
- shared content
- public/restricted access settings
- join-code and private-link access

Add a unique relationship between:

- Clerk Organization ID
- Convex hub ID

Every authenticated hub operation must resolve or verify the hub through the active Organization.

Never trust a client-supplied hubId or organizationId without server-side authorization.

### Convex employee profile

Create a dedicated employee-profile model in Convex.

An employee profile represents a person inside one workplace. It can exist before the person creates a Clerk account.

Include the fields needed for at least:

- hubId
- optional linked Clerk user ID
- display name
- optional email
- optional department/team
- optional job title
- status:
  - unclaimed
  - invited
  - active
  - deactivated
- createdBy
- createdAt
- updatedAt
- invitedAt where applicable
- activatedAt where applicable
- deactivatedAt where applicable

Add suitable indexes and uniqueness protections.

Prevent one Clerk user from being linked to multiple active employee profiles within the same hub.

A person may have separate employee profiles in different Organizations if they work in multiple workplaces.

Do not duplicate Clerk Organization role as an independent source of authorization in Convex. Clerk membership and role must remain authoritative.

Managers may also have employee profiles when needed for display or event selection, but manager authority must still come from org:admin.

Employee profile lists, email addresses, internal statuses, and other private details must never be returned to accountless guests.

## New manager and workplace flow

Implement a coherent new-manager onboarding flow.

When a manager creates a workplace:

1. The manager signs in with their own Clerk account.
2. The application creates a Clerk Organization programmatically.
3. The manager becomes the Organization’s admin/creator.
4. The application creates the Convex hub.
5. The Convex hub stores the Clerk Organization ID.
6. The Organization becomes active in the manager’s Clerk session.
7. The manager enters the manager area for that hub.

This flow must be idempotent and resilient to partial failure.

Prevent duplicate hubs or duplicate Clerk Organizations when a request is retried.

Because Organization membership is optional, a newly signed-in manager may initially be using their Clerk Personal Account. Handle this explicitly.

Do not automatically create an Organization for an employee accepting an invitation. They must join the manager’s existing Organization.

If Clerk session-task, redirect, or token configuration is required, notify me with exact Dashboard instructions.

## Existing manager and hub migration

The current application associates a hub with:

- ownerSubject
- ownerTokenIdentifier

Current manager authorization is effectively single-owner authorization.

Create a safe, idempotent migration path:

1. Existing managers retain access throughout rollout.
2. Create one Clerk Organization for each existing hub.
3. Add the existing owner as org:admin.
4. Store the Clerk Organization ID on the hub.
5. Make the Organization available and active for the manager.
6. Preserve legacy ownership fields during a transitional period.
7. Support legacy authorization only where necessary during migration.
8. Do not remove legacy ownership fields until all hubs are mapped and tests confirm the new authorization path.

If production migration requires a command, script, internal action, or dashboard operation:

- make it idempotent
- explain exactly what it changes
- do not run it against production without notifying me
- include a dry-run or inspection path where practical

## Organization and route authorization

Replace the effective one-owner manager model with Organization membership authorization.

### org:admin

An Organization admin can:

- access manager routes for the active Organization’s hub
- manage hub content
- manage employee profiles
- send and revoke employee invitations
- create and revoke personal claim links
- add and remove employees from calendar events
- activate and deactivate employees
- promote another Organization member to admin
- demote an admin where safe
- remove members where safe

### org:member

An Organization member can:

- access the authenticated employee-facing hub
- read common published content
- see the employees displayed on published calendar events
- switch between workplaces they belong to
- update their own permitted profile fields only if explicitly supported

An org:member must never:

- access manager routes
- use manager mutations
- manage employee profiles
- modify event employee links
- read private data belonging to other profiles
- access a different Organization’s hub

### Accountless guest

A guest can:

- retain existing public hub access
- retain existing shared-code access
- retain existing private-link access
- read the same common published content currently available
- see only the limited employee display information intentionally included on a published event

A guest must never receive:

- employee profile records
- employee email addresses
- departments unless explicitly published
- internal profile statuses
- Organization membership records
- pending invitations
- claim records
- manager-only data

Authorization must be enforced server-side in Convex and server routes. Hiding controls in the UI is not sufficient.

## Active Organization behavior

Support users who belong to more than one Organization.

The active Clerk Organization determines the active authenticated hub.

Do not assume a user owns only one hub.

Provide a workplace/Organization switcher where appropriate and style it consistently with the existing application.

When the active Organization changes:

- the manager or employee context must update
- Convex queries must use the refreshed Clerk token
- stale data from the previous hub must not remain visible
- manager access must depend on the role in the newly active Organization

Research Clerk Core 3’s current active-Organization session-token format. Do not assume legacy claim names without verification.

If Convex requires Clerk session-token customization to receive Organization context, notify me before depending on it. Provide:

- exact Clerk Dashboard path
- exact claims JSON
- exact expected claim names
- how to confirm the token contains them

Consider Clerk’s multi-tab active-Organization behavior and use the supported token acquisition mechanism.

## Employee creation and email invitation flow

Implement a profile-first invitation flow.

### Manager flow

1. Manager opens an Employees section.
2. Manager creates an employee profile.
3. The profile can exist before the employee has an account.
4. If an email is provided, the manager can send a Clerk Organization invitation.
5. The invitation targets the hub’s Clerk Organization.
6. The invitation role is org:member.
7. Correlate the invitation with the employee profile using safe opaque metadata or another securely verified mechanism.
8. Do not place sensitive employee data in public Clerk metadata.
9. Display invitation state where available:
   - not sent
   - pending
   - accepted
   - expired
   - revoked
   - failed
10. Support safe resend and revoke operations.

### Employee flow

1. Employee opens the invitation.
2. Employee signs into an existing Clerk account or creates their own account.
3. Clerk adds the account to the correct Organization.
4. The accepted Organization membership is linked to the precreated Convex employee profile.
5. The profile becomes active.
6. The Organization becomes active in the session.
7. The employee reaches the shared workplace hub.

Handle:

- employee already has a Clerk account
- employee is already signed in
- invitation opened while signed into the wrong account
- employee is already an Organization member
- invitation expired
- invitation revoked
- manager retries invitation creation
- profile is already claimed
- duplicate email entered
- Clerk succeeds but Convex update fails
- Convex succeeds but Clerk call fails
- membership is removed outside the application
- repeated or delayed webhook events

Use idempotent server-side operations and recoverable states.

Do not rely solely on an eventually consistent webhook for the immediate invitation-acceptance experience.

## Personal claim-link flow

The existing shared workplace join code must not claim a named employee profile.

The shared code proves that someone may read the workplace hub. It does not prove that they are a specific employee.

Implement a separate employee-specific claim flow:

1. Manager creates an unclaimed employee profile.
2. Manager generates a unique high-entropy claim link.
3. Store only a hash of the claim credential.
4. Record:
   - profile ID
   - hub ID
   - expiration
   - createdAt
   - createdBy
   - revokedAt where applicable
   - consumedAt where applicable
5. Claim links must be:
   - single-use
   - expiring
   - revocable
   - resistant to enumeration
6. Opening the link can show limited workplace/profile context.
7. Completing the claim requires Clerk authentication.
8. After authentication:
   - validate the token
   - ensure it is unused and unexpired
   - link the Clerk user to the employee profile
   - add the Clerk user to the correct Organization as org:member
   - activate the profile
   - consume the token
9. Prevent the same account or token from claiming multiple profiles.
10. Make retries safe after partial Clerk/Convex failure.

Never substitute the shared join code for this personal claim credential.

## Employee deactivation and Organization removal

Implement safe employee deactivation.

When an admin deactivates an employee:

- remove their Clerk Organization membership
- mark the Convex profile deactivated
- preserve the profile for historical calendar records
- revoke pending invitations
- revoke unused claim links
- prevent further authenticated access to the workplace
- do not delete the employee’s global Clerk account
- do not hard-delete the employee profile

External Clerk and Convex writes cannot be one transaction. Handle partial failure and make the operation safely retryable.

If an employee is already connected to past events, preserve those event links and their display name.

Deactivated employees should not normally appear in the picker for new calendar events, but existing events may continue showing them for historical accuracy.

## Manager promotion and demotion

Support multiple managers through Clerk Organization roles.

Promotion:

- update the Organization member’s role to org:admin
- manager access must follow the Clerk role
- refresh/reload the supported session context if required

Demotion:

- update the role to org:member
- remove manager access
- handle stale-session behavior correctly

Prevent removal or demotion of the last Organization admin without a deliberate recovery path.

Do not authorize managers through a Convex-only boolean.

## Employee management UI

Add an Employees area consistent with the existing manager interface.

Include:

- Employees navigation item
- Employee list
- useful search/filtering
- employee status badges:
  - unclaimed
  - invited
  - active
  - deactivated
- create employee form
- employee detail page, drawer, or dialog consistent with current patterns
- invitation controls
- claim-link controls
- Organization role display
- promote/demote controls
- deactivate action with confirmation
- clear loading, empty, error, and retry states

Reuse existing:

- ManagerHeading
- cards
- badges
- dialogs
- confirmation components
- buttons
- fields
- toasts
- spacing and typography
- loading and empty-state patterns

Do not introduce another component library or unrelated design style.

Normal customer managers must manage employees inside this application. They should not need Clerk Dashboard access.

## Calendar event employee feature

Replace the current free-text “Responsible person” event field with an “Employees” field connected to real Convex employee profiles.

The current implementation uses an event `owner` string in multiple places, including the schema, event mutations, snapshots, search, seed data, manager event editor, and event detail UI. Inspect every use before changing it.

### Data model

Use a normalized relationship such as an eventEmployees table rather than storing an unbounded array of employee IDs on the event.

Each relationship should include at least:

- hubId
- eventId
- employeeProfileId
- addedAt
- addedBy

Add appropriate indexes for:

- employees connected to an event
- events connected to an employee
- preventing duplicate event/employee links
- hub-scoped validation

Every linked event and employee profile must belong to the same hub.

### Event editor

In the manager event editor:

- replace “Responsible person” text input with “Employees”
- provide a multi-select or similarly usable employee picker
- allow zero, one, or multiple employees
- show active, invited, and unclaimed profiles where appropriate
- exclude deactivated employees from new selection by default
- clearly show selected employees
- allow removing selected employees
- preserve selections while editing other event fields
- save event changes and employee links reliably
- handle retries idempotently

Use existing UI conventions. Do not introduce a large new select library unless genuinely necessary.

### Event display

Where the application currently displays “Responsible person”:

- replace it with “Employees”
- display the linked employee display names
- handle zero employees with an appropriate empty value
- support multiple names cleanly
- maintain responsive layout
- do not expose employee email addresses or internal profile details

Published event snapshots may include the minimal projection needed to render employee names. Do not return full employee-profile documents to guests.

Because the old free-text responsible-person value was part of published event content, preserve equivalent visibility by showing only linked display names on published events. Do not expose private employee information.

### Search

The existing event search references the free-text owner field.

Update search so removal of `owner` does not break event search.

Where practical and safe, preserve the ability to find events by connected employee display name. Do not make event queries unbounded or violate Convex query guidance.

### Event deletion

When deleting an event:

- remove its eventEmployees records in the same authorized flow
- preserve Convex transaction correctness
- ensure no orphan relationships remain

### Employee deactivation

When an employee is deactivated:

- preserve their links to existing events
- continue showing their display name on historical events
- prevent them from being selected for new events by default
- allow a manager to remove them from future events manually

## Existing event-owner migration

Do not silently discard existing `events.owner` values.

Do not automatically match free-text names to active employee profiles solely by display-name equality. Names are not stable identifiers and may collide.

Use a safe migration strategy.

A suitable approach is:

1. Widen the schema temporarily.
2. Add the eventEmployees relationship.
3. Preserve the previous text in an optional legacy field.
4. Show the legacy responsible-person text where no employee profiles have yet been linked.
5. Let the manager replace the legacy value with selected employees when editing.
6. Clear the legacy value after the manager deliberately saves employee selections.
7. Update seed/demo content coherently.
8. Make any migration idempotent.
9. Document when the legacy field can safely be removed.

If you choose a different strategy, it must preserve existing information and avoid unsafe name matching.

Update all related:

- validators
- mutations
- snapshots
- shared TypeScript types
- manager form state
- employee-facing rendering
- search logic
- demo seed data
- tests

## Guest and employee-facing behavior

Preserve the existing shared workplace desktop.

An accountless guest should continue to:

- open a public hub
- enter a restricted hub join code
- use a private hub link
- browse published content
- open published calendar events
- see the limited display names connected to those events

A signed-in Organization member should see the same shared content for their active hub.

Do not add a personal employee dashboard in this implementation.

Handle these UI states:

- public guest
- restricted guest
- signed-in manager
- signed-in employee
- signed-in user in Personal Account
- signed-in user with no Organization
- signed-in user with multiple Organizations
- invalid or expired invitation
- unlinked employee profile
- deactivated employee
- Organization membership-limit error

## Clerk and Convex synchronization

Document and enforce these sources of truth.

Clerk:

- user identity
- Organization
- Organization membership
- Organization role
- Organization invitation lifecycle

Convex:

- hub and settings
- hub-to-Organization mapping
- employee workplace profile
- claim-link records
- profile activation/deactivation
- calendar events
- event-to-employee relationships
- legacy responsible-person migration state

Do not store large or frequently changing application data in Clerk metadata.

If webhooks are used:

- verify the Clerk webhook signature
- keep the webhook route public but signature-protected
- treat request JSON as unknown and validate it
- call internal Convex functions for private writes
- make webhook processing idempotent
- tolerate duplicate and delayed events
- record enough information to prevent duplicate processing
- provide a reconciliation path for missed events

If webhook setup is required, notify me of:

- exact endpoint URL
- exact Clerk Dashboard page
- exact events to select
- signing-secret environment variable name
- where the secret must be configured
- how to send and verify a test event

## Security requirements

Pay particular attention to:

- cross-Organization data isolation
- cross-hub employee access
- active Organization validation
- client-supplied hubId tampering
- org:member calling manager mutations
- guest queries returning employee data
- invitation/profile mismatch
- shared join-code misuse
- claim-token replay
- claim-token enumeration
- expired or revoked claim tokens
- duplicate profile claiming
- stale sessions after role changes
- deactivated members retaining access
- last-admin removal
- open redirects in invitation handling
- webhook signature verification
- duplicate webhooks
- external API retry behavior
- event linked to an employee from another hub
- employee email leakage
- bearer credentials appearing in logs or query strings
- Clerk secret-key exposure
- Organization membership-limit errors

Store claim credentials as hashes rather than plaintext.

Keep Clerk secret keys server-side.

Use rate limiting for public claim attempts if appropriate. Follow current Convex guidance rather than building an unsafe ad hoc counter.

## Clerk included-tier constraints

Keep the implementation compatible with:

- no more than 20 Organization members
- default Admin and Member roles
- standard Organization invitations
- no Verified Domains
- no automatic domain enrollment
- no Enterprise SSO
- no advanced Role Sets
- no Clerk Billing

Handle the 20-member limit gracefully in the manager UI. Do not attempt to enable or purchase an add-on.

## Testing requirements

Extend the existing tests and add focused coverage.

At minimum, test:

1. Existing public accountless access still works.
2. Existing restricted join-code access still works.
3. Existing private-link access still works.
4. Guest queries cannot return employee-profile records.
5. Guest event responses expose only the intended employee display names.
6. One Organization cannot read another Organization’s hub.
7. org:member cannot use manager mutations.
8. org:admin can manage its mapped hub.
9. Client-supplied hubId cannot cross tenant boundaries.
10. Users with multiple Organizations resolve the correct active hub.
11. Manager can create an unclaimed employee profile.
12. Email invitation/profile correlation is idempotent.
13. An existing Clerk user can accept an invitation.
14. A new Clerk user can accept an invitation.
15. One user cannot claim multiple active profiles in the same hub.
16. Shared hub join code cannot claim an employee profile.
17. Personal claim token is hashed.
18. Personal claim token expires.
19. Personal claim token is single-use.
20. Personal claim token can be revoked.
21. Deactivated employee loses Organization access.
22. Deactivation preserves event history.
23. Promotion to org:admin grants manager access.
24. Demotion removes manager access.
25. Last-admin protection works.
26. Manager can add zero, one, or multiple employees to an event.
27. Duplicate event/employee links are prevented.
28. An employee from another hub cannot be linked to an event.
29. org:member cannot edit event employee links.
30. Event detail returns the correct employee display names.
31. Event deletion removes eventEmployees relationships.
32. Deactivated employees are excluded from new event selection.
33. Existing legacy responsible-person text is preserved.
34. Replacing legacy text with employee links works.
35. Event search no longer depends on the removed owner field.
36. Existing owner-to-Organization migration is idempotent.
37. Webhook processing tolerates duplicate events, if webhooks are implemented.

Follow the Convex testing instructions in:

convex/_generated/ai/guidelines.md

Also manually verify:

- new manager workplace creation
- existing manager migration
- manager employee creation
- employee invitation acceptance
- personal claim-link flow
- Organization switching
- manager promotion/demotion
- employee deactivation
- guest hub access
- manager event creation with employee selection
- event editing with multiple employees
- published event display
- legacy responsible-person display
- event deletion

## Validation commands

Use the existing project commands:

- bun run typecheck
- bun run lint
- bun test
- bun run test:convex
- bun run build

Run every unaffected validation command even if an external dashboard action prevents one integration test.

Do not suppress errors merely to make validation pass.

## Documentation and handoff

Update project documentation with:

- Clerk/Convex source-of-truth boundaries
- Organization-to-hub mapping
- manager onboarding
- existing-hub migration
- employee profile lifecycle
- email invitation flow
- personal claim-link flow
- manager promotion and demotion
- employee deactivation
- guest versus authenticated access
- calendar event employee relationship
- legacy responsible-person migration
- required environment variables
- Clerk Dashboard configuration
- webhook setup, if used
- local testing
- production deployment
- 20-member Organization limitation

At completion, report:

1. What was implemented.
2. Files changed.
3. Schema changes.
4. Migration requirements.
5. Authorization changes.
6. Clerk integration changes.
7. Event editor and display changes.
8. Tests and validation commands run.
9. Limitations or deferred items.
10. Exact manual actions I must perform.
11. How to verify each manual action.
12. Whether Organizations can remain optional.
13. Any production migration command that still needs my approval.

## Product decisions already made

Do not reopen these decisions unless implementation reveals a serious security or platform constraint:

- Clerk Organizations are already enabled.
- Organization membership remains optional for now.
- One Clerk Organization corresponds to one workplace/hub.
- Employees use their own Clerk accounts.
- Managers create workplace employee profiles, not employee passwords.
- Clerk owns identity, Organization membership, invitations, and roles.
- Convex owns hubs, employee profiles, claim records, events, and event employee links.
- Shared accountless hub access remains available.
- A shared workplace code never proves which employee someone is.
- Personal profile claiming requires an email invitation or unique secure claim link.
- Default Admin and Member roles are sufficient.
- Existing hubs and managers must be migrated safely.
- Customer managers manage employees inside this application, not Clerk Dashboard.
- The free-text calendar “Responsible person” field is being replaced by an “Employees” multi-select tied to real employee profiles.
- An event may have zero, one, or multiple employees.
- Existing responsible-person text must not be silently discarded.
- No other employee-to-content feature is part of this implementation.

Make reasonable implementation decisions consistent with these requirements. If a decision would materially change security, Clerk pricing, onboarding behavior, migration safety, or existing guest access, explain it before proceeding.
```
