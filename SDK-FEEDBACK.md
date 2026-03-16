# @ledewire/node SDK — Feedback & Improvement Notes

Collected during development of the demo producer site (Next.js 15, strict TypeScript).
Items are categorised by severity: 🔴 Bug/Breaking · 🟡 DX Friction · 🟢 Nice-to-have

_Last updated: 2026-03-16 — see individual items for resolution status._

---

## Status Summary

| Item                                                 | Severity      | Status                                             | Released |
| ---------------------------------------------------- | ------------- | -------------------------------------------------- | -------- |
| `@ledewire/core` types not bundled                   | 🔴 Bug        | ✅ Fixed                                           | v0.2.2   |
| `ManageableStore` missing `store_name`               | 🟡 DX         | ✅ Already present in API                          | v0.2.2   |
| README `.id` → `.store_id` bug                       | 🟡 DX         | ✅ Fixed                                           | v0.2.3   |
| Two-step login boilerplate                           | 🟡 DX         | ✅ Fixed — `loginWithEmailAndListStores()` added   | v0.2.3   |
| `onTokenRefreshed` vs `storage.setTokens` confusion  | 🟡 DX         | ✅ Fixed — JSDoc clarified                         | v0.2.3   |
| `content_type` untyped; no discriminated union       | 🟡 DX         | ✅ Fixed — `Content` is now a discriminated union  | v0.2.3   |
| No merchant JWT flow README section                  | 🟢 NTH        | ✅ Fixed — section added with serverless warning   | v0.2.3   |
| `MemoryTokenStorage` serverless cold-start           | 🟢 NTH        | ✅ Fixed — JSDoc warning + explanation added       | v0.2.3   |
| No test utilities / mock factory                     | 🟢 NTH        | ✅ Fixed — `@ledewire/node/testing` subpath added  | v0.2.3   |
| `snake_case` field naming                            | 🟡 DX         | ⏳ Pending — SDK-only; low priority                | —        |
| No pagination on list endpoints                      | 🔴 Missing    | ✅ Fixed — paginated envelope on all list methods  | v0.3.0   |
| `content.search()` metadata-only                     | 🟡 DX         | ✅ Fixed — `title` + `uri` partial-match added     | v0.4.0   |
| Public config endpoint (Google Sign-In circular dep) | 🔴 Design Bug | ✅ Fixed — `GET /v1/config/public` (no auth)       | v0.4.0   |
| Opaque role mismatch errors                          | 🟡 DX         | ✅ Fixed — API returns 403 with actionable message | v0.4.0   |
| `author_fee_bps` not manageable per-author           | 🟢 NTH        | ✅ Fixed — `merchant.users.update()` added         | v0.3.0   |
| Login response didn't include stores                 | 🟡 DX         | ✅ Fixed — `MerchantLoginStore[]` in token resp    | v0.3.0   |

---

## 🔴 Bug — `@ledewire/core` dependency not published to npm (fixed in 0.2.1 runtime; type declarations still affected)

**Versions affected:** 0.2.0 (runtime + types), 0.2.1 (types still affected).

`@ledewire/node`'s generated type declaration (`dist/index.d.ts`) contains:

```ts
import { ... StoredTokens } from '@ledewire/core';
export { AuthError, LedewireError, StoredTokens, ... } from '@ledewire/core';
```

`@ledewire/core` is not published to the npm registry (`npm install @ledewire/core` → 404).
Although the 0.2.1 runtime bundles the code correctly (so the package works at runtime), the
TypeScript compiler cannot resolve `@ledewire/core` when building consumer projects.

**Consequences for TypeScript consumers:**

1. All re-exported types (`LedewireError`, `AuthError`, `StoredTokens`, `ContentResponse`, etc.)
   resolve to `any`.
2. `instanceof LedewireError` / `instanceof AuthError` checks do **not** narrow the catch
   variable — TypeScript still treats `err` as `unknown` inside the guarded branch, causing
   `TS18046` errors in strict mode.
3. `TokenStorage.setTokens(tokens)` cannot infer the `tokens` type from the interface, causing
   a `TS7006` implicit-`any` parameter error.

**Workaround applied in this project:**

