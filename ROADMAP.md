# LedeWire JS SDK — Build Roadmap

Each phase is designed to fit in a single focused session.
"Done" means: typecheck passes, tests pass at ≥90% coverage for new code, ESLint clean.

---

## Phase 0 — Stabilize & tooling ✅ **DONE**

> Prerequisite for everything. No new API surface.

- [x] Fix 3 existing typecheck errors (`fetch` in node tsconfig via `@types/node@20`, `exactOptionalPropertyTypes` in both client factories, field init ordering in `NodeClient`/`BrowserClient`)
- [x] Install `openapi-typescript` + `openapi-typescript-helpers`; add `generate:types` script to `packages/core`
- [x] Run codegen → `src/api.gen.ts` generated; `types.ts` rewritten to alias generated schemas
- [x] Add MSW test server helper (`packages/core/src/test-utils/server.ts`) + fixtures — shared by all test suites
- [x] Update Vitest coverage excludes (api.gen.ts, index.ts, types.ts, test-utils)
- [x] Write first real tests: `errors.test.ts` (7), `token-manager.test.ts` (14), `http-client.test.ts` (15) = 36 tests, 99.47% line coverage in core
- [x] `pnpm typecheck && pnpm build` passes clean across all 4 packages

---

## Phase 1 — `@ledewire/node`: Auth namespace ✅ **DONE**

> First real API surface. Establishes namespace implementation pattern for all later phases.

**Endpoints:** `POST /v1/auth/signup`, `POST /v1/auth/login/email`, `POST /v1/auth/login/google`, `POST /v1/auth/login/api-key`, `POST /v1/auth/token/refresh`

- [x] `packages/node/src/resources/auth.ts` — `AuthNamespace` with `signup`, `loginWithEmail`, `loginWithGoogle`, `loginWithApiKey`
- [x] Wire `AuthNamespace` into `NodeClient` constructor (replace placeholder)
- [x] `packages/node/src/resources/auth.test.ts` — MSW boundary tests for all methods + token storage verification
- [x] Additional types in `core/types.ts`: `AuthSignupRequest`, `AuthLoginEmailRequest`, etc. (or generated aliases)

---

## Phase 2 — `@ledewire/node`: Merchant auth + team management ✅ **DONE**

> Merchant login flow and user management.

**Endpoints:** `POST /v1/auth/merchant/login/email`, `POST /v1/auth/merchant/login/google`, `GET /v1/auth/merchant/stores`, `GET/POST /v1/merchant/{store_id}/users`, `DELETE /v1/merchant/{store_id}/users/{id}`

- [x] `packages/node/src/resources/merchant/auth.ts` — `MerchantAuthNamespace` with `loginWithEmail`, `loginWithGoogle`, `listStores`
- [x] `packages/node/src/resources/merchant/users.ts` — `MerchantUsersNamespace` with `list`, `invite`, `remove`
- [x] Wire into `MerchantNamespace` + `NodeClient`
- [x] Tests for all methods

---

## Phase 3 — `@ledewire/node`: Seller content management

> CRUD for store content (API key auth).

**Endpoints:** `GET/POST /v1/merchant/{store_id}/content`, `GET /v1/merchant/{store_id}/content/search`, `GET/PATCH/DELETE /v1/merchant/{store_id}/content/{id}`

- [x] `packages/node/src/resources/seller/content.ts` — `SellerContentNamespace` with `list`, `create`, `search`, `get`, `update`, `delete`
- [x] Wire into `SellerNamespace` + `NodeClient`
- [x] Tests for all methods (happy path + 401/404 error cases)

---

## Phase 4 — `@ledewire/node`: Buyer flows (wallet, purchases, content, checkout)

> The shared buyer surface — also forms the basis for `@ledewire/browser`.

**Endpoints:** `GET /v1/wallet/balance`, `GET /v1/wallet/transactions`, `POST /v1/wallet/payment-session`, `GET /v1/wallet/payment-status/{session_id}`, `GET/POST /v1/purchases`, `GET /v1/purchases/{id}`, `GET /v1/content/{id}/with-access`

