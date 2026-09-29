# Approved beta creators and managers

Use the **production** Clerk instance. These settings are enforced by Clerk's API,
not merely by hiding buttons. Keep employee signup and existing guest access working.
Do not enable Clerk's global email allowlist: that also restricts ordinary employees.

## Approve a creator by email

1. Open Clerk Dashboard → Organizations → Settings. Turn **Allow user-created
   organizations** off. Also turn automatic first-organization creation off, and
   keep membership optional (the app supports personal accounts and guest access).
2. In Users, find the tester by their exact **verified** email address. Under
   **User permissions**, explicitly allow organization creation for this person;
   set a small creation limit (for example 1). Do not approve whole email domains.
3. Repeat for the approved email list. New/unapproved accounts can sign in but
   cannot create organizations. Creating an account alone never grants management.
4. Review existing users' creation overrides and existing organization admins:
   changing the global creation switch does not revoke existing memberships.

## Management is a separate permission

Only approved testers should have Clerk `org:admin`. This is the Workhal owner
role and controls organization members and workplace settings. Keep everyone else
as `org:member`. Workhal also stores its own employee access level: **viewer**,
**editor**, or **manager** (full content access). Give editor/manager only to
approved testers, and leave worker-editing switches off if employees must remain
read-only. Those permissions are enforced in Convex on protected operations.

**Boundary:** this is a manually maintained approval list using Clerk user
permissions and Workhal roles, not an automatic role-scoped email allowlist.
An approved organization admin is trusted to manage memberships and can promote
another person; Clerk's creation switch does not prevent that. If even approved
admins must be unable to delegate outside one central email list, a backend
allowlist plus restrictions on Clerk's membership-management permissions is needed.
Do not call a global signup allowlist or a hidden UI button a substitute for that.

To revoke a tester: disable their creation override, demote/remove their admin
memberships, lower their Workhal profile to viewer (or deactivate it), and revoke
active sessions when immediate removal is needed. Changing only the creation
permission does not remove existing owner/manager access.

## Verify and later open access

Using separate approved and unapproved test accounts, verify that the unapproved
account cannot create an organization through either the app or Clerk's account
portal, cannot reach owner settings, and cannot run protected manager operations.
Verify an ordinary employee can still accept an invitation and enter their workplace.
Guest links/codes intentionally remain usable. Do not send test invitations to real
people without authorization.

To open organization creation later, enable the global creation setting, review
per-user overrides and limits, and retain normal organization roles. There is no
application feature flag or hardcoded email list to remove.

Sources (checked 29 September 2026):
- https://clerk.com/docs/guides/organizations/configure
- https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions
- https://clerk.com/docs/guides/secure/restricting-access