```ts
if (err instanceof LedewireError) {
  const e = err as LedewireError // explicit cast — instanceof alone doesn't narrow
  return NextResponse.json({ error: e.message }, { status: e.statusCode })
}
```

And explicit annotation on `TokenStorage` callbacks:

```ts
async setTokens(tokens: StoredTokens) { ... }
```

**Real-world consequence — silent field name mismatch in `MerchantSaleResponse`:**
Because `MerchantSaleResponse` resolves to `any`, TypeScript placed no constraint on the field
names used when consuming `merchant.sales.list()`. The app was written against field names that
seemed reasonable (`content_title`, `price_cents`) but the actual API returns different names
(`title`, `total_revenue_cents`). This produced a silent runtime bug — blank content names and
`$NaN` in the amount column — that would have been a compile-time error had the types resolved
correctly.

**Recommended SDK fix:** Inline/bundle all re-exported types from `@ledewire/core` directly
into `@ledewire/node`'s own `dist/index.d.ts` (e.g., via `tsup`'s `dts.resolve` option or
`dts-bundle-generator`), eliminating the cross-package type dependency entirely.

---

## 🟡 DX — Two-step login + store discovery requires two sequential network calls

After a successful `client.merchant.auth.loginWithEmail()` the caller must immediately make a
second request — `client.merchant.auth.listStores()` — to obtain the `storeId` needed for
every subsequent API call. This forces every auth route handler to issue two sequential HTTP
requests and then manually pluck `stores[0].store_id`.

**Example of required boilerplate:**

```ts
await client.merchant.auth.loginWithEmail({ email, password })
const stores = await client.merchant.auth.listStores()
const storeId = stores[0]?.store_id ?? null
```

**Suggested improvement:** Return the accessible stores list as part of the
`MerchantAuthenticationResponse`, or expose a convenience method such as
`loginWithEmailAndListStores()` that returns `{ tokens, stores }` in a single call.

---

## 🟡 DX — `TokenStorage.setTokens` is called on refresh; `onTokenRefreshed` is redundant

The `NodeClientConfig` documents both `storage.setTokens` and `onTokenRefreshed` as ways to
persist refreshed tokens. In practice they fire for the same event, creating confusion about
which hook to use and risking double-writes if both are provided.

**Recommendation:** Document clearly that `storage.setTokens` is the correct persistence hook
and that `onTokenRefreshed` is provided only for side-effects (e.g., audit logging) where a
separate storage write is not desired. Or consider removing `onTokenRefreshed` and letting
`setTokens` serve both purposes.

---

## 🟡 DX — `content_type` is an untyped string; valid values and their required fields are not discoverable

`client.seller.content.create()` accepts a `Content` body where `content_type` accepts any
`string`. The SDK supports at least two content types — `'markdown'` and `'external_ref'` —
but this is only discoverable by reading the README example. There is no union type, no JSDoc
`@remarks` on each variant, and no TypeScript discriminated union to guide consumers to the
correct companion fields.

Concretely: `external_ref` content requires two additional fields (`content_uri` and
`external_identifier`) that are irrelevant for `markdown` content. Without a discriminated
union, consumers have no way to know these fields exist or are required — and passing an
invalid value or omitting them fails only at runtime (HTTP 400).

**Recommended fix:** Model `Content` as a discriminated union:

```ts
type Content =
  | {
      content_type: 'markdown'
      content_body: string
      title: string
      price_cents: number
      visibility: 'public' | 'private'
    }
  | {
      content_type: 'external_ref'
      content_uri: string
      external_identifier: string
      title: string
      price_cents: number
      visibility: 'public' | 'private'
    }
```

This gives consumers compile-time safety, IDE autocompletion, and instant discovery of
which fields belong to which content type.

`visibility` has the same problem and should similarly be typed as `'public' | 'private'`.

---

## 🟡 DX — `ManageableStore` exposes only `store_id`; no human-readable name field

`client.merchant.auth.listStores()` returns `ManageableStore[]`, but `ManageableStore` only
contains `store_id`. There is no `store_name`, `display_name`, or equivalent human-readable
label.

This means any store-picker UI is forced to display raw UUIDs/slugs to the user:

```ts
// Only field available — not user-friendly
stores.map(s => <option value={s.store_id}>{s.store_id}</option>)
```

**Workaround applied in this project:** The store ID is displayed as-is in the dropdown,
which is confusing for merchants who manage multiple stores under recognisable brand names.

**Recommended fix:** Add a `store_name` (or `name`) field to `ManageableStore`:

```ts
interface ManageableStore {
  store_id: string
  store_name: string // human-readable label set at store creation time
}
```

This is a low-effort, high-impact change — the data almost certainly exists on the server
side and just needs to be included in the `listStores` response.

---

## 🟡 DX — `snake_case` field naming (`store_id`, `content_title`, etc.)

All SDK response objects use `snake_case` (`store_id`, `content_title`, `price_cents`). This
is consistent with the REST API but creates friction in TypeScript/JavaScript where `camelCase`
is idiomatic.

**Suggestion:** Offer camelCase aliases in the TypeScript types (mapped types or overloads), or
document a `transformKeys` option on `createClient` for teams that prefer camelCase throughout.
This is a low-priority cosmetic change — consistency with the wire format is also a valid choice.

---

## 🟢 Nice-to-have — No `createClient` example in README for the merchant-only (no API key) auth mode

The `createClient` JSDoc example covers API key + secret auth. The merchant JWT flow (covering
the `storage` adapter and `onAuthExpired` callback) is not demonstrated in the README, only in
the JSDoc of `NodeClientConfig`. Since many producers won't have or need an API key, a
dedicated README section for this flow would reduce setup time significantly.

---

## 🟢 Nice-to-have — `MemoryTokenStorage` not suitable for server-side use; a note would help

`MemoryTokenStorage` (the default) resets on every cold start, which means tokens are always
lost between serverless function invocations. The docs don't warn about this explicitly. A
note in the `storage` option JSDoc — and an example showing an httpOnly-cookie adapter — would
save server-side implementors from a confusing "login loop" bug.

## 🟢 Nice-to-have — No test utilities or mock factory provided

When writing unit tests for route handlers that depend on `createMerchantClient()`, consumers
must manually construct full mock objects covering every namespace method
(`seller.content.list`, `seller.content.create`, `merchant.sales.summary`, etc.).

