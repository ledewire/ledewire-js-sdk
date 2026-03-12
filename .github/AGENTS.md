# LedeWire JS SDK — AI Agent Context

This file provides architectural context for AI coding agents working in this repository.

## Repository Purpose

Monorepo for the official JavaScript/TypeScript SDK for the LedeWire API.
See `OVERVIEW.md` for the full design rationale and build order.

## Package Map

| Package            | npm name                  | Purpose                                                 |
| ------------------ | ------------------------- | ------------------------------------------------------- |
| `packages/core`    | (private — not published) | HTTP client, token manager, error classes, shared types |
| `packages/browser` | `@ledewire/browser`       | Buyer-facing SDK for browsers. CDN `<script>` tag + npm |
| `packages/node`    | `@ledewire/node`          | Full API surface for Node.js. Merchant + seller + buyer |

## Key Files

| File                                            | Purpose                                                        |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `ledewire.yml`                                  | OpenAPI 3.1 spec — source of truth for all endpoints and types |
| `OVERVIEW.md`                                   | Architecture overview, design decisions, build order           |
| `packages/core/src/errors.ts`                   | `LedewireError` class hierarchy                                |
| `packages/core/src/http-client.ts`              | Fetch wrapper — auth injection, error mapping, 401 retry       |
| `packages/core/src/token-manager.ts`            | Proactive + reactive JWT refresh, deduplication                |
| `packages/core/src/types.ts`                    | Shared TypeScript types from the OpenAPI spec                  |
| `packages/node/src/client.ts`                   | `createClient()` factory for Node.js                           |
| `packages/browser/src/client.ts`                | `init()` factory for browsers                                  |
| `packages/browser/src/local-storage-adapter.ts` | Optional persistent token storage                              |

## Client Namespace Structure

### Node client (`createClient()`)

```
client.auth.*              buyer auth (email, google, api-key, refresh, password reset)
client.merchant.auth.*     merchant auth (email, google) + store listing
client.merchant.users.*    team management (invite, list, remove)
client.merchant.content.*  content CRUD + search
client.merchant.sales.*    sales list, summary, buyer list, store config
client.seller.content.*    seller content (CRUD, search)
client.seller.sales.*      seller sales + summary
client.wallet.*            balance, payment sessions, transactions
client.purchases.*         create, list, verify purchases
client.content.*           public content with access info
```

### Browser client (`init()`)

```
lw.auth.*       signup, login (email + google), logout, password reset
lw.checkout.*   checkout state machine for a content item
lw.wallet.*     balance, fund (payment session), transactions
lw.purchases.*  create, list, verify
lw.content.*    content with access info
```

## Critical Patterns

### Token management is automatic

Never call token refresh manually. `TokenManager` handles it inside `HttpClient`.
The `onUnauthorized` callback is wired from `TokenManager.handleUnauthorized()`.

### Errors

All SDK errors are `instanceof LedewireError`. Branch on `err.statusCode` or use
the named subclasses (`AuthError`, `ForbiddenError`, `NotFoundError`, `PurchaseError`).

### Adding a new API endpoint

1. Update `ledewire.yml` if the endpoint or schema isn't there yet
2. Run `pnpm generate:types` — regenerates `packages/core/src/api.gen.ts` (never edit that file manually)
3. Add/update type aliases in `packages/core/src/types.ts` if the new types need re-exporting
4. Add the method to the correct namespace in `packages/node/src/resources/` or
   `packages/browser/src/resources/`
5. Write a Vitest test using MSW — see existing tests for patterns
6. Run `pnpm typecheck && pnpm test` — both must pass

### JSDoc is required on all exports

CI fails if public API members lack JSDoc. Every exported function, class,
interface, and type must have at minimum a one-sentence description.

## Development Commands

```bash
pnpm install           # Install all workspace dependencies
pnpm build             # Build all packages (Turborepo handles order automatically)
pnpm test              # Run all unit + boundary tests
pnpm test:coverage     # Run tests with coverage report (90% threshold enforced)
pnpm typecheck         # Type-check all packages
pnpm lint              # Lint all packages
pnpm lint:fix          # Auto-fix lint issues
pnpm format            # Format all files with Prettier
pnpm generate:types    # Regenerate api.gen.ts from ledewire.yml (run after spec changes)
pnpm changeset         # Create a changeset (required before merging feature PRs)
```

## Testing Conventions

- Tests colocated with source: `src/foo.ts` -> `src/foo.test.ts`
- Use **MSW** for all HTTP mocking in unit and boundary tests
- Minimum **90% line coverage** enforced in CI
- Integration tests (real API) require `INTEGRATION=true` env var and only
  run in the nightly workflow against staging

## DO NOT

- Do not call the real LedeWire API in unit tests — use MSW handlers
- Do not use `any` or `@ts-ignore` without a comment explaining why
- Do not bypass the 90% coverage gate in CI
- Do not add browser-only APIs (localStorage, DOM) to `packages/core` or `packages/node`
- Do not commit secrets, API keys, or tokens
- Do not add heavy dependencies to `packages/browser` without checking bundle size impact
