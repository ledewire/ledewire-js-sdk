---
name: commit
description: ALWAYS use this skill when committing code changes — never commit directly without it. Creates commits in this repo's conventional-commit format with the issue reference and agent attribution. Trigger on any commit, git commit, save changes, or commit message task.
---

# Commit Messages

Adapted from `ledewire/api`'s `/commit`. See [`/issue`](../issue/SKILL.md) for where commits
fit in the issue → PR flow.

## Prerequisites

```bash
git branch --show-current
```

**On `main` or a `feature/*` branch, stop. Don't commit and don't create a branch yourself.**
Issue branches come from `bin/worktree issue <n>` (step 1 of `/issue`), which links them to
the issue. Ask which issue the work belongs to. If none exists, file one first.

## Format

```
<type>(<scope>): <subject>

<body>

Refs #<issue>
Co-Authored-By: <agent model identity>
```

The header is required and the scope is optional. Keep every line under 100 characters.
Types: `feat`, `fix`, `test`, `refactor`, `style`, `chore`, `docs`, plus `ci`, `build` and
`perf` when they fit better. The scope is the area touched: a resource (`content`,
`merchant`), a package (`x402-client`) or a concern (`types`, `spec`, `auth`). Mark a breaking
change with `!` after the scope (`feat(seller)!: …`).

## Subject

- Imperative, present tense: "add", not "added"
- No trailing period, at most 70 characters

## Body

- Explain **what** and **why**, not how. Contrast with the previous behaviour when it helps
- Use real newlines, never a literal `\n` inside `-m` strings
- Never include secrets, API keys or customer data. Describe the symptom and reference the issue

## Footer

**`Refs #N` goes on commits; `Closes #N` belongs in the PR body**, which `bin/ship` writes.
With one place closing the issue, a revert or cherry-pick can't close it by accident.
Cross-repo references are fine: `Refs #74, ledewire/api#1675`.

When an agent mainly wrote the change, add a `Co-Authored-By:` line with its own model
identity. That is the only AI marker: no "Generated with…" prose in commits.

```bash
git commit -m "fix(auth): surface the API's message on a failed login" \
  -m "A 401 from a login route was treated as an expired session, so the caller got
'Session expired' and a pointless refresh.

Refs #66
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Principles

- One stable, independently reviewable change per commit
- The suite passes after every commit
- Generated files (`api.gen.ts`, `docs/api/`) go in the same commit as the change that
  regenerated them
