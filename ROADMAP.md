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

- [ ] `packages/node/src/resources/wallet.ts` — `balance`, `transactions`, `createPaymentSession`, `getPaymentStatus`
- [ ] `packages/node/src/resources/purchases.ts` — `create`, `list`, `get`
- [ ] `packages/node/src/resources/content.ts` — `getWithAccess`
- [ ] `packages/node/src/resources/checkout.ts` — `state` (wraps `getWithAccess`, maps to `CheckoutState`)
- [ ] Wire all into `NodeClient`; replace all placeholder classes
- [ ] Tests for all methods

---

## Phase 5 — `@ledewire/node`: Sales, buyers, store config + `NodeClient` complete

> Completes the merchant store surface. `NodeClient` has zero placeholder classes.

**Endpoints:** `GET /v1/merchant/{store_id}/sales/summary`, `GET /v1/merchant/{store_id}/sales`, `GET /v1/merchant/{store_id}/sales/{id}`, `GET /v1/merchant/{store_id}/buyers`, `GET/PATCH /v1/merchant/{store_id}/config`

- [ ] `packages/node/src/resources/merchant/sales.ts` — `summary`, `list`, `get`
- [ ] `packages/node/src/resources/merchant/buyers.ts` — `list`
- [ ] `packages/node/src/resources/merchant/config.ts` — `get`, `update`
- [ ] All merchant resources wired into `MerchantNamespace`; all placeholder classes removed from `NodeClient`
- [ ] Tests for all methods
- [ ] `pnpm test:coverage` for `packages/node` ≥90%

---

## Phase 6 — `@ledewire/browser`: All buyer flows + IIFE bundle

> Mirrors Phase 1 + Phase 4 buyer APIs. Adds the CDN bundle.

- [ ] `packages/browser/src/resources/auth.ts` — buyer auth (signup, email login, google, refresh)
- [ ] `packages/browser/src/resources/wallet.ts` — balance, transactions, createPaymentSession, getPaymentStatus
- [ ] `packages/browser/src/resources/purchases.ts` — create, list, get
- [ ] `packages/browser/src/resources/content.ts` — getWithAccess
- [ ] `packages/browser/src/resources/checkout.ts` — state
- [ ] Wire all into `BrowserClient`; all placeholder classes removed
- [ ] Vite IIFE bundle build (`dist/ledewire.min.js`) with `Ledewire` global
- [ ] Tests (with `jsdom` environment) for all browser resource methods
- [ ] `pnpm test:coverage` for `packages/browser` ≥90%
- [ ] Manual CDN smoke test via `examples/browser-cdn/index.html`

---

## Phase 7 — CI hardening

> Make the pipeline production-grade.

- [ ] Confirm `pnpm audit` passes with no high/critical vulnerabilities
- [ ] Add ESLint JSDoc rule (`require-jsdoc` on exported symbols) — enforced in CI
- [ ] `publint` passes for both packages (confirmed by CI step already in `ci.yml`)
- [ ] Coverage thresholds enforced (CI fails below 90%)
- [ ] `pnpm format:check` clean across all packages

---

## Phase 8 — Release pipeline + API docs

> Changesets + TypeDoc + GitHub Pages.

- [ ] Initialize Changesets (`.changeset/config.json`)
- [ ] TypeDoc config (`typedoc.json`) — generates API reference from JSDoc
- [ ] GitHub Pages deploy step in `release.yml` for TypeDoc output
- [ ] Minimal Docusaurus skeleton in `docs/` — getting-started guides for browser CDN and node npm patterns
- [ ] `AGENTS.md` + `llms.txt` at repo root

---

## Phase 9 — Examples + polish

> Working, runnable examples for both integration patterns.

- [ ] `examples/node-merchant/index.ts` — full merchant store walkthrough (auth → create content → list sales)
- [ ] `examples/browser-cdn/index.html` — complete CDN embed (init → checkout.state → purchase flow)
- [ ] Update `README.md` with badges (CI, npm version, coverage) and quickstart for each package
- [ ] Final pass: ensure every exported symbol has JSDoc with `@example`

---

## Session log

| Session | Date       | Phases completed |
| ------- | ---------- | ---------------- |
| 1       | 2026-03-09 | Phase 1 ✅       || 2       | 2026-03-09 | Phase 1 ✅, Phase 2 ✅, Phase 3 ✅ || 2       | 2026-03-09 | Phase 2 ✅       |
