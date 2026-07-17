# Product features

## Product direction

Expand the current worker manual into a simple operations hub for an establishment. The site should remain calm and easy to use on a shared workplace computer. Guides are still central, but the home page should also explain what is happening today.

Workers do not need accounts. Managers use individual Clerk accounts, and Convex persists each hub's content. Every record is isolated by `hubId`, and only the owning Clerk identity can use that hub's manager tools.

## Product scope

### Today

The default page should act as a daily briefing. It should bring together:

- Today's events and important times
- Current and pinned announcements
- Recently updated or useful guides
- Quick links to the main areas of the site
- A small preview of what is coming next

Content should link to its full event, announcement, or guide instead of duplicating all its details on the page.

### Guides

Keep and expand the existing knowledge base:

- Browse guides by work area
- Search by guide title, description, or keyword
- Open clear step-by-step instructions
- Show useful details such as reading time and last update
- Connect relevant guides to events or announcements
- Let managers create, edit, publish, unpublish, and delete guides

The existing guide and category routes should continue to work.

### Calendar

Provide a shared operational calendar for information relevant to the whole establishment, such as:

- Private events and large reservations
- Training sessions
- Promotions and menu launches
- Deliveries and maintenance visits
- Inspections, holidays, and unusual opening hours

Support a clear month view and list view. Users should be able to move between dates, return to today, filter events, and open an event for its full details. Event details can include the time, location, responsible person, notes, Convex-hosted attachments, and related guides.

Managers should be able to create, edit, publish, unpublish, and delete events.

### Announcements

Use announcements for temporary information that does not belong in the permanent manual. Examples include equipment problems, menu changes, inspections, and temporary entrance instructions.

Announcements may include:

- A title and short message
- Published and expiration dates
- A priority or pinned state
- An optional related guide or event
- Published or draft status

The employee-facing page should make active announcements easy to scan. Expired and draft content is excluded by the Convex data-access layer. Managers should be able to create, edit, publish, pin, unpin, and delete announcements.

### Manager administration

Provide a separate, Clerk-protected management area for maintaining the owner's hub. It includes:

- A small overview calculated from current persisted data
- Management views for guides, calendar events, and announcements
- Search and useful status filters
- Forms for creating and editing content
- Publish and unpublish actions
- Delete confirmation
- Clear save feedback
- A way to return to the employee-facing site

Manager changes update Today, Guides, Calendar, and Announcements through Convex subscriptions and remain after refresh.

### Hub access

- Every hub has a stable public slug and is either public or restricted.
- Public hubs expose published employee content without an account.
- Restricted hubs accept a cryptographically generated join code or private-link credential.
- Anonymous access is remembered for 30 days and can be forgotten with “Leave hub”.
- Owners can switch modes, copy credentials, and rotate or revoke them.
- Convex stores only credential hashes and enforces access for reads, search, files, and mutations.
- Employees are never redirected to Clerk or required to create accounts.

## How the features connect

- Today summarizes published content from the other areas.
- Events and announcements can link to relevant guides.
- Convex subscriptions update employee-facing pages after manager changes.
- Global search should include published guides, events, and announcements.
- Draft and expired content should remain hidden from employee-facing summaries.

## Implementation constraints

- Store tenant data in Convex and enforce ownership and anonymous access inside Convex functions.
- Use Clerk only for manager accounts; do not add employee accounts or Clerk Organizations.
- Do not add plans, billing, subscriptions, invitations, advanced roles, or custom domains yet.
- Do not add checklists or a manager logbook.
- Every visible control should perform a useful action.
- Preserve the existing routes and working guide functionality while adding the new features.
- Follow `STYLE_GUIDE.md` throughout the implementation.

## Development seed and AI assessment

A signed-in development manager can create an owned hub containing the North & Pine seed once. There is no unauthenticated claim or takeover path.

Grounded staff Q&A is the preferred future AI enhancement, but it remains disabled until model credentials are available. It must retrieve only published records from the currently authorized hub and link answers to their sources. Convex-backed keyword search remains the active search implementation; there is no fake AI surface.
