# LedeWire JS SDK — AI Agent Context

> Full architectural context is in [`.github/AGENTS.md`](.github/AGENTS.md).
> This root file provides a quick-reference summary for agents that scan the
> repo root.

## What this repo is

Monorepo for the official JavaScript/TypeScript SDK for the LedeWire API — a
content marketplace platform. The SDK has two consumer-facing packages:

| Package             | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `@ledewire/browser` | Buyer flows (auth, wallet, purchases, checkout) for browsers. CDN IIFE bundle + ESM. |
| `@ledewire/node`    | Full API surface — merchant, seller, and buyer flows for Node.js server-side code.   |
| `packages/core`     | Shared internals (not published). HTTP client, TokenManager, error classes.          |

## Key conventions

- **TypeScript strict mode** — no `any`, no `@ts-ignore` without comment
- **All exported symbols must have JSDoc** — enforced by ESLint (`jsdoc/require-jsdoc`)
- **Tests**: Vitest + MSW. Run `pnpm test` (all packages) or `cd packages/<pkg> && pnpm test`
- **Coverage thresholds**: 90% lines/functions, 85% branches — enforced in CI
- **API source of truth**: `ledewire.yml` (OpenAPI 3.1) at the repo root
- **Error classes**: all extend `LedewireError` from `packages/core/src/errors.ts`
- **Token refresh**: handled automatically by `TokenManager` — never call refresh manually

## Where things are

```
packages/core/src/
  errors.ts        ← LedewireError hierarchy
  http-client.ts   ← fetch wrapper with auth injection, retry, error mapping
  token-manager.ts ← proactive + reactive JWT refresh with deduplication
  types.ts         ← shared types derived from ledewire.yml
  api.gen.ts       ← generated OpenAPI response types (do not edit)

packages/node/src/
  client.ts              ← createClient() factory
  resources/
    auth.ts              ← buyer auth
    merchant/{auth,users,sales,buyers,config}.ts
    seller/content.ts
    wallet.ts / purchases.ts / content.ts / checkout.ts

packages/browser/src/
  client.ts              ← init() factory + BrowserClient
  local-storage-adapter.ts
  resources/{auth,wallet,purchases,content,checkout}.ts
```

See `.github/AGENTS.md` for the full client namespace map, critical patterns,
and test conventions.

<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->

## Agent Kanban

Read `.agentkanban/INSTRUCTION.md` for task workflow rules.
Read `.agentkanban/memory.md` for project context.

If a task file (`.agentkanban/tasks/**/*.md`) was referenced earlier in this conversation, re-read it before responding.

<!-- END AGENT KANBAN -->
