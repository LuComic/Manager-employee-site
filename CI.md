# Implementation and Pull Request Workflow

Follow this workflow for every feature, bug fix, refactor, or other code
change.

The implementation agent's deliverable is a pushed task branch and a pull
request. The agent must not merge the pull request or modify `main`.

## 1. Isolate the task

Each implementation agent must work in its own Git worktree. Never run two
implementation agents in the same checkout, and never switch branches in the
primary checkout while another agent is using it.

Fetch the remote state and create a uniquely named task branch directly from
`origin/main`:

```sh
git fetch origin

TASK_BRANCH="codex/<short-task-name>"
TASK_WORKTREE="$(mktemp -d "/tmp/onboarding-site-${TASK_BRANCH##*/}.XXXXXX")"

git worktree add -b "$TASK_BRANCH" "$TASK_WORKTREE" origin/main
cd "$TASK_WORKTREE"
```

Do not create the task branch from a local `main`. Local `main` may contain
unpublished commits that do not belong in the pull request.

Before editing, verify that the worktree is clean and starts exactly at the
current remote `main`:

```sh
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

If either check fails, stop and report the problem. Do not reset, discard, or
overwrite existing work.

## 2. Implement and verify

Make only the requested changes. Use `bun` and `bunx` for project commands.
Run the relevant tests, lint checks, type checks, or build before committing.

Stage only the files that belong to this task:

```sh
git add <task-files>
git diff --cached
git commit -m "<concise description>"
```

Do not use `git add .` unless every changed and untracked file shown by
`git status` is intentionally part of this task.

Before pushing, inspect the complete pull-request scope:

```sh
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
git status --short
```

The log and diff must contain only this task's commits and files, and the
working tree must be clean.

## 3. Push and create the pull request

Push only the task branch:

```sh
git push -u origin "$TASK_BRANCH"
```

Create a draft pull request targeting `main`:

```sh
gh pr create \
  --base main \
  --head "$TASK_BRANCH" \
  --draft \
  --title "<pull request title>" \
  --body "<summary, verification performed, and any known limitations>"
```

Verify that the pull request exists and has the correct base and head:

```sh
gh pr view "$TASK_BRANCH" \
  --json url,state,isDraft,baseRefName,headRefName
```

The task is not complete until the agent reports:

- the branch name;
- the commit SHA;
- verification commands and results; and
- the pull request URL.

If pushing or pull-request creation fails, report the failure and stop. Do not
claim completion merely because the branch was pushed.

## 4. Stop before review or merge

After creating the pull request, stop. Pull-request review and merging are
separate tasks controlled by the user.

The implementation agent must not:

- commit or push directly to `main`;
- merge, squash, or rebase the task branch into `main`;
- merge or close the pull request;
- modify, reset, delete, or force-push another branch;
- include unrelated local commits or files in the pull request; or
- delete another agent's branch or worktree.
