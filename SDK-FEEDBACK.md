# @ledewire/node SDK — Feedback & Improvement Notes

Collected during development of the demo producer site (Next.js 15, strict TypeScript).
Items are categorised by severity: 🔴 Bug/Breaking · 🟡 DX Friction · 🟢 Nice-to-have
Resolved items are marked ✅ with the version they were fixed in.

---

## ✅ FIXED in 0.4.0 — `@ledewire/core` type declarations not bundled

All re-exported types are now inlined into `dist/index.d.ts`. `instanceof LedewireError`
correctly narrows `unknown` in strict mode — no more explicit `err as LedewireError` casts.
The silent `MerchantSaleResponse → any` field-name bug is now a compile-time error.

---

## ✅ FIXED in 0.4.0 — Two-step login + store discovery

`loginWithEmailAndListStores()` and `loginWithGoogleAndListStores()` now return `{ tokens, stores }`
in a single HTTP call. The two-step `loginWithEmail` → `listStores` pattern and the
`capturedTokens` workaround are gone.

---

## ✅ FIXED in 0.4.0 — `content_type` untyped string

`Content` is now a proper discriminated union on `content_type`. `visibility` is also typed
as `'public' | 'unlisted'`. The `Record<string, any>` payload workaround is removed.

---

## ✅ FIXED in 0.4.0 — `ManageableStore` missing human-readable name

`ManageableStore` now includes `store_name`. The store-selector dropdown can show real names.

---

## ✅ FIXED in 0.4.0 — `content.search()` metadata-only

`ContentSearchRequest` now accepts `title` (case-insensitive partial match) and `uri` alongside
`metadata`. Title search is the most useful search for most UIs.

---

## ✅ FIXED in 0.4.0 — No pagination on list endpoints

All list methods now accept `PaginationParams` and return `{ data, pagination }`. Server-side
paging replaces the previous full-dataset fetch + client-side slice workaround.

---

## ✅ FIXED in 0.4.0 — No test utilities

`@ledewire/node/testing` exports `createMockClient(vi.fn)`. The hand-rolled namespace mock is
replaced with typed SDK stubs. See new friction item below for a remaining rough edge.

---

## ✅ FIXED in 0.4.0 — `MemoryTokenStorage` serverless warning missing

The `storage` JSDoc now warns about cold-start token loss and includes a cookie/Redis example.

---

## ✅ FIXED in 0.4.0 — `MerchantLoginResult.tokens` is now `StoredTokens`

`loginWithEmailAndListStores()` returns `MerchantLoginResult` where `tokens` is typed as
`MerchantAuthenticationResponse` — the raw API shape:

```ts
{
  token_type: 'Bearer'
  access_token: string      // snake_case
  refresh_token: string
  expires_at: string        // ISO 8601 string
  stores: MerchantLoginStore[]
}
```

But the `TokenStorage` adapter works with `StoredTokens`:

```ts
{
  accessToken: string // camelCase
  refreshToken: string
  expiresAt: number // Unix ms timestamp
}
```

Consumers who use `loginWithEmailAndListStores()` must manually remap fields and call
`parseExpiresAt()` — two extra steps that don't exist when using the auto-storing
`loginWithEmail()` path:

```ts
// Required boilerplate after loginWithEmailAndListStores():
session.accessToken = tokens.access_token
session.refreshToken = tokens.refresh_token
session.expiresAt = parseExpiresAt(tokens.expires_at) // manual conversion
```

**Recommended fix:** Have `loginWithEmailAndListStores()` auto-store tokens via the configured
`storage` adapter (same as `loginWithEmail()`) and type `MerchantLoginResult.tokens` as
`StoredTokens` so callers work in the same normalized coordinate system. The raw API shape is
an implementation detail consumers shouldn't need to touch.

---

## ✅ FIXED in 0.4.0 — `ContentListItem` now includes `content_uri`

`SellerContentNamespace.list()` and `.search()` now return `ContentListItem[]`, which
deliberately omits `content_body` and `content_uri` to keep list payloads small. The JSDoc says
to use the detail endpoint to retrieve the URI.

For `external_ref` content this creates a practical problem: any list-view UI that wants to
render a "View ↗" link (the whole point of external content) must now issue a separate
`content.get()` call for each `external_ref` item — an N+1 fetch pattern for something that
was free before.

`ContentListItem` does include `external_identifier` (`vimeo:987654321`) but that is a
namespaced ID, not a URL, so it cannot be used as an `<a href>` directly.

