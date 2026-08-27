---
name: concise-review
description: Describes how PR and other reviews should be created and what+how should be included in the output. Use when asked to review something, but not edit anything.
---

## What to review

When the user asks you to review a PR, branch or commits, but doesn't specify the PR number or branch name, just assume and continue in the currently selected branch/PR.

When asked to review a PR, also include the uncommitted changes in the review. If it makes the process easier, you can commit the current changes before starting a thorough review.

## What to note

Whatever you're reviewing, make sure to pay attention to:

- bugs
- edge cases
- bad code practices
- overly complex code
- bloat/excess cdoe
- threats
- vulnerabilities

## The output

Make the output a concise, straight to the point report with numbered findings, starting from the most important. Each issue should include:

- short and concise description of the problem
- files affected
- maybe an example if its an edge case
- the severity level.

When creating the output, remember that another agent will use that to tackle the listed issues. That's something to keep in mind, since another agent will also look at these issues, analyse and find the best solution, so your task isn't to create some Plan or a detailed solution yourself.

For the output, use an editable textfield component inside of the chat. That way I can make changes to the text myself.
