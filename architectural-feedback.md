# LedeWire JS SDK — Architectural Feedback

## Summary Table

| Severity   | #   | Issue                                                                                 |
| ---------- | --- | ------------------------------------------------------------------------------------- |
| High       | 1   | Pagination return types violate stated contract (3 endpoints)                         |
| ~~High~~   | 2   | ~~`refreshFn` copy-pasted between package clients~~ ✅ resolved                       |
| High       | 3   | `Content` type duplicates OpenAPI schema ⏳ partially mitigated (spec fix pending)    |
| ~~Medium~~ | 4   | ~~`PaginationParams` defined in the wrong module~~ ✅ resolved                        |
| ~~Medium~~ | 5   | ~~Pagination query building copy-pasted 4 times~~ ✅ resolved                         |
| ~~Medium~~ | 6   | ~~Token normalization duplicated within `MerchantAuthNamespace`~~ ✅ resolved         |
| ~~Medium~~ | 7   | ~~`public readonly` fields labelled `@internal`~~ ✅ resolved                         |
| ~~Medium~~ | 8   | ~~`localStorageAdapter`/`sessionStorageAdapter` share no implementation~~ ✅ resolved |
| ~~Low~~    | 9   | ~~`process.env` in client factory~~ ✅ resolved                                       |
| ~~Low~~    | 10  | ~~`baseUrl` default hardcoded in 3 places~~ ✅ resolved                               |
| ~~Low~~    | 11  | ~~`encodeContentFields` type cast through `unknown`~~ ✅ resolved                     |

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

## ~~Issue 4 — `PaginationParams` defined in the wrong module (Medium)~~ ✅ Resolved

`PaginationParams` moved to `packages/core/src/types.ts`. All four node resource files (`merchant/users`, `merchant/sales`, `merchant/buyers`, `seller/content`) now import from `@ledewire/core`. Exported from both `@ledewire/node` and `@ledewire/browser` public index files.

**Commit:** `1f7de94` — refactor(core): move PaginationParams to @ledewire/core

---

## ~~Issue 5 — Pagination query building copy-pasted 4+ times (Medium)~~ ✅ Resolved

`HttpClient.get()` and `.post()` params widened to `Record<string, string | number | undefined>`. `buildUrl()` now filters `undefined` and coerces numbers internally. `PaginationParams` gains an index signature to satisfy the `Record` constraint. All five URLSearchParams blocks across `merchant/users`, `merchant/sales`, `merchant/buyers`, and `seller/content` (list + search) replaced with a direct `params` pass-through.

**Commit:** `6a770d2` — refactor(core): eliminate copy-pasted URLSearchParams query building

---

## ~~Issue 6 — Token normalization duplicated within `MerchantAuthNamespace` (Medium)~~ ✅ Resolved

Extracted private `normalizeTokens(res: MerchantAuthenticationResponse): StoredTokens` in `packages/node/src/resources/merchant/auth.ts`. Both `storeTokens()` and the login-and-list helpers now delegate to it — the inline `{ accessToken, refreshToken, expiresAt }` construction is no longer duplicated.

**Commit:** `9408200` — refactor: extract normalizeTokens and make encodeContentFields generic

---

## ~~Issue 7 — `public readonly` fields labelled `@internal` (Medium)~~ ✅ Resolved

`_http`, `_tokenManager`, and `_config` changed from `public readonly` to `private readonly` in both `NodeClient` (`packages/node/src/client.ts`) and `BrowserClient` (`packages/browser/src/client.ts`). The TypeScript compiler now enforces the boundary rather than relying on a JSDoc convention.

All tests that previously accessed these fields were updated:

- Token-storage assertions replaced with an explicit `MemoryTokenStorage` passed to `createClient`/`init` — `storage.getTokens()?.accessToken` is synchronous and has no dependency on `TokenManager` internals.
- `client._http.get('/v1/wallet/balance')` calls replaced with `client.wallet.balance()`.
- Token refresh trigger tests call `client.wallet.balance()` and capture the `Authorization` header via MSW to verify the refreshed token was used.

`MockNodeClient` in `testing.ts` simplified: `Omit<NodeClient, '_http' | '_tokenManager' | '_config'>` → `DeepMutable<NodeClient>` (private fields are absent from the public interface).

**Commit:** `a396130` — refactor: make NodeClient and BrowserClient constructor fields private

---

## ~~Issue 8 — `localStorageAdapter` and `sessionStorageAdapter` share no implementation (Medium)~~ ✅ Resolved

Extracted `webStorageAdapter(backend: Storage, key?: string): TokenStorage` into `packages/browser/src/web-storage-adapter.ts` (not exported from the public index). Both adapters are now single-line wrappers:

```ts
export function localStorageAdapter(key?: string): TokenStorage {
  return webStorageAdapter(localStorage, key)
}
export function sessionStorageAdapter(key?: string): TokenStorage {
  return webStorageAdapter(sessionStorage, key)
}
```

All 20 existing adapter tests continue to pass against the public wrappers unchanged.

**Commit:** `a47d081` — refactor(browser): extract shared webStorageAdapter

---

## ~~Issue 9 — `process.env` in client factory (Low)~~ ✅ Resolved

`process.env['NODE_ENV']` in `packages/node/src/client.ts` is now wrapped in a `typeof` guard:

```ts
typeof process === 'undefined' || process.env['NODE_ENV'] !== 'production'
```

On edge runtimes (Cloudflare Workers, Deno, Bun) where `process` is not defined, `typeof process === 'undefined'` is `true` and the `||` short-circuits — the warning is shown. On Node.js the guard is transparent and existing behaviour is unchanged. The `typeof` check is the safe standard pattern for runtime detection without relying on bundler globals.

**Commit:** `5297fcf` — fix(node): guard process.env access for non-Node runtimes

---

## ~~Issue 10 — `baseUrl` default hardcoded in 3 places (Low)~~ ✅ Resolved

`DEFAULT_BASE_URL` promoted to an exported constant in `packages/core/src/http-client.ts`. Both `createClient()` and `init()` now import it. Resolved naturally as part of the Issue 2 fix.

**Commit:** `555b67b` — refactor(core): extract createRefreshFn and export DEFAULT_BASE_URL

---

## ~~Issue 11 — `encodeContentFields` type cast through `unknown` (Low)~~ ✅ Resolved

`encodeContentFields` in `packages/core/src/base64.ts` is now generic:

```ts
export function encodeContentFields<T extends { content_body?: string; teaser?: string }>(
  body: T,
): T
```

Both `create()` and `update()` in `packages/node/src/resources/seller/content.ts` pass `body` directly with no cast. The `as unknown as Record<string, unknown>` double-cast is eliminated.

**Commit:** `9408200` — refactor: extract normalizeTokens and make encodeContentFields generic
