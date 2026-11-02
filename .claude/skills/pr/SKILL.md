---
name: pr
description: Use when writing a PR body in this repo. Loads /mattpocock-skills:pr for the structure and adds this repo's rules (changesets, breaking changes, Closes lines).
---

# PR bodies in this repo

Call the Skill tool with `mattpocock-skills:pr` and follow it: **Summary**, **Evidence**,
**Merge Danger**. These rules come on top:

- **Write the body to a scratch file**, not the repo, and pass it to `bin/ship --body-file`.
  Don't write `Closes #N` for the PR's own issue; `bin/ship` prepends it.
- **Merge Danger names the release effect**: which packages the changeset bumps and how, and
  every **breaking** change with what a caller does instead. All packages are pre-1.0, so a
  break ships as a `minor`.
- **Evidence** is the red-then-green test output (MSW request assertions count), or the
  regenerated-types diff for a spec sync. Don't paste the whole suite.
- **A promotion PR** (`feature/*` → `main`) lists `Closes #<n>` for every slice merged into
  the branch. GitHub closes issues only on merges into `main`, so this is what closes them. Add
  one line per slice as the slices land.
- Never include secrets, API keys or customer data.
