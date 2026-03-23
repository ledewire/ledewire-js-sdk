# LedeWire JS SDK — Architectural Feedback

## Summary Table

| Severity | #   | Issue                                                                              |
| -------- | --- | ---------------------------------------------------------------------------------- |
| High     | 1   | Pagination return types violate stated contract (3 endpoints)                      |
| ~~High~~ | 2   | ~~`refreshFn` copy-pasted between package clients~~ ✅ resolved                    |
| High     | 3   | `Content` type duplicates OpenAPI schema ⏳ partially mitigated (spec fix pending) |
| Medium   | 4   | `PaginationParams` defined in the wrong module                                     |
| Medium   | 5   | Pagination query building copy-pasted 4 times                                      |
| Medium   | 6   | Token normalization duplicated within `MerchantAuthNamespace`                      |
| Medium   | 7   | `public readonly` fields labelled `@internal`                                      |
| Medium   | 8   | `localStorageAdapter`/`sessionStorageAdapter` share no implementation              |
| Low      | 9   | `process.env` in client factory                                                    |
| ~~Low~~  | 10  | ~~`baseUrl` default hardcoded in 3 places~~ ✅ resolved                            |
| Low      | 11  | `encodeContentFields` type cast through `unknown`                                  |

---

## Issue 1 — Pagination return types violate stated contract (High)

**Rule from AGENTS.md:** "List endpoints return paginated envelopes: `{ data, pagination }` — never plain arrays."

Three endpoints return plain arrays in violation of this contract:

- `WalletNamespace.transactions()` → `WalletTransactionItem[]`
  File: `packages/node/src/resources/wallet.ts`
- `PurchasesNamespace.list()` → `PurchaseResponse[]`
  File: `packages/node/src/resources/purchases.ts`
- `BrowserSellerContentNamespace.list()` → `ContentResponse[]`
  File: `packages/browser/src/resources/seller/content.ts`

**Fix:** Wrap return types in paginated envelopes and accept optional `PaginationParams`. Verify the underlying API endpoints support pagination and update response types accordingly.

---

## ~~Issue 2 — `refreshFn` copy-pasted between package clients (High)~~ ✅ Resolved

`createRefreshFn(baseUrl)` extracted into `packages/core/src/token-manager.ts`. Both `createClient()` and `init()` now delegate to it. Unit tests added for the happy path and non-2xx error branch.

**Commit:** `555b67b` — refactor(core): extract createRefreshFn and export DEFAULT_BASE_URL

---

## Issue 3 — `Content` type duplicates OpenAPI schema (High) ⏳ Partially mitigated

`Content` in `packages/core/src/types.ts` is a hand-maintained 60+ line discriminated union. Every other type in the same file is a one-liner alias to `components['schemas']['...']`. When `ledewire.yml` changes, this hand-written type will silently drift.

**Root cause:** `ledewire.yml` defines `Content` as a flat object (no `oneOf`/`discriminator`). `openapi-typescript` therefore generates a flat union-less type, which cannot be used for narrowing on `content_type`. The hand-written discriminated union is intentional until the spec is updated.

**SDK mitigation (applied):** A compile-time assignability guard (`_ContentDriftGuard`) has been added to `packages/core/src/types.ts`. It requires `Content extends components['schemas']['Content']` at the type level — if the generated schema gains new required fields or narrows its enums in a breaking way, `tsc` will error immediately at that line rather than allowing silent drift.

**Remaining work (API team):** Update `ledewire.yml` to use `oneOf` + `discriminator` for the `Content` schema. Once done, the hand-written union and the guard can both be removed and replaced with a single `components['schemas']['Content']` alias.

---

## Issue 4 — `PaginationParams` defined in the wrong module (Medium)

`PaginationParams` is defined inside `packages/node/src/resources/merchant/users.ts` — a domain-specific users file. It is then cross-imported by `seller/content.ts`, `merchant/sales.ts`, and `merchant/buyers.ts`.

**Fix:** Move `PaginationParams` to `packages/core/src/types.ts`. Export it from both `@ledewire/node` and `@ledewire/browser` public index files.

