# LedeWire JS SDK — AI Agent Context

This file provides architectural context for AI coding agents working in this repository.

## Repository Purpose

Monorepo for the official JavaScript/TypeScript SDK for the LedeWire API.
See `OVERVIEW.md` for the full design rationale and build order.

## Package Map

| Package                | npm name                  | Purpose                                                                                                            |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/core`        | (private — not published) | HTTP client, token manager, error classes, shared types                                                            |
| `packages/browser`     | `@ledewire/browser`       | Buyer-facing SDK for browsers. CDN `<script>` tag + npm                                                            |
| `packages/node`        | `@ledewire/node`          | Full API surface for Node.js. Merchant + seller + buyer                                                            |
| `packages/x402-client` | `@ledewire/x402-client`   | Runtime-agnostic x402 fetch wrapper — pays `402` content challenges automatically via the `ledewire-wallet` scheme |

## Key Files

| File                                              | Purpose                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ledewire.yml`                                    | OpenAPI 3.1 spec — source of truth for all endpoints and types                                                        |
| `OVERVIEW.md`                                     | Architecture overview, design decisions, build order                                                                  |
| `packages/core/src/errors.ts`                     | `LedewireError` class hierarchy                                                                                       |
| `packages/core/src/http-client.ts`                | Fetch wrapper — auth injection, error mapping, 401 retry                                                              |
| `packages/core/src/token-manager.ts`              | Proactive + reactive JWT refresh, deduplication                                                                       |
| `packages/core/src/types.ts`                      | Shared TypeScript types from the OpenAPI spec                                                                         |
| `packages/node/src/client.ts`                     | `createClient()` factory for Node.js                                                                                  |
| `packages/browser/src/client.ts`                  | `init()` factory for browsers                                                                                         |
| `packages/browser/src/local-storage-adapter.ts`   | `localStorage`-backed token storage (persists across tabs/restarts)                                                   |
| `packages/browser/src/session-storage-adapter.ts` | `sessionStorage`-backed token storage (tab-scoped, recommended for widgets)                                           |
| `packages/node/src/resources/acquisitions.ts`     | Bulk-licensing flow: quote, authorize, corpus download, signed manifest                                               |
| `packages/node/src/resources/publications.ts`     | Bulk-licensing catalog: publications and their works (public)                                                         |
| `packages/node/src/resources/company/`            | Company wallets: membership, invitations, members, Machine users, top-ups, reports (copied verbatim into browser)     |
| `packages/core/src/spend-cap.ts`                  | `spendCapErrorFromBody()` — shared 402 body parser to `SpendCapReachedError` (used by `HttpClient` and `x402-client`) |

## Client Namespace Structure

### Node client (`createClient()`)

```
client.config.*                 platform public config (no auth required)
client.auth.*                   buyer auth (email, google, api-key, password reset)
client.user.apiKeys.*           buyer API key management (list, create, revoke)
client.user.spendCap.*          buyer daily spend cap (get, update — null cap_cents = uncapped)
client.user.mcpKeys.*           buyer MCP API key management (list, create, revoke)
client.company.membership.*     the buyer's own Company membership (get, leave)
client.company.invitations.*    invite (admin), list (admin), accept (invitee, with emailed token)
client.company.members.*        list, update role / daily Spend cap, remove (admin; membership ids)
client.company.machineUsers.*   Machine users (list, create, deactivate) + .buyerKeys / .mcpKeys (admin)
client.company.wallet.*         Company top-up payment session, pending top-ups (admin)
client.company.purchases.*      everything the Company paid for, per member (admin, paginated)
client.company.spend.*          spend per membership over a date range (admin)
client.merchant.auth.*          merchant auth (email, google) + store listing + password reset
client.merchant.users.*         team management (invite, list, remove, update)
client.merchant.content.*       content CRUD + search (merchant JWT auth)
client.merchant.sales.*         sales list, summary, sale detail
client.merchant.buyers.*        anonymized buyer statistics
client.merchant.config.*        store configuration
client.merchant.pricingRules.*  x402 URL-based pricing rules (list, create, deactivate)
client.merchant.domains.*       x402 domain verification (list, add, verify, remove)
client.seller.content.*         seller content CRUD + search (API key auth)
client.seller.sales.*           seller sales summary + per-content statistics
client.seller.buyers.*          anonymized buyer statistics (API key auth)
client.seller.config.*          store configuration (API key auth)
client.wallet.*                 balance (incl. held_cents/holds; null for a Company member), payment sessions, transactions
client.purchases.*              create (single-use delivery), list, get, verify purchases
client.content.*                public content with buyer access info
client.checkout.*               checkout state machine
client.publications.*           bulk-licensing catalog: publications + their works (public)
client.acquisitions.*           bulk licensing: quote, cancel, authorize, corpus download, signed manifest
client.x402.*                   public x402 Bazaar resource discovery (no auth required)
```

`createAgentClient()` exposes a buyer-scoped subset: `auth`, `wallet`, `purchases`,
`content`, `checkout`, `user`, `company`, `publications`, `acquisitions`, `x402`.

