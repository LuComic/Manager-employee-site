# Product features

## Product direction

Expand the current worker manual into a simple operations hub for an establishment. The site should remain calm and easy to use on a shared workplace computer. Guides are still central, but the home page should also explain what is happening today.

Workers do not need accounts. Manager tools may be presented as a separate administration area, but the demo does not need real authentication, a database, or permanent storage.

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
- Let managers create, edit, publish, unpublish, and delete demo guides

The existing guide and category routes should continue to work.

### Calendar

Provide a shared operational calendar for information relevant to the whole establishment, such as:

- Private events and large reservations
- Training sessions
- Promotions and menu launches
- Deliveries and maintenance visits
- Inspections, holidays, and unusual opening hours

Support a clear month view and list view. Users should be able to move between dates, return to today, filter events, and open an event for its full details. Event details can include the time, location, responsible person, notes, attachments represented by demo data, and related guides.

Managers should be able to create, edit, publish, unpublish, and delete demo events.

### Announcements

Use announcements for temporary information that does not belong in the permanent manual. Examples include equipment problems, menu changes, inspections, and temporary entrance instructions.

Announcements may include:

- A title and short message
- Published and expiration dates
- A priority or pinned state
- An optional related guide or event
- Published or draft status

The employee-facing page should make active announcements easy to scan and should not emphasize expired or draft content. Managers should be able to create, edit, publish, pin, unpin, and delete demo announcements.

### Manager administration

Provide a separate, clearly labelled management area for maintaining demo content. It should include:

- A small overview calculated from current demo data
- Management views for guides, calendar events, and announcements
- Search and useful status filters
- Forms for creating and editing content
- Publish and unpublish actions
- Delete confirmation
- Clear save feedback
- A way to return to the employee-facing site

Manager changes should immediately update Today, Guides, Calendar, and Announcements for the rest of the current browser session. Refreshing the app may restore the original seed data.

## How the features connect

- Today summarizes published content from the other areas.
- Events and announcements can link to relevant guides.
- Updating shared state in Manager administration updates the employee-facing pages.
- Global search should include published guides, events, and announcements.
- Draft and expired content should remain hidden from employee-facing summaries.

## Demo constraints

- Use local React state and seeded mock data only.
- Do not add a database, API, real authentication, employee profiles, or permanent storage.
- Do not add checklists or a manager logbook.
- Every visible control should perform a useful demo action.
- Preserve the existing routes and working guide functionality while adding the new features.
- Follow `STYLE_GUIDE.md` throughout the implementation.
