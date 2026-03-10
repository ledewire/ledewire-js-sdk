# Contributing to the LedeWire JS SDK

## Prerequisites

- **Node.js 20+** — use `nvm use` (`.nvmrc` is present)
- **pnpm 9+** — `npm install -g pnpm@9`

> **Tip:** This repo ships a devcontainer. Open it in VS Code or GitHub Codespaces
> for a fully configured environment with no local setup needed.

## Getting Started

```bash
git clone https://github.com/ledewire/ledewire-js-sdk.git
cd ledewire-js-sdk
pnpm install
pnpm build
pnpm test
```

## Development Workflow

1. `git checkout -b feat/your-feature`
2. Make changes in `packages/core/`, `packages/node/`, or `packages/browser/`
3. Add or update tests (90% coverage minimum)
4. `pnpm typecheck && pnpm lint && pnpm test` — all must pass
5. `pnpm changeset` — describe your change (patch/minor/major)
6. Commit the generated changeset file alongside your code changes
7. Open a PR against `main`

## Changesets

Every PR changing a published package (`@ledewire/browser` or `@ledewire/node`)
**must** include a changeset. Run `pnpm changeset` and commit the output.

Changes to `packages/core` automatically trigger a patch version bump on
both published packages via the internal workspace dependency.

## Code Style

| Rule                     | Enforcement               |
| ------------------------ | ------------------------- |
| TypeScript strict mode   | CI type-check             |
| No `any` without comment | ESLint                    |
| JSDoc on all exports     | ESLint                    |
| Prettier formatting      | CI format check           |
| 90% line coverage        | Vitest coverage threshold |

Run `pnpm format` before committing to avoid CI format failures.

## Releases

Releases are fully automated via [Changesets](https://github.com/changesets/changesets).

### How it works

```
Your PR (with .changeset/ file)
        │
        ▼ merge to main
Release workflow opens "Version Packages" PR
        │
        ▼ merge that PR
Release workflow publishes to npm + GitHub Release + API docs
```

### Step-by-step

1. **During your PR** — run `pnpm changeset` and commit the generated file in `.changeset/`
   - Select which packages changed: `@ledewire/browser` and/or `@ledewire/node`
   - Select bump type: `patch` (bug fix) · `minor` (new feature) · `major` (breaking change)
   - Write a one-line summary — this becomes the CHANGELOG entry
   - Changes to `packages/core` should surface as a bump on the consuming packages

2. **After merging to `main`** — the Release workflow automatically opens a
   **"Version Packages"** PR that bumps `package.json` versions and updates `CHANGELOG.md`

3. **To release** — review and merge the "Version Packages" PR. The Release workflow
   then publishes to npm, attaches the CDN bundle to the GitHub Release, and deploys the API docs

> **No changeset needed** for PRs that only touch docs, CI config, or tests.
> Add the `skip-changeset` label to the PR — the changeset check will be bypassed.

You never need to run `npm publish` manually.