`createMockClient()` stubs are hand-listed in `packages/node/src/testing.ts`; a
test in `testing.test.ts` walks a real `NodeClient` and fails if any public
method is missing a stub, so add the stub whenever you add a method.

### Testing utilities (`@ledewire/node/testing`)

`createMockClient()` and `MockNodeClient` are published under a dedicated subpath
so they are never bundled into production code. Import only in test files:

```ts
import { createMockClient } from '@ledewire/node/testing'
```

### Browser client (`init()`)

```
lw.config.*          platform public config (no auth required)
lw.auth.*            signup, login (email + google), logout, password reset
lw.checkout.*        checkout state machine for a content item
lw.wallet.*          balance (incl. held_cents/holds), fund (payment session), transactions
lw.purchases.*       create (single-use delivery), list, verify
lw.content.*         content with access info
lw.user.apiKeys.*    buyer API key management (list, create, revoke)
lw.user.spendCap.*   buyer daily spend cap (get, update — null cap_cents = uncapped)
lw.user.mcpKeys.*    buyer MCP API key management (list, create, revoke)
lw.company.*         Company wallets — same surface as client.company.*
lw.seller.*          loginWithApiKey (view or full), content list/search/get
```

## Critical Patterns

### Token management is automatic

Never call token refresh manually. `TokenManager` handles it inside `HttpClient`.
The `onUnauthorized` callback is wired from `TokenManager.handleUnauthorized()`.

### Errors

