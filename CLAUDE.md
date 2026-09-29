@AGENTS.md

## Committing as the Ledewire bot identity

A session authenticates as `ledewire-claude-code[bot]` instead of a human when it's launched via
`ledewire-claude`. That credential reaches git one of two ways, and which one is in play decides
how you push. **Check, don't assume:**

```
git config --get credential.helper   # broker helper?
echo ${#GH_TOKEN}                    # 0 means unset
```

- **Broker credential helper** (`.ledewire-vm-shared/git-credential-ledewire`), which is what the
  shared colima VM uses. It fetches a fresh installation token from the host-side broker on
  _every_ git call, so auth never goes stale however long the session runs. `GH_TOKEN` is
  typically **empty** here, because the helper is the credential. Push with plain
  `git push origin <branch-name>`. A tokenized URL would interpolate `$GH_TOKEN` to nothing and
  fail.
- **Exported `GH_TOKEN`.** Push using the tokenized HTTPS URL:

  ```
  git push https://x-access-token:$GH_TOKEN@github.com/ledewire/ledewire-js-sdk.git <branch-name>
  ```

`gh pr create` and other `gh`/API calls work under both. Because the broker mints a token per
call, an App permission change takes effect immediately, with no session to restart.

Any other session (a plain host session with no bot credential) pushes normally via
`git push origin`.

### Never push a bare `HEAD`

Name the branch explicitly, and name the worktree explicitly whenever the cwd might not be it:

```
git -C <worktree path> push origin <branch-name>
```

A bare `HEAD` pushed from the wrong checkout fast-forwards the remote branch to whatever that
checkout is sitting on (usually `main`) and **exits 0**. Every worktree shares the same origin URL,
so nothing in the push output reveals it except the SHAs. Always confirm afterwards that the remote
branch is at the SHA you meant:

```
gh api repos/ledewire/ledewire-js-sdk/branches/<branch-name> --jq .commit.sha
```

A `!` command the user runs executes in _their_ terminal's cwd (the launch checkout), not the
agent's worktree.

### Workflow files

In the api repo the App installation holds **`Workflows: Read and write`** (granted 2026-09-08),
which lets the bot push changes under `.github/workflows/`. This repo has not pushed a workflow
change as the bot yet, so that permission is unverified here. If a push is rejected with
`refusing to allow a GitHub App to create or update workflow`, the installation lacks the
permission for this repo. That's a human fix in the App's settings on GitHub, not something a
session can route around.

When setting the bot's local git identity (`git config user.name`), quote the value.
`ledewire-claude-code[bot]` unquoted lets the shell glob-expand `[bot]`, silently dropping the
closing bracket into `.git/config` with no error.

## Running Node/pnpm: always through `bin/dexec`

This repo's runtime (Node 20, pnpm) lives in Docker, not on the host. Do not install Node
packages or pnpm on the host. Run pnpm/Node commands through `bin/dexec`, e.g.:

```
bin/dexec pnpm test
bin/dexec pnpm --filter @ledewire/node test
bin/dexec pnpm lint
```

`bin/dexec` execs into the current worktree's `sdk` container via `docker compose -f
docker/compose.yaml`. Each worktree created with `bin/worktree issue <number>` or `bin/worktree
new <branch>` has its own `.env` (COMPOSE_PROJECT_NAME, WORKSPACE_DIR, GIT_COMMON_DIR), so this
works the same whichever worktree you're in. Dependencies are pre-fetched into the image from
`pnpm-lock.yaml`, so a new worktree's `pnpm install` links from the image rather than the registry.

In the primary checkout (no `.env`), start the stack with `docker compose -f docker/compose.yaml up
-d --build`. The first install there must be `bin/dexec env CI=true pnpm install`: a `node_modules`
left by a host install makes pnpm ask to purge it, and without a TTY that prompt hangs forever.

## Host vs. container boundary

Git and GitHub operations (`git commit`, `git push`, `gh pr create`, `bin/worktree` itself) run
on the host, never through `bin/dexec`: the container has no `gh` and no GitHub credentials.
Builds, tests, lint and codegen run in the container.

The pre-commit hook runs `pnpm lint-staged`, falling back to `bin/dexec pnpm lint-staged` when
the host has no pnpm, so the worktree's container must be running to commit. That works because
the container mounts the worktree and the repo's `.git` dir at their host paths, so git runs
inside it too.

## Working in an isolated worktree

`bin/worktree issue <number>` (or `bin/worktree new <branch> [base]`, default base `main`) creates
a worktree under `../ledewire-js-sdk-worktrees/`, builds its container, installs dependencies,
and prints an `EnterWorktree path=...` line. Pass **`path=`, never `name=`**: `name=` creates a
worktree with no `.env` and no container.

The first build takes a few minutes and can run past a 2-minute tool timeout. **A timeout is not
a failure.** Run it in the background and read its output, and check with `bin/worktree path
<number>` before re-running.

- `bin/worktree sync`: from inside a worktree, rebase onto the `BASE_BRANCH` recorded in `.env`
- `bin/worktree list`: all managed worktrees and whether their containers are running
- `bin/worktree rm <branch>`: tear down the container and image, remove the worktree, and delete
  the local branch unless it holds unmerged commits

To move between worktrees in one session, `ExitWorktree action=keep` back to the launch
directory first. `ExitWorktree` does not stop containers or remove the worktree; `bin/worktree rm`
does that, from the host.
