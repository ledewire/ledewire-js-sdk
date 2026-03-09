# GitHub Copilot Instructions — LedeWire JS SDK

This is the official LedeWire JavaScript SDK monorepo.
See `.github/AGENTS.md` for full architectural context.

## Key facts for code generation

- All packages use **TypeScript strict mode** — no `any`, no `@ts-ignore` without comment
- Exports must have **JSDoc** — CI enforces this
- Tests use **Vitest** and **MSW** for HTTP mocking
- `packages/core` is private (not published) — shared by browser and node packages
- `@ledewire/browser` is browser-only (has DOM APIs), `@ledewire/node` is Node-only
- Token management is handled automatically by `TokenManager` — never call refresh manually
- All SDK errors extend `LedewireError` from `packages/core/src/errors.ts`
- API source of truth: `ledewire.yml` (OpenAPI 3.1) in the repo root