Because the SDK exports no test helpers and all types resolve to `any` (see item #1), there
is no type-safe way to build a stub client — the best a consumer can do is an ad-hoc `vi.fn()`
object that could silently drift from the real API surface.

**Suggestion:** Export a `createMockClient()` factory (or a `vi.stubClient()` Vitest helper)
from a `@ledewire/node/testing` subpath that returns a fully-typed mock object with all methods
pre-stubbed as `vi.fn()` / `jest.fn()`. This would also serve as living documentation of the
full method surface.

## � Missing — No pagination support on list endpoints

`client.seller.content.list(storeId)` and `client.merchant.sales.list(storeId)` return
**all records in a single response** with no way to request a page or cursor. For stores
with hundreds of content items or thousands of sales, this means:

1. Every list call fetches the entire dataset over the network.
2. Memory usage grows unbounded with store size.
3. Initial page load time degrades linearly as records accumulate.
4. Server-side filtering/sorting is impossible — consumers must sort and slice client-side.

**Workaround applied in this project:** All records are fetched on every navigation; the UI
slices to a configurable `PAGE_SIZE` and maintains a `page` counter in state. This works for
demo-scale data but is not production-viable.

**Recommended fix:** Add optional pagination parameters to list methods:

```ts
// Cursor-based (preferred for append-only data like sales):
client.merchant.sales.list(storeId, { cursor?: string, limit?: number })
// → returns { items: MerchantSaleResponse[], nextCursor: string | null }

// Offset-based (acceptable for content):
client.seller.content.list(storeId, { page?: number, pageSize?: number })
// → returns { items: ContentResponse[], total: number }
```

Cursor-based pagination is strongly preferred for the sales endpoint, where items are
ordered by time and new records are continuously appended.

---

The README quickstart example reads:

```ts
const stores = await client.merchant.auth.listStores()
const storeId = stores[0].id // ← README says .id
```

However, the actual runtime object (confirmed by inspection and JSDoc) uses `.store_id`:

```ts
const storeId = stores[0].store_id // ← correct field name
```

Because all types resolve to `any` (see item #1), TypeScript cannot catch this
mismatch at compile time — a consumer following the README literally gets
`undefined` at runtime with no error.

**Recommended fix:** Correct the README example to use `.store_id`, or (better) ship
a typed `MerchantStore` interface with named fields so any field-name change is
immediately caught by consumers.

---

## ✅ Fixed in v0.4.0 — `content.search()` extended with title and URI search

`ContentSearchRequest` now accepts three optional, combinable criteria:

```ts
await client.seller.content.search(storeId, { title: 'intro' })
await client.seller.content.search(storeId, { uri: 'vimeo.com' })
await client.seller.content.search(storeId, { title: 'tutorial', metadata: { category: 'ml' } })
```

`title` and `uri` are case-insensitive partial matches. `metadata` retains its existing
exact AND-match behaviour. All three fields are now optional (previously `metadata` was
required), and at least one must be supplied.

---

## ✅ Fixed in v0.4.0 — Public config endpoint added; Google Sign-In circular dependency resolved

`GET /v1/config/public` is now available with no authentication required:

```ts
// Node
const { google_client_id } = await client.config.getPublic()
// Browser
const { google_client_id } = await lw.config.getPublic()
```

Both `@ledewire/node` and `@ledewire/browser` expose `client.config.getPublic()`. The
original authenticated `GET /v1/merchant/{store_id}/config` endpoint remains available
for store-specific config.

---

## (Archived) 🔴 Design Bug — `GET /v1/seller/config` (and `/v1/merchant/{store_id}/config`) requires authentication, but the response is needed _before_ authentication

Both config endpoints return `{ google_client_id: string }` and are protected by `BearerAuth`.
This creates an unsolvable circular dependency for any client that wants to use
LedeWire-managed Google Sign-In:

1. The login page needs `google_client_id` to initialise the Google Identity Services library
   and render the **Sign in with Google** button.
2. `google_client_id` can only be fetched from `GET /v1/seller/config` or
   `GET /v1/merchant/{store_id}/config`.
3. Both endpoints require a valid Bearer token obtained by... signing in.

In practice, clients are forced to either:

- Register their own Google OAuth application and hard-code or ship the Client ID as an
  environment variable (`NEXT_PUBLIC_GOOGLE_CLIENT_ID` in this project), completely bypassing
  the platform-managed credential.
- Make an unauthenticated guess at the store's `store_id` (impossible without prior auth) and
  still fail because the endpoint demands a token.

The Google Client ID is **not a secret** — it is embedded verbatim in every page that renders
the GSI button and is visible to anyone who views the page source. There is no security benefit
to gating it behind authentication.

**Recommended fix:** Expose a public (unauthenticated), store-keyed config endpoint:

```
GET /v1/stores/{store_key}/public-config
→ 200 { google_client_id: string }
```

`store_key` is already a human-readable slug (`ManageableStore.store_key`) so it can be
configured once at deploy time without requiring a prior API call. Alternatively, expose a
global platform config endpoint that returns the single platform-wide Google OAuth client:

```
GET /v1/config/public
→ 200 { google_client_id: string }
```

This unblocks the common case where all stores share one LedeWire-managed Google OAuth app.

**Workaround applied in this project:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` environment variable
— operators must register and manage their own Google OAuth application.

---

## ✅ Fixed in v0.4.0 — Merchant auth returns 403 with actionable message on role mismatch

Both `loginWithEmail` and `loginWithGoogle` now return `403 Forbidden` (mapped to
`ForbiddenError` in the SDK) when credentials are valid but the account has no merchant
store access:

```ts
try {
  await client.merchant.auth.loginWithEmail({ email, password })
} catch (err) {
  if (err instanceof ForbiddenError) {
    // Account authenticated but has no store access — use a different account
    // or have an owner add this account to a store first.
  } else if (err instanceof AuthError) {
    // Wrong password / unknown email
  }
}
```

The error message is now `"This account does not have merchant access. Use a merchant or owner account."` rather than the previous opaque `"invalid role"`.

---

_Last updated: 2026-03-15_
