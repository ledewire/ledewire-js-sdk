---
name: issue
description: Work a GitHub issue end to end — pick it up into an isolated worktree, build it test-first, review it, ship it as a PR, and merge or hand over. Invoke explicitly as /issue <number>; never fires on its own.
disable-model-invocation: true
---

# Work a GitHub issue

Invoked as `/issue <number>`. Adapted from `ledewire/api`'s and `ledewire/demo-buyer-site`'s
`/issue`. Git and `gh` run on the host; Node and pnpm run in the worktree's container through
`bin/dexec` (see `CLAUDE.md`).

**Every change ships against an issue.** No issue yet? Stop and file one with the user
(`gh issue create`) before writing code, with acceptance criteria that can fail (see
[Writing a criterion that can fail](#writing-a-criterion-that-can-fail)).

`bin/ship` enforces the tail of this pipeline and aborts with the fix in the message.
**If it aborts, read what it says and do that** — it knows more than this file.

## 1. Start

```bash
gh issue view <number>       # the base is `main` unless the body has a Base branch section
bin/worktree issue <number>  # run_in_background: the docker build outlasts a 2-minute timeout
```

This links a branch to the issue (`gh issue develop`), adds a worktree for it under
`../ledewire-js-sdk-worktrees/` from `origin/<base>`, writes the worktree's `.env`
(`ISSUE_NUMBER`, `BASE_BRANCH`, compose project), builds its container and installs
dependencies. It ends with an `EnterWorktree path=...` line. Pass `path=`, never `name=`. If
`EnterWorktree` refuses, `cd` into the path, and run git there as plain commands, not `cd … &&`
compounds. **A timeout is not a failure**: check `bin/worktree path <number>` before re-running.

**Never hand-create the branch.** That skips the issue link and the `.env`, and `bin/ship`
reads the issue and base from `.env`. Act on any `!!` line it prints (open PRs already
targeting the same base, for example).

**Read source only from inside the worktree.** The launch checkout is whatever branch it was
left on and may be far behind `origin/<base>`.

Already in this issue's worktree (`git branch --show-current` starts with `<number>-`)? Skip to 2.

## 2. Implement

Assume the issue is stale before you design against it. Check each acceptance criterion
against the current code first: say so if one is already met or already wrong, before
reimplementing it. Re-read whatever your design rests on, not only the files the issue names.

Work test-first with `/mattpocock-skills:tdd`, one behaviour at a time. Follow
`.github/AGENTS.md` (MSW for HTTP, co-located `*.test.ts`, JSDoc on every export).

```bash
bin/dexec pnpm --filter @ledewire/node exec vitest run src/resources/content.test.ts   # the loop
bin/dexec pnpm typecheck && bin/dexec pnpm lint
```

Keep the red and green output of the tests that pin the behaviour. The PR body's **Evidence**
section needs a before and after.

Every change to a published method also touches:

- **`createMockClient()`** in `@ledewire/node/testing`: a new or removed method needs its stub
  added or removed (the parity test fails otherwise).
- **Generated files:** after changing either `ledewire.yml` copy, run
  `bin/dexec pnpm generate:types`. After changing any export, run `bin/dexec pnpm docs`. Commit
  both. Edit `api.gen.ts` only by regenerating it.
- **Docs:** the related `docs/guides`, `examples/`, the package README and its `llms.txt`.
- **A changeset**, written by hand as `.changeset/<short-slug>.md` (`pnpm changeset` is
  interactive):

  ```markdown
  ---
  '@ledewire/node': minor
  '@ledewire/browser': minor
  ---

  One line per change, as it should read in the CHANGELOG. Breaking changes start with **Breaking:** and say what callers do instead.
  ```

  **All packages are pre-1.0, so a breaking change is `minor`, never `major`.** `major` would
  publish 1.0.0. New features are `minor`, fixes are `patch`. A change only in
  `packages/core` bumps the packages that consume it. Docs, CI-config or tests-only work carries no
  changeset: label the PR `skip-changeset` and ship with `SHIP_SKIP_CHANGESET=1`.

Commit with `/commit` (conventional format, `Refs #<number>` footer).

## 3. Confirm the ticket is done

Re-read the acceptance criteria against the working tree, one at a time, and say for each
whether it is met. Quote what makes it true; don't just assert it.

```bash
gh issue view <number>
```

This is not the check from step 2. That one ran before any code existed. Nothing else
reconciles the diff against the checklist: the reviews below look for defects, not coverage.

An unmet criterion is ordinary: go meet it. **A criterion that _cannot_ pass on this issue is a
stop.** Get the issue amended, or the criterion moved to the issue that owns it, before shipping.

## 4. Review

```
/mattpocock-skills:code-review
/security-review
```

**Both are mandatory, on every issue.** Point them at the branch diff against the base
(`origin/<base>...HEAD`, where the base is `BASE_BRANCH` in `.env`), not against `main`. On a
feature-branch slice, a diff against `main` hands the reviewer every earlier slice too.

Fix or consciously accept what they find (say which, and why), commit, then record it:

```bash
bin/ship --reviewed
```

The stamp is for the current `HEAD`. Any commit after it (a CI fix, a review fix) needs a
fresh stamp, and a fresh review if the change is more than mechanical.

## 5. Ship

Write the PR body with `/mattpocock-skills:pr` to a scratch file, not the repo. Don't add
`Closes #N`; `bin/ship` does.

```bash
bin/ship --body-file <path>   # run_in_background: the full check run outlasts a 2-minute timeout
```

It refuses an unreviewed `HEAD`, a stale base (`bin/worktree sync` refreshes it) or a missing
changeset. It runs the CI checks in the container, pushes, verifies that the remote branch is
at `HEAD`, and opens a **draft** PR against the base with `Closes #<number>`. Re-running is
safe: it reuses the PR and leaves its body alone. After new commits, revise the body with
`gh pr edit --body-file <path>`.

**Never hand-run `git push` or `gh pr create` for issue work.**

Then wait for CI and mark the PR ready on green:

```bash
gh pr checks <pr> --watch && gh pr ready <pr>
```

## 6. Merge or hand over: it depends on the base

**Base `feature/*` (a slice):** once every check is green and the reviews are recorded,
**merge it yourself**:

```bash
gh pr checks <pr>             # must exit 0: no ruleset guards feature/**, so this is the gate
gh pr merge <pr> --merge      # not --delete-branch: inside a worktree its local checkout fails
gh api -X DELETE repos/ledewire/ledewire-js-sdk/git/refs/heads/<branch>
gh api repos/ledewire/ledewire-js-sdk/branches/<base> --jq .commit.sha   # confirm it moved
```

Nothing on GitHub stops a red PR merging into a feature branch, so never merge while
`gh pr checks` reports a failing or pending check.

GitHub closes issues only on merges into `main`, so the slice's issue stays open. The
feature branch's promotion PR into `main` lists `Closes #<n>` for every slice. Add this
slice's line to that PR's body if the PR is already open. A human runs the code review and
security review on the whole feature branch and merges the promotion PR.

**Base `main`:** **do not merge.** Give the user the PR URL. A human merges it, which closes
the issue.

Either way, leave the worktree afterwards and tear it down from the launch checkout:

```bash
bin/worktree rm <branch>
```

## Writing a criterion that can fail

- **Name the mechanism, not an artifact**: the method, request, type or observable result, so
  a wrong implementation fails it. "Search is supported" can't fail. "`content.search` sends
  `POST /v1/content/search` with `cursor` in the body (MSW asserts it)" can.
- **Same kind of work as the ticket**: a code change's criteria can be checked by reading the
  diff and running the suite. A release or a production check is its own issue.
- **Not owned by another issue**: if another issue has to change for this criterion to become
  false, it isn't this issue's. Delete it and link the dependency instead.

## Stop and ask the user

- There is no issue for the work
- The issue and its acceptance criteria disagree
- A criterion cannot pass on this issue however the work is done (step 3)
- `bin/worktree` or `bin/ship` aborts and its message doesn't tell you what to do
- A PR into `main` is ready: that merge is the user's