- [x] `packages/node/src/resources/wallet.ts` — `balance`, `transactions`, `createPaymentSession`, `getPaymentStatus`
- [x] `packages/node/src/resources/purchases.ts` — `create`, `list`, `get`
- [x] `packages/node/src/resources/content.ts` — `getWithAccess`
- [x] `packages/node/src/resources/checkout.ts` — `state` (wraps `getWithAccess`, maps to `CheckoutState`)
- [x] Wire all into `NodeClient`; replace all placeholder classes
- [x] Tests for all methods

---

## Phase 5 — `@ledewire/node`: Sales, buyers, store config + `NodeClient` complete

> Completes the merchant store surface. `NodeClient` has zero placeholder classes.

**Endpoints:** `GET /v1/merchant/{store_id}/sales/summary`, `GET /v1/merchant/{store_id}/sales`, `GET /v1/merchant/{store_id}/sales/{id}`, `GET /v1/merchant/{store_id}/buyers`, `GET/PATCH /v1/merchant/{store_id}/config`

- [x] `packages/node/src/resources/merchant/sales.ts` — `summary`, `list`, `get`
- [x] `packages/node/src/resources/merchant/buyers.ts` — `list`
- [x] `packages/node/src/resources/merchant/config.ts` — `get`
- [x] All merchant resources wired into `MerchantNamespace`; all placeholder classes removed from `NodeClient`
- [x] Tests for all methods
- [x] `pnpm test:coverage` for `packages/node` ≥90%

---

## Phase 6 — `@ledewire/browser`: All buyer flows + IIFE bundle

> Mirrors Phase 1 + Phase 4 buyer APIs. Adds the CDN bundle.

- [x] `packages/browser/src/resources/auth.ts` — buyer auth (signup, email login, google, refresh)
- [x] `packages/browser/src/resources/wallet.ts` — balance, transactions, createPaymentSession, getPaymentStatus
- [x] `packages/browser/src/resources/purchases.ts` — create, list, get
- [x] `packages/browser/src/resources/content.ts` — getWithAccess
- [x] `packages/browser/src/resources/checkout.ts` — state
- [x] Wire all into `BrowserClient`; all placeholder classes removed
- [x] Vite IIFE bundle build (`dist/ledewire.min.js`) with `Ledewire` global
- [x] Tests (with `jsdom` environment) for all browser resource methods
- [x] `pnpm test:coverage` for `packages/browser` ≥90%
- [x] Manual CDN smoke test via `examples/browser-cdn/index.html`

---

## Phase 7 — CI hardening

> Make the pipeline production-grade.

- [x] Confirm `pnpm audit` passes with no high/critical vulnerabilities
- [x] Add ESLint JSDoc rule (`require-jsdoc` on exported symbols) — enforced in CI
- [x] `publint` passes for both packages (confirmed by CI step already in `ci.yml`)
- [x] Coverage thresholds enforced (CI fails below 90%)
- [x] `pnpm format:check` clean across all packages

---

## Phase 8 — Release pipeline + API docs

> Changesets + TypeDoc + GitHub Pages.

- [x] Initialize Changesets (`.changeset/config.json`)
- [x] TypeDoc config (`typedoc.json`) — generates API reference from JSDoc
- [x] GitHub Pages deploy step in `release.yml` for TypeDoc output
- [x] Minimal docs skeleton in `docs/` — static HTML getting-started guides for browser CDN and node npm patterns
- [x] `AGENTS.md` + `llms.txt` at repo root

---

## Phase 9 — Examples + polish

> Working, runnable examples for both integration patterns.

- [x] `examples/node-merchant/index.ts` — full merchant store walkthrough (auth → create content → list sales)
- [x] `examples/browser-cdn/index.html` — complete CDN embed (init → checkout.state → purchase + Stripe guide)
- [x] Update `README.md` with badges (CI, coverage, license) and quickstart for each package
- [x] Final pass: `@example` added to every exported namespace class across all 12 resource files

---

## Session log