All SDK errors are `instanceof LedewireError`. Branch on `err.statusCode` or use
the named subclasses (`AuthError`, `ForbiddenError`, `NotFoundError`, `PurchaseError`,
`SpendCapReachedError`). `LedewireError` also carries an optional `type` (the API
error body's machine-readable `error.type`, e.g. `'daily_spend_cap_reached'`) and
`details` (extra top-level error-body fields). `instanceof` works even across the
separately bundled copies of `@ledewire/core` in `@ledewire/node`, `@ledewire/browser`,
and `@ledewire/x402-client` (see the brand-list fallback in
`LedewireError[Symbol.hasInstance]`).

`SpendCapReachedError` (402, `type: 'daily_spend_cap_reached'`) is thrown by
`purchases.create()`, the x402 content gate, and `acquisitions.authorize()`.
Funding the wallet does **not** clear it — it resets at `err.resetsAt`, or the
cap can be raised/removed via `user.spendCap.update()` (for a Company member,
only by an admin via `company.members.update()`).

#### Company members never see the Company balance

For a buyer with an open Company membership, `balance_cents` / `spendable_cents`
(wallet), `wallet_balance_cents` (content access info), and `balance_cents`
(payment status) are `null`; `remaining_cents` and `company_name` say what they
may still spend and whose wallet pays. Never assume a balance is a number.

#### Merchant auth role mismatch — `ForbiddenError`, not `AuthError`

This is the most common source of confusion in merchant integrations:

- `401 AuthError` — credentials are **invalid** (bad password, expired Google token, etc.)
- `403 ForbiddenError` — credentials are **valid** but the account has no merchant store
  associations (e.g. a personal Google account previously registered as a buyer)

When a developer tests with a buyer account, the API returns `403`, not `401`.
The `err.message` will be:
`"This account does not have merchant access. Use a merchant or owner account."`

```ts
import { ForbiddenError, AuthError } from '@ledewire/node'

try {
  await client.merchant.auth.loginWithGoogle({ id_token })
} catch (err) {
  if (err instanceof ForbiddenError) {
    // err.message → "This account does not have merchant access. Use a merchant or owner account."
    // Fix: use a merchant/owner account, or have the account added to a store.
  } else if (err instanceof AuthError) {
    // Bad credentials — re-authenticate.
  }
}
```

The same applies to `loginWithEmail`, `loginWithEmailAndListStores`, and
`loginWithGoogleAndListStores`.

### Paginated list endpoints

All list endpoints return a `{ data, pagination }` envelope — never a plain array:

```ts
const { data, pagination } = await client.merchant.sales.list(storeId)
const { data, pagination } = await client.seller.content.list(storeId, { page: 2, per_page: 10 })
```

The shared parameter type is `PaginationParams { page?: number; per_page?: number }`,
exported from `@ledewire/node`. Affected methods: `merchant.users.list`,
`merchant.sales.list`, `merchant.buyers.list`, `seller.content.list`,
`seller.content.search`.

### `MerchantLoginStore` vs `ManageableStore` — do not confuse these

| Type                 | Source                                                               | Fields                                                       |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ |
| `MerchantLoginStore` | Embedded in the login response (`loginWithEmailAndListStores`, etc.) | `.id`, `.name`, `.role`                                      |
| `ManageableStore`    | Returned by `merchant.auth.listStores()` — a separate HTTP call      | `.id`, `.name`, `.store_key`, `.role`, `.is_author`, `.logo` |

Use the combo-login helpers when you just need a store ID after login:

```ts
const { stores } = await client.merchant.auth.loginWithEmailAndListStores(email, password)
client.merchant.sales.list(stores[0].id) // ✅  MerchantLoginStore.id
```

Call `listStores()` only when you need the full `ManageableStore` detail
(`store_key`, `logo`, etc.) — it makes a second HTTP request.

### Adding a new API endpoint

1. Update `ledewire.yml` if the endpoint or schema isn't there yet
2. Run `pnpm generate:types` — regenerates `packages/core/src/api.gen.ts` (never edit that file manually)
3. Add/update types as needed:
   - **Shared** (used by both `browser` and `node`): add to `packages/core/src/types.ts`
   - **Node-only** (e.g. merchant-specific request/response shapes): define in the relevant resource file (`packages/node/src/resources/…`) and re-export from `packages/node/src/index.ts` — TypeDoc cannot resolve `@ledewire/core` re-exports in the node entry point so node-only types must live in source files TypeDoc can reach directly
4. Add the method to the correct namespace in `packages/node/src/resources/` or
   `packages/browser/src/resources/`
5. Write a Vitest test using MSW — see existing tests for patterns
6. Run `pnpm typecheck && pnpm test` — both must pass
7. Run `pnpm docs` and commit the updated `docs/api/`

### JSDoc is required on all exports

CI fails if public API members lack JSDoc. Every exported function, class,
interface, and type must have at minimum a one-sentence description.

### Field naming convention

All API response types use `snake_case` field names, matching the wire format
exactly. SDK-owned types that do not map 1:1 to a raw API response
(e.g. `StoredTokens`, `MerchantLoginResult`) use `camelCase`.

| Category                        | Case         | Examples                                             |
| ------------------------------- | ------------ | ---------------------------------------------------- |
| Raw API response types          | `snake_case` | `access_token`, `price_cents`, `store_key`           |
| SDK-internal / normalized types | `camelCase`  | `StoredTokens.accessToken`, `StoredTokens.expiresAt` |

Do not add a `transformKeys` option or camelCase aliases for response types.
`snake_case` response fields are intentional — they mirror the wire format
so network inspector output and TypeScript types are in the same coordinate
system. `StoredTokens` is camelCase because it's an SDK abstraction:
`expiresAt: number` is fundamentally different from `expires_at: string`.

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
pnpm docs              # Regenerate docs/api/ HTML from source (run after any API changes)
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

## Architectural Patterns — Where Things Belong

These conventions are enforced by ESLint rules and CI checks where possible.
Violations will fail CI; do not add `// eslint-disable` comments to work around them.

### Shared types → `packages/core/src/types.ts` only

Never define types in a resource file (`resources/*/foo.ts`) that are
used by more than one file. Put them in `packages/core/src/types.ts` and
import them from `@ledewire/core`. This prevents the situation where a type
lives in the wrong package and has to be re-exported through an awkward path.

### Generic functions instead of double-casts

Never write `foo as unknown as Bar`. ESLint will reject it.
If a utility function needs to accept a wide input but preserve the caller's
specific type, make it generic:

```ts
// ❌ rejected by ESLint
encodeContentFields(body as unknown as Record<string, unknown>)

// ✅ correct
function encodeContentFields<T extends { content_body?: string; teaser?: string }>(body: T): T
encodeContentFields(body) // T is inferred — no cast needed
```

### `private` instead of `public _` naming convention

Never use an underscore prefix as a substitute for `private`. ESLint will
reject `public _foo`. Use `private readonly _foo` (or `#foo`) so the
TypeScript compiler enforces access control, not just convention.

If tests need to verify internal wiring, inject the dependency explicitly
rather than reaching into the constructed object:

```ts
// ❌ tests should not do this — and now can't, because the field is private
const token = await client._tokenManager.getAccessToken()

// ✅ pass MemoryTokenStorage to createClient and inspect it directly
const storage = new MemoryTokenStorage()
const client = createClient({ storage })
await client.auth.loginWithEmail(credentials)
expect(storage.getTokens()?.accessToken).toBe('...')
```

### Runtime environment guards for `process.env`

Always guard `process.env` with `typeof process === 'undefined'`.
Bare `process.env` throws on Cloudflare Workers, Deno, and Bun:

```ts
// ❌ throws on edge runtimes
process.env['NODE_ENV'] !== 'production'

// ✅ safe everywhere
typeof process === 'undefined' || process.env['NODE_ENV'] !== 'production'
```

### Shared implementations via factory functions — no copy-paste

If two concrete implementations differ only in one injected value (a `Storage`
backend, a base URL, an endpoint path), extract a factory and pass the value as
a parameter. Do not duplicate the logic. See `webStorageAdapter` as the
canonical example.

### `api.gen.ts` is generated — never edit it manually

CI verifies that `packages/core/src/api.gen.ts` matches what
`pnpm generate:types` would produce from the current `ledewire.yml`.
If the check fails, run `pnpm generate:types` and commit the result.

### `docs/api/` is generated — never edit it manually

CI verifies that `docs/api/` matches what `pnpm docs` would produce from the
current source. If the check fails, run `pnpm docs` from the repo root and
commit the result. Always run `pnpm docs` after adding or changing exported
types, JSDoc, or public API methods.
