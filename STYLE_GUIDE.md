# Styling guide

Use this guide when designing or reviewing interfaces in this project. The goal is a calm, welcoming, and easy-to-understand experience, especially for people who are not technically experienced.

## Core principles

- Prefer clarity over visual novelty.
- Keep pages spacious, consistent, and easy to scan.
- Use familiar interface patterns and plain language.
- Avoid cramped layouts, excessive information density, and unnecessary decoration.
- Make important actions and navigation obvious without making the interface feel loud.

## ShadCN and theme usage

- Use ShadCN components wherever an appropriate component already exists.
- Preserve the project’s ShadCN visual language instead of inventing a separate component system.
- Avoid arbitrary hex colors when a theme token can express the same role.
- Custom layout is encouraged, but component behavior, colors, and basic styling should remain consistent with ShadCN.

## Typography and casing

- Use natural sentence casing for all interface text.
- Do not force text to uppercase.
- Do not use fully capitalized eyebrows or small subheaders such as `START HERE`, `WORKSPACE`, or `YOUR RESOURCES`.
- Section labels may be used when helpful, but write them normally: `Start here`, `Workspace`, or `Your resources`.
- Avoid decorative letter spacing such as `tracking-widest` and `tracking-wider`.
- Buttons, badges, menu items, labels, dialog titles, and card titles should also use natural casing.
- Build hierarchy with font size, weight, color, and spacing rather than capitalization.
- Keep headings direct and descriptive. Avoid ornamental eyebrow text above a heading when the heading already provides enough context.

## Spacing

- Use a small, consistent set of Tailwind spacing values.
- Prefer the standard `2`, `4`, `6`, and `8` steps for gaps, padding, and margins.
- Use the same spacing for equivalent relationships throughout the interface.
- Do not introduce unusual values such as `mt-7` or `gap-5` unless the design clearly requires them.
- Related controls or icon-and-text pairs usually use `gap-2`.
- Closely related content groups usually use `gap-4` or `space-y-4`.
- Card and panel padding usually uses `p-6` or `p-8`.
- Major page sections usually use `space-y-8` or an equivalent consistent separation.
- A heading and its supporting description should use less space than the gap between separate sections.
- Responsive variants may change spacing, but equivalent components should still follow the same pattern.
- Use compact card spacing (`p-4` or the small Card size) for dashboards, summaries, and repeatable list rows.
- Use `p-6` for forms and detail panels that need more separation. Reserve `p-8` for long-form or intentionally spacious content rather than using it by default.

## Sizing and layout

- Prefer standard Tailwind sizes and simple grid utilities.
- Avoid arbitrary fractions, dimensions, font sizes, and line heights when a standard value works.
- Keep page containers consistent and let narrow layouts stack naturally.
- Do not rely on horizontal scrolling for primary navigation. Let a short navigation stack or wrap deliberately on narrow screens.

## Cards and visuals

- Use solid theme colors, borders, and subtle shadows. Avoid generic gradients, glows, and unnecessary decoration.
- Make the full card clickable when it leads to a single destination.
- Account for ShadCN's built-in card spacing so padding is not duplicated and backgrounds reach the card edges.
- Prefer compact rows over a grid of tall cards when the main content is a short label, status, or count.

## Information hierarchy and navigation

- Give each page one clear, specific `h1`. Treat the product or area name in the shared header as context, not as the page title.
- Make section headings visually distinct enough to scan quickly; do not let large numbers or card decoration overpower them.
- Keep the always-visible navigation focused on a few frequent destinations. Group secondary destinations in a clearly labeled menu such as `More tools`.
- Group disclosed navigation by user purpose, not by implementation details, and keep its order consistent across pages.
- Use progressive disclosure only for secondary choices. Do not hide information or actions that most users need to complete the current task.

## Interaction and content

- Keep controls easy to recognize, comfortably sized, and keyboard accessible.
- Use links for navigation and buttons for actions.
- Write short, direct copy for non-technical users.
- Avoid technical implementation language in interface copy when a task-focused explanation works instead.
- Avoid personal greetings or account-focused language in communal interfaces.
- Check that desktop and mobile layouts remain clear and readable.
