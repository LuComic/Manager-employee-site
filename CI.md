# Implementation and Pull Request Workflow

Follow this workflow for every feature, bug fix, refactor, or other code
change.

The implementation agent's deliverable is a pushed task branch and a pull
request. The agent must not merge the pull request or modify `main`.

## 1. Isolate the task

Start each implementation task in Codex **Worktree** mode, based on `main`.
Codex creates and manages the isolated worktree. If the task is already running
in a Codex-managed worktree, use it; do not create another nested worktree with
`git worktree add`.

Never run concurrent implementation agents in the shared **Local** checkout.
Local mode is acceptable for one sequential task only, and that task must
create and switch to its own branch before editing.

Before editing in a managed worktree, fetch the remote state and verify that
the task starts cleanly from the current remote `main`:

```sh
git fetch origin
test -z "$(git status --porcelain)"
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

Exception: when addressing feedback on or adding to an existing pull request,
continue on that pull request's existing task branch. Fetch the remote state
and require a clean worktree, but do not require `HEAD` to equal `origin/main`.
Confirm the branch belongs to the intended pull request before editing.

For the Local-mode fallback, create the task branch directly from
`origin/main`:

```sh
git fetch origin
test -z "$(git status --porcelain)"
git switch -c codex/<short-task-name> origin/main
```

If either check fails, stop and report the problem. Do not reset, discard, or
overwrite existing work.

## 2. Implement and verify

Make only the requested changes. Use `bun` and `bunx` for project commands.
Run the relevant tests, lint checks, type checks, or build before committing.

When work in a Codex-managed worktree is ready, use **Create branch here** and
name the branch `codex/<short-task-name>`. The shell equivalent for a detached
worktree is:

```sh
git switch -c codex/<short-task-name>
```

If the worktree is already on its unique task branch, keep using that branch;
do not create a second branch.

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

Every implementation branch must use the `codex/<short-task-name>` naming
pattern. Push only the task branch; the checks below refuse `main`, branches
outside the `codex/` namespace, and an empty name after the prefix:

```sh
TASK_BRANCH="$(git branch --show-current)"
test -n "$TASK_BRANCH"
test "$TASK_BRANCH" != "main"
test "${TASK_BRANCH#codex/}" != "$TASK_BRANCH"
test -n "${TASK_BRANCH#codex/}"
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