| Session | Date       | Phases completed                                                                                                                                                                                                                                                                   |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | 2026-03-09 | Phase 1 ✅                                                                                                                                                                                                                                                                         |
| 2       | 2026-03-09 | Phase 1 ✅, Phase 2 ✅, Phase 3 ✅                                                                                                                                                                                                                                                 |
| 3       | 2026-03-09 | Phase 4 ✅, Phase 5 ✅                                                                                                                                                                                                                                                             |
| 4       | 2026-03-09 | Phase 6 ✅, Phase 7 ✅, Phase 8 ✅                                                                                                                                                                                                                                                 |
| 5       | 2026-03-13 | SDK feedback triage: bundled types fix (v0.2.2), discriminated `Content` union, `loginWithEmailAndListStores`, `@ledewire/node/testing` subpath, JSDoc/README improvements (v0.2.3)                                                                                                |
| 6       | 2026-03-15 | API spec update: regenerated `api.gen.ts`, pagination on all list endpoints → `v0.3.0`, `merchant.users.update()` for `author_fee_bps`, `MerchantLoginStore` embedded in login response (single HTTP call), fixture + test + README updates                                        |
| 7       | 2026-04-05 | x402 pricing rules + domain verification (merchant namespace), full security pass (`encodeURIComponent` on all path segments, `pnpm.overrides` for audit), buyer API + agent work: `auth.loginWithBuyerApiKey`, `user.apiKeys.{list,create,revoke}`, `createAgentClient()` factory |

---

## Buyer portal gaps

Gaps identified during buyer portal readiness review (2026-04-06).
Split into **API server prerequisites** (require spec + server changes) and **SDK work** (can be done in this repo once unblocked).

### API server prerequisites

These gaps require new endpoints before the SDK can be written.

#### GAP-1 — Public content catalog endpoint

**Blocker for:** buyer portal home/browse page and any content listing UI.

There is no buyer-facing endpoint to list purchasable content for a store. `content.getWithAccess(id)` requires a known content ID. A portal that needs to let buyers browse available titles cannot do so.

**Proposed spec addition:**

```
GET /v1/stores/:store_key/catalog?page=&per_page=
```

Returns `PaginatedContentList` filtered to `visibility: public`. No auth required.
The `store_key` param (rather than `store_id`) avoids exposing internal UUIDs in public URLs.

**SDK work once spec is added:** new `catalog.list(storeKey, params?)` namespace in both `@ledewire/node` and `@ledewire/browser`, exported type aliases, tests.

---

#### GAP-2 — Buyer profile endpoint (read + update)

**Blocker for:** buyer portal "Account settings" page — display name, change email/password while logged in.

The `User` schema exists in `ledewire.yml` (fields: `id`, `name`, `email`, `role`) but there is no corresponding endpoint.

**Proposed spec addition:**

```
GET  /v1/user/profile              → User
PATCH /v1/user/profile             → User   (body: { name?, email? })
POST /v1/user/profile/change-password  → void  (body: { current_password, new_password })
```

**SDK work once spec is added:** `user.profile.get()`, `user.profile.update(body)`, `user.profile.changePassword(body)` added to the existing `UserNamespace` in both packages.

---

#### GAP-3 — Server-side token revocation (logout)

**Security gap.** `auth.logout()` only clears local token storage. There is no `DELETE /v1/auth/token` endpoint to invalidate the refresh token server-side, meaning a stolen refresh token remains valid until it expires naturally.

**Proposed spec addition:**

```
DELETE /v1/auth/token    (sends current refresh_token in body; invalidates it server-side)
```

**SDK work once spec is added:** update `auth.logout()` in both packages to call the endpoint before clearing local storage. Fall back to local clear if the request fails (e.g. already expired).

---

### SDK work (can be done in this repo)

These gaps are fixable without new server endpoints.

#### GAP-4 — `wallet.transactions` and `purchases.list` missing pagination

Both endpoints return plain arrays in the current spec. At scale (a buyer with hundreds of purchases) this will be slow and memory-heavy for the server.

**Action:** raise with the API team to add `page`/`per_page` query params and return `{ data, pagination }` envelopes, consistent with all other list endpoints. Once spec is updated, the SDK methods accept `params?: PaginationParams` and return paginated envelopes.

---

#### GAP-5 — No Next.js SSR token storage guide or adapter

Next.js App Router Server Components and Route Handlers require tokens in cookies (via `next/headers` `cookies()`) rather than localStorage or in-memory. The `TokenStorage` interface is implementable by portal builders, but there is no documented pattern or built-in adapter.

**Action:** add a `cookieStorageAdapter(getCookie, setCookie, clearCookie)` factory to `@ledewire/node` (or publish a `@ledewire/next` helper package), plus a guide in `docs/` covering token persistence in Next.js SSR, middleware-based refresh, and the `onAuthExpired` redirect pattern.
