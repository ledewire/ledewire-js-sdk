@AGENTS.md

## Committing as the Ledewire bot identity

If `GH_TOKEN` is set in the environment (this session was launched via `ledewire-claude`), you
are authenticated as `ledewire-claude-code[bot]`, not a human. Push using the tokenized HTTPS
URL instead of `git push origin`:

```
git push https://x-access-token:$GH_TOKEN@github.com/ledewire/ledewire-js-sdk.git HEAD:<branch-name>
```

`gh pr create` and other `gh`/API calls pick up `GH_TOKEN` automatically — no change needed there.

If `GH_TOKEN` is not set, push normally via `origin` (SSH) as usual.

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