---

## Issue 5 — Pagination query building copy-pasted 4+ times (Medium)

The following pattern is repeated in at least 4 files:

```ts
const query = new URLSearchParams()
if (params?.page !== undefined) query.set('page', String(params.page))
if (params?.per_page !== undefined) query.set('per_page', String(params.per_page))
const qs = query.toString()
return this.http.get<T>(`/path${qs ? `?${qs}` : ''}`)
```

`HttpClient.get()` already builds query strings from `Record<string, string>`. The manual building only exists because numeric values need `String()` coercion.

**Fix:** Change `HttpClient.get()` params type to `Record<string, string | number | undefined>` and filter out `undefined` values internally. All paginated endpoints can then pass `params` directly without manual URLSearchParams construction.

---

## Issue 6 — Token normalization duplicated within `MerchantAuthNamespace` (Medium)

In `packages/node/src/resources/merchant/auth.ts`, `loginWithEmailAndListStores` manually constructs the `StoredTokens` object inline — the exact same transformation already performed by the private `storeTokens()` method in the same class.

**Fix:** Extract a private `normalizeTokens(res: MerchantAuthenticationResponse): StoredTokens` helper and use it in both `storeTokens()` and the login-and-list helpers.

---

## Issue 7 — `public readonly` fields labelled `@internal` (Medium)

`NodeClient` and `BrowserClient` expose `_http`, `_tokenManager`, and `_config` as `public readonly` constructor fields, then attempt to hide them with a `@internal` JSDoc tag and underscore prefix convention.

Files:

- `packages/node/src/client.ts`
- `packages/browser/src/client.ts`

**Fix:** Use TypeScript `private` (or `#private`) for fields that should not be part of the public API. If the testing utilities need access, accept the dependencies as constructor parameters in `createMockClient` directly rather than pulling them off the live client instance.

---

## Issue 8 — `localStorageAdapter` and `sessionStorageAdapter` share no implementation (Medium)

The two files are structurally identical — differing only in `localStorage` vs `sessionStorage`. Both live in `packages/browser/src/`.

**Fix:** Implement a shared `webStorageAdapter(backend: Storage, key?: string): TokenStorage` (unexported or exported as `@internal`), then define the two public adapters as thin wrappers:

```ts
export const localStorageAdapter = (key?: string) => webStorageAdapter(localStorage, key)
export const sessionStorageAdapter = (key?: string) => webStorageAdapter(sessionStorage, key)
```

---

## Issue 9 — `process.env` in client factory (Low)

`packages/node/src/client.ts` references `process.env['NODE_ENV']` directly. While the package is Node-only today, this pattern causes runtime errors on Cloudflare Workers, Deno, and Bun edge runtimes, and prevents future isomorphic use.

**Fix:** Wrap in a guard (`typeof process !== 'undefined' && process.env?.['NODE_ENV']`) or replace with a bundler-injected `__DEV__` constant.

---

## ~~Issue 10 — `baseUrl` default hardcoded in 3 places (Low)~~ ✅ Resolved

`DEFAULT_BASE_URL` promoted to an exported constant in `packages/core/src/http-client.ts`. Both `createClient()` and `init()` now import it. Resolved naturally as part of the Issue 2 fix.

**Commit:** `555b67b` — refactor(core): extract createRefreshFn and export DEFAULT_BASE_URL

---

## Issue 11 — `encodeContentFields` type cast through `unknown` (Low)

In `packages/node/src/resources/seller/content.ts`, both `create()` and `update()` call:

```ts
encodeContentFields(body as unknown as Record<string, unknown>)
```

The double cast exists because `encodeContentFields` accepts `Record<string, unknown>` but `body` is typed as a discriminated union (`Content`) or `ContentUpdateRequest`.

**Fix:** Update `encodeContentFields` to accept the actual union type, or make it generic: `encodeContentFields<T extends { content_body?: string; teaser?: string }>(body: T): T`. Eliminates the unsafe cast entirely.