**Recommended fix:** Include `content_uri` in `ContentListItem` for `external_ref` items.
The URI is not sensitive (it's the publicly-facing link the buyer clicks), so there is no
security reason to omit it from the list payload. Alternatively, expose it only when the
caller has owner/author permissions (which the seller endpoints already require).

---

## ✅ FIXED in 0.4.0 — `ManageableStore` field names aligned with `MerchantLoginStore`

There are now two types representing "a store accessible to this merchant user":

| Source                          | Type                 | ID field   | Name field   |
| ------------------------------- | -------------------- | ---------- | ------------ |
| `loginWithEmailAndListStores()` | `MerchantLoginStore` | `id`       | `name`       |
| `listStores()`                  | `ManageableStore`    | `store_id` | `store_name` |

A consumer who starts with the combined helper and later calls `listStores()` (or vice versa)
must remember which field names apply to which type. Since both represent the same concept, the
field names should be consistent — ideally `id` / `name` as the shorter, idiomatic form.

---

## ✅ ADDRESSED in 0.4.0 — `createMockClient` `vi.mocked()` patterns documented

`createMockClient(vi.fn)` pre-stubs all methods, but the returned `MockNodeClient` type exposes
methods as plain function signatures. To call `.mockResolvedValueOnce()`, `.mock.calls`, etc.,
consumers must wrap with `vi.mocked()`:

```ts
// Required workaround:
const mockClient = vi.mocked(createMockClient(vi.fn), true)
```

Without the `vi.mocked()` call, TypeScript reports:

```
Property 'mockResolvedValueOnce' does not exist on type '(...) => Promise<...>'
```

The `createMockClient` JSDoc example doesn't show this step — it demonstrates calling
`vi.mocked(client.merchant.sales.list).mockResolvedValue(...)` but doesn't explain why the
intermediate `vi.mocked(createMockClient(...), true)` call at the top level is also needed.

**Recommended fix:** Either type the returned object as `DeepMocked<NodeClient>` (using
`MockedDeep` from `vitest`), or add a note to the JSDoc explaining that the top-level
`vi.mocked(client, true)` call is necessary to surface mock assertion methods.

---

## ✅ FIXED in 0.4.0 — `MerchantInviteRequest.is_author` is now optional

The JSDoc on `MerchantInviteRequest.is_author` says `@default true`, but the TypeScript type
marks it as required (`is_author: boolean`, not `is_author?: boolean`). Every call site must
supply `is_author: true` explicitly even though that is always the intent for the invite
flow. A caller who omits it gets a compile error, not a sensible default.

**Recommended fix:** Mark `is_author` as optional in the TypeScript type to match the
documented default:

```ts
is_author?: boolean   // defaults to true on the server
```

---

## ✅ FIXED in 0.4.0 — `onTokenRefreshed` double-write warning and semantics clarified

`storage.setTokens` is documented as the canonical persistence hook (fires on login and
background refresh). `onTokenRefreshed` is scoped to background refresh only and is intended
for side-effects (audit logging, cache invalidation). `createClient` now emits a
`console.warn` in non-production when both are configured together.

---

## ✅ ADDRESSED in 0.4.0 — `snake_case`/`camelCase` naming convention documented

The rule is: API response types mirror the wire format (`snake_case`); SDK-owned/normalized
types (`StoredTokens`, `MerchantLoginResult`) use `camelCase`. This is now documented in
`AGENTS.md`, `node/llms.txt`, and `browser/llms.txt`. A `transformKeys` option was considered
but intentionally omitted — consistency with the wire format is the right default for a
server-side SDK.

---

## ✅ FIXED in 0.4.0 — Merchant JWT auth README section added

The `createClient` JSDoc example covers API key + secret auth. The merchant JWT flow (covering
the combined login helpers, the `storage` adapter, and `onAuthExpired`) is only shown in the
`NodeClientConfig` JSDoc. A dedicated README section for this flow would reduce setup time for
producers who don't use API keys.

---

## ✅ FIXED in @ledewire/node 0.4.0 / @ledewire/browser 0.3.0 — Unauthenticated `GET /v1/config/public` endpoint added

Both `GET /v1/seller/config` and `GET /v1/merchant/{store_id}/config` return `{ google_client_id }`
and require a Bearer token. This creates a circular dependency for LedeWire-managed Google
Sign-In: the login page needs `google_client_id` to render the GSI button, but can only fetch
it after the user has already logged in.

`google_client_id` is not a secret — it appears in page source verbatim and must be sent to
the browser. There is no security value in gating it.

**Workaround applied in this project:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` env var — operators
must register their own Google OAuth app rather than using the platform-managed credential.

**Recommended fix:** Expose an unauthenticated public config endpoint:

```
GET /v1/config/public  →  200 { google_client_id: string }
```

---

## ✅ FIXED in 0.4.0 — Merchant auth role-mismatch surfaces as `ForbiddenError` (HTTP 403)

`POST /v1/auth/merchant/login/*` returns a generic `"invalid role"` message when a valid buyer
account attempts merchant login. There is no indication that the credentials are correct but
the account lacks merchant access. Developers waste time debugging OAuth config or SDK
integration when the real fix is to use a different account or have the role upgraded.

**Recommended fix:** Return a distinct `403` with an actionable message:

```json
{ "error": "This account does not have merchant access. Sign in with a merchant or owner account." }
```

---
