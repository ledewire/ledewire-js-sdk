# @ledewire/browser

## 0.14.0

### Minor Changes

- c82429d: Sync with LedeWire API `4c5f4a56`.

  - **Breaking:** `user.spendCap.update()` takes `daily_spend_limit_cents: number`. The API refuses `null` (422): a Buyer can change the cap but not remove it.
  - **Breaking:** `spending_limit_cents` is removed from Buyer-key creation (`user.apiKeys.create()`) and from `UserApiKey`. The API refuses it with 400. A key has no spend limit of its own; the Buyer's daily Spend cap limits what it spends.
  - `PurchaseResponse.payment_key_id` names the Payment key that paid for an x402 purchase, and is `null` for every other purchase.
  - Publication works carry `page_kind`, `page_kind_basis`, `topics` and `topics_basis`. `publications.listWorks()` takes a `page_kind` filter (node). Acquisition works record the same labels from pricing.
  - Purchase docs: a 429 `RateLimitError` past 60 purchases a minute, and SEC filings open to every signed-in Buyer (`not_subscribed` is no longer returned).

- c355d27: Register, list and revoke Payment keys, the public Ed25519 keys that sign x402 payments: `user.paymentKeys.list()` / `.create({ name, public_key, proof })` / `.revoke(id)` for a Buyer, and `company.machineUsers.paymentKeys.list(machineUserId)` / `.create(machineUserId, body)` / `.revoke(machineUserId, id)` for a Company admin managing a Machine user's keys. Adds the `PaymentKey`, `PaymentKeyCreateRequest` and `CompanyMachineUserPaymentKeyList` types and `createMockClient()` stubs.

## 0.13.0

### Minor Changes

- 739adaf: Exported request, response and query-parameter types that copied a spec schema by hand are now aliases of the generated types, with a type test pinning each one to `ledewire.yml`, so they can no longer drift from the API. Their names are unchanged.

  - **Breaking:** `StoreConfig` (`client.merchant.config.get`) has a required `google_client_id: string | null`, as the API sends it, not an optional `string`. Handle `null` (no Google client ID configured).
  - **Breaking:** `PublicationListParams`, `PublicationWorksParams`, `AcquisitionWorksParams`, `X402DiscoveryParams`, `CompanyReportFilters`, `CompanyPurchasesParams` and `CompanySpendParams` no longer carry a `[key: string]` index signature, so a parameter the endpoint does not take is a type error. Pass only the documented parameters.
  - `MerchantPricingRuleCreateRequest` (`client.merchant.pricingRules.create`) is now exported from `@ledewire/node`.

- d6290bc: Add `InvalidCursorError`, thrown when `content.search` refuses its `cursor` (`422` with `error.type` `'invalid_cursor'`): the cursor is invalid, expired, in an older format, or was issued for different filters. Drop the cursor and restart the search from the first page; the same cursor never succeeds on retry. It extends `LedewireError` with `statusCode` 422 and is matched on `error.type` alone, so any other 422 stays a plain `LedewireError`. Needs an API that sends `invalid_cursor` (ledewire/api#1692). Syncs `ledewire.yml` from the API (ledewire/api `3eb80e29831f41310acdd370dd15f5306096195d`): `ErrorType` gains `'invalid_cursor'`.
- afcfb66: `client.auth.loginWithApiKey()` now resolves with `store_id`, the store the API key belongs to, typed by the new `StoreAuthenticationResponse`: `const { store_id } = await client.auth.loginWithApiKey({ key, secret })`, then pass it to `client.merchant.*(store_id)`. It is read from the API response (added in ledewire/api#1675), never decoded from the token.
  `StoredTokens` gains an optional `storeId`, set on a store API-key login and on every refresh of that session, so `storage.setTokens` and `onTokenRefreshed` see it. It is absent for every other session.
- ba39f03: Add `purchases.licenseDocument(id)` to `@ledewire/node` and `@ledewire/browser`, which downloads the licence document a purchase's `license.document_url` points at. It resolves to a `LicenseDocument`, `{ body: ArrayBuffer, contentType }`, because the document is a PDF, Markdown (an SEC filing's terms) or other bytes rather than JSON. It throws `AuthError` (401), `ForbiddenError` (403) and `NotFoundError` (404), and is stubbed in `createMockClient()`.
  Export the `PurchaseLicense`, `PurchasePublication`, `ContentSearchFiling` and `LicenseDocument` types, and document `license`, `content.publication` and `content.filing` on purchases, `filing` on search results, and the `publication`, `form_type`, `ticker` and `cik` filters on `content.search()` (SEC EDGAR filings).
- f59fe79: Add `RateLimitError`, thrown for a `429 Too Many Requests` from any endpoint (for example `content.search`, which allows 15 searches a minute per buyer). Its `retryAfter` carries the `Retry-After` header as seconds to wait, or `undefined` when the response sent none. It extends `LedewireError` with `statusCode` 429, so existing `statusCode === 429` checks keep working. `@ledewire/x402-client` re-exports it and throws it for a 429 on the paid retry or the buyer-key login (which used to surface as an `AuthError`).
- 0338e5f: Remove `client.seller` from `@ledewire/node` and `lw.seller` from `@ledewire/browser`.

  **Breaking:** the API retired `/v1/seller/{sales,sales/summary,buyers,config}`, and
  `/v1/seller/content*` is past its 2026-09-01 sunset, so the `seller` namespaces called routes
  that no longer work. Node's `client.seller` (`content`, `sales`, `buyers`, `config`) is gone,
  along with its `createMockClient()` stubs and the seller-shaped `ContentSearchRequest` type (use
  `MerchantContentSearchRequest`; `ContentSearchRequest` now names the buyer search request).
  `client.merchant.*` accepts store API-key tokens from
  `client.auth.loginWithApiKey()`; every replacement takes the store's id, which you pass
  explicitly for now:

  | Before                         | After                                                                |
  | ------------------------------ | -------------------------------------------------------------------- |
  | `seller.sales.summary()`       | `merchant.sales.summary(storeId)`                                    |
  | `seller.sales.list()`          | `merchant.sales.list(storeId)` (paginated, one row per content item) |
  | `seller.buyers.list()`         | `merchant.buyers.list(storeId)`                                      |
  | `seller.config.get()`          | `merchant.config.get(storeId)`                                       |
  | `seller.content.*(storeId, …)` | `merchant.content.*(storeId, …)`                                     |

  In `@ledewire/browser`, the whole `lw.seller` namespace is removed: `lw.seller.content.*`
  and `lw.seller.loginWithApiKey()`, plus the `SellerContentSearchRequest` type. The browser SDK
  is buyer-only, and a store API key does not belong in a browser; manage store content from a
  server with `@ledewire/node`'s `client.merchant.content.*`. Buyer API-key login
  (`lw.auth.loginWithBuyerApiKey()`) is unaffected.

- ce474c3: Sync `ledewire.yml` from the API (ledewire/api `8d0afc18e7a21132b5b99003d2b6ff8fd6ad6cfe`) and regenerate the types. `content.getWithAccess`, `checkout.state` and `wallet.getPaymentStatus` now return exactly what their operation's 200 declares, and a type test pins them (plus signup and password reset) to the spec.

  - **Breaking:** `AuthPasswordResetResponse` (buyer `auth.requestPasswordReset` / `auth.resetPassword`) is now the flat `{ message: string }` the API sends, not `{ data?: { message?: string } }`. Read `result.message`.
  - **Breaking:** `auth.loginWithEmail` and `auth.loginWithGoogle` request bodies now require `email` and `password`, and `id_token`, matching the spec.
  - **Breaking:** `CheckoutStateResponse.content_title` (and `CheckoutState`) is `string | null`.
  - **Breaking:** `WalletPaymentStatusResponse.status` can be `'reverted'`, so an exhaustive `switch` on it needs a new case. `balance_cents` stays `number | null`.
  - **Breaking:** `LedewireSettlementResponse.accessToken` (`@ledewire/x402-client`) is an optional `string`, never `null`.
  - **Breaking:** `X402BazaarResource.metadata.title` is `string | null`.
  - **Breaking:** `CompanyMemberUpdateRequest` (`company.members.update`) requires `role` or `daily_spend_limit_cents`. An empty body no longer type-checks.
  - **Breaking:** `ContentWithAccessResponse` is the API's closed shape: `id`, `content_type`, `title` (nullable), `teaser`, `price_cents`, `visibility: 'public'`, `resource_url` (nullable) and `access_info`. `content_body`, `content_uri`, `external_identifier` and `metadata` are gone. The deliverable comes only from `purchases.create()`.
  - **Breaking:** `MerchantSaleResponse` has `buyer_ref` in place of `buyer_id` and `buyer`, and its `fees.*_cents` are nullable (null until a sale completes).
  - **Breaking:** `PurchaseCreateRequest` requires `content_id` and `price_cents`.
  - **Breaking:** `PublicConfigResponse.google_client_id` is `string | null`.
  - **Breaking:** `PurchaseResponse.license`, `PurchaseResponse.content.filing`, `ContentSearchResult.filing` and `Publication.homepage` are required (nullable) fields. Reading code is unaffected; code that builds these objects, such as test mocks, must set them.
  - `AuthTokenRefreshRequest.refresh_token` is now required in the spec, but that type is not exported by the SDK, so it needs no migration.
  - `auth.signup` documents the API's `201 Created`.
  - New `AuthTokenRefreshResponse` (`@ledewire/node`): `POST /v1/auth/token/refresh` answers an `AuthenticationResponse` or a `MerchantAuthenticationResponse`.
  - Additive from the regeneration: `ContentSearchRequest` gains `cik`, `ticker`, `form_type` and `publication` filters; `ErrorType` gains `not_subscribed`, `selection_too_large` and `selection_value_too_large`; `CorpusResponse.state` gains `not_ready` and `nothing_purchased`; acquisition exclusion reasons gain `excluded_not_sold_in_bulk`; `AuthSignupRequest.name` is optional.

### Patch Changes

- ff5f513: `purchases.create()` documents `price_cents`: the price the buyer was quoted, which must equal the work's current price or the API refuses with a `422` and charges nothing. Every `purchases.create()` example in the READMEs, `llms.txt`, guides and JSDoc (including `SpendCapReachedError`) now passes it.

## 0.12.0

### Minor Changes

- 9d85e8d: A rejected login no longer looks like an expired session.

  Login, signup and password-reset calls now go out without the stored bearer token, and a `401` from them is treated as rejected credentials: the SDK no longer refreshes the session and resends the login. Before, a failed login with a session stored was sent twice, counting twice against the API's per-account login backoff, and could fire `onAuthExpired` and clear a session that was still valid.

  - A failed login rejects with `AuthError` whose `message` is the API's (e.g. `Invalid email or password`, `Invalid key or secret`) instead of `Session expired. Please re-authenticate.`
  - Affected calls: `auth.loginWithEmail`, `auth.loginWithGoogle`, `auth.loginWithBuyerApiKey`, `auth.loginWithApiKey` (node), `seller.loginWithApiKey` (browser), `merchant.auth.loginWithEmail` / `loginWithGoogle` (and their `…AndListStores` helpers), `auth.signup`, and the buyer and merchant `requestPasswordReset` / `resetPassword`.
  - **Breaking:** wrong credentials on `POST /v1/auth/login/email` (`auth.loginWithEmail`), `POST /v1/auth/merchant/login/email` (`merchant.auth.loginWithEmail`, `loginWithEmailAndListStores`) and `POST /v1/auth/login/api-key` (`auth.loginWithApiKey`, browser `seller.loginWithApiKey`) now reject with `AuthError` (401) instead of `NotFoundError` (404), as the API answers them with 401 from ledewire/api#1483. Code that caught `NotFoundError` for a bad password or key must catch `AuthError`.

## 0.11.0

### Minor Changes

- a86b6db: Errors now carry `retryAfter`, the number of seconds to wait from the response's `Retry-After` header.

  - Set on every `LedewireError` and its typed subclasses (`AuthError`, `ForbiddenError`, `NotFoundError`) when the response includes the header. It accepts both the seconds form and the HTTP-date form. A past date gives `0`, and an unparseable value gives `undefined`.
  - `publications.listWorks` no longer documents the header as unavailable.

## 0.10.0

### Minor Changes

- 614423c: Sync with the LedeWire API spec as of 2026-10-07.
  - `company.wallet.get()` reads the Company wallet (`balance_cents`, `held_cents`, `pending_top_up_cents`): the only place the Company balance appears. Admin only.
  - `company.invitations.revoke(id)` withdraws a pending invitation. Admin only.
  - `company.machineUsers.update(id, { name?, description? })` renames a Machine user or changes its description. Its keys keep working. Admin only.
  - `auth.signup()` and `auth.loginWithGoogle()` accept `invitation_token` (store invitation), and `loginWithGoogle()` also accepts `company_invitation_token`. For an existing Google account, the response's new `invitations` field reports each token's `InvitationOutcome`.
  - New types: `CompanyWallet`, `CompanyMachineUserUpdateRequest`, `InvitationOutcome`, `InvitationRefusalReason`. `ErrorType` gains `invitation_not_accepted`.

  **Behavior change (API):** a signup whose invitation token can't be accepted is now refused with a 422 `LedewireError` (`type === 'invitation_not_accepted'`, with `details.reason` and `details.invitation`) and no account is created. Previously the account was created without a membership. `company.invitations.accept()` refusals now carry `details.reason` too.

## 0.9.0

### Minor Changes

- 00a70cd: Sync with the 2026-10 LedeWire API spec.

  **Breaking (types) — Company members see no balance.** A buyer with an open Company membership
  spends from the Company wallet and never sees its balance, so these fields are now `number | null`:
  `WalletBalanceResponse.balance_cents` / `spendable_cents`, `WalletPaymentStatusResponse.balance_cents`,
  and `ContentAccessInfo.wallet_balance_cents`. Those responses, and `UserSpendCap`, gain
  `company_name` (whose wallet pays, else `null`); wallet balance and content access info also gain
  `remaining_cents` (what the buyer may still spend today). Code that does arithmetic on the balance
  must handle `null`.

  **New**
  - `company` namespace (node, `createAgentClient()`, and browser):
    - `membership.get()` / `.leave()`
    - `invitations.list()` / `.create()` / `.accept()`; `auth.signup()` accepts
      `company_invitation_token` to sign up and join in one step
    - `members.list()` / `.update()` (role or daily Spend cap) / `.remove()`
    - `machineUsers.list()` / `.create()` / `.deactivate()`, with `machineUsers.buyerKeys` and
      `machineUsers.mcpKeys` (`list` / `create` / `revoke`)
    - `wallet.createPaymentSession()` / `.listPendingTopUps()`
    - `purchases.list()` and `spend.list()` reports, filterable by member and date range
  - Node: `acquisitions.cancel()` withdraws a quote, or lets a Company admin stop a held
    Company-paid acquisition.
  - Node: `acquisitions.listWorks()` accepts `delivery_state`, `line_state`, and `exclusion_reason`
    filters (`AcquisitionWorksParams`).
  - `AcquisitionResponse` / `CorpusResponse` carry `poll_after_seconds` while a bulk step is in
    progress; poll at that interval.
  - `Publication.coverage_horizon`.
  - `ErrorType` gains the bulk-acquisition refusals `exclusions_unacknowledged`, `quote_not_ready`,
    `quote_expired`, `quote_in_progress`, `invalid_acquisition_state`, `nothing_to_hold`, and
    `run_not_started`.
  - `WalletPaymentStatusResponse.status` gains `awaiting_verification`, `processing`, and `cancelled`
    (ACH top-ups).
  - `SpendCapReachedError` falls back to the refusal body's top-level `message` (for a Company member,
    "ask a Company admin") when the error envelope has none.
  - `WalletPaymentSessionRequest.currency` is optional, as the API always allowed (it defaults to
    `usd`); the generated type had wrongly required it.
  - `createMockClient()` stubs the new methods, and a test now fails if it misses any public method.

## 0.8.1

### Patch Changes

- 647e6d8: Publish via npm trusted publishing (OIDC) instead of a long-lived npm token. Releases now carry npm provenance attestations, and each package's metadata links back to its source directory in the GitHub repository.

## 0.8.0

### Minor Changes

- 8976828: Sync with the 2026-09 LedeWire API spec.

  **Breaking — single-use purchases.** `CheckoutNextAction` / `NextRequiredAction` no longer include
  `view_content` (checkout state) or `none` (content with access): the API withdrew both. A completed
  purchase no longer implies access; `has_purchased` means "has ever bought". The purchased content is
  delivered only on the `purchases.create()` response (`content_body` as plain UTF-8, or `content_uri`)
  and is never served again, so persist it immediately.

  **New**
  - `SpendCapReachedError` (402, `error.type === 'daily_spend_cap_reached'`) with `capCents`,
    `spentCents`, `remainingCents`, `resetsAt`, and `bulkExempt`. Funding the wallet does not clear it.
    `LedewireError` gains an optional machine-readable `type`. x402-client's fetch and Axios adapters
    throw it — and map `insufficient_funds`/`invalid_ledewire_wallet_payload_token`/
    `invalid_ledewire_wallet_payload_role` to `InsufficientFundsError`/`AuthError`/`ForbiddenError` —
    from the PAID request's `402` refusal, per the x402 v2 HTTP transport spec
    (`PAYMENT-RESPONSE` header, ledewire/api#1066); a pre-api#1066 fallback still reads the same
    errors off a bare `402`/`422`/`401`/`403` when that header is absent.
  - `user.spendCap.get()` / `.update()` (node and browser).
  - `user.mcpKeys.list()` / `.create()` / `.revoke()` (node and browser).
  - Node: `publications.list()` / `.listWorks()`, and `acquisitions.*` for bulk licensing: create,
    poll, requote, acknowledge exclusions, authorize, per-work results, corpus state/build/streamed
    download, signed manifest, and signing-key history. These are also available on `createAgentClient()`.
  - Node: `x402.discoverResources()` for the public x402 Bazaar discovery endpoint.
  - Content types `html` (inline or remote), `pdf`, `image`, and `video`; `brokered` on responses.
  - Wallet balance `spendable_cents`, `held_cents`, and `holds`; `bulk_acquisition` / `bulk_hold`
    transaction reasons.

## 0.7.0

### Minor Changes

- a6cc4d3: **Buyer API key authentication, `user.apiKeys` namespace, and `createAgentClient()` factory**

  ### `auth.loginWithBuyerApiKey()` (node + browser)

  Authenticate as a buyer using a named API key + secret. Tokens are stored automatically — identical in shape to email/password login.

  ```ts
  await client.auth.loginWithBuyerApiKey({
    key: process.env.LEDEWIRE_BUYER_KEY,
    secret: process.env.LEDEWIRE_BUYER_SECRET,
  })
  ```

  ### `client.user.apiKeys` (node + browser)

  Manage buyer API keys from a portal or dashboard. The `secret` is returned **once only** at creation — store it immediately.

  ```ts
  // List existing keys (secret never included)
  const keys = await client.user.apiKeys.list()

  // Create a new agent key with an optional spend cap
  const { key, secret } = await client.user.apiKeys.create({
    name: 'my-rag-agent',
    spending_limit_cents: 1000,
  })

  // Revoke a key
  await client.user.apiKeys.revoke(keyId)
  ```

  ### `createAgentClient()` (`@ledewire/node` only)

  Factory for autonomous (headless) agents. Returns a buyer-scoped client exposing `auth`, `wallet`, `purchases`, `content`, `checkout`, and `user`. The `merchant`, `seller`, and `config` namespaces are intentionally excluded.

  ```ts
  import { createAgentClient } from '@ledewire/node'

  const agent = createAgentClient({
    key: process.env.LEDEWIRE_BUYER_KEY,
    secret: process.env.LEDEWIRE_BUYER_SECRET,
    // storage: myRedisAdapter  // recommended for serverless — default is MemoryTokenStorage
  })

  await agent.auth.loginWithBuyerApiKey({ key, secret })
  const balance = await agent.wallet.balance()
  const purchase = await agent.purchases.create({ content_id: 'abc123' })
  ```

  ### New exported types (`@ledewire/node`)

  `AuthLoginBuyerApiKeyRequest`, `UserApiKey`, `UserApiKeyCreateRequest`, `UserApiKeyCreateResponse`, `AgentClientConfig`, `AgentClient`

  ***

  **x402 pricing rules and domain verification** (`client.merchant.pricingRules` + `client.merchant.domains`, `@ledewire/node` only)

  Manage URL-pattern pricing rules and the domain verification required before creating them.

  ```ts
  // 1. Verify domain ownership (DNS TXT record)
  const verification = await client.merchant.domains.add(storeId, { domain: 'blog.example.com' })
  // verification.txt_record_name / .txt_record_value → add to DNS, platform verifies async

  // 2. Create a pricing rule for matching URLs
  const rule = await client.merchant.pricingRules.create(storeId, {
    url_pattern: 'https://blog.example.com/posts/**',
    price_cents: 150,
  })

  // 3. Deactivate without deleting
  await client.merchant.pricingRules.deactivate(storeId, rule.id)
  ```

  New exported types: `MerchantPricingRule`, `MerchantDomainVerification`

## 0.6.1

### Patch Changes

- 437ecf1: **`PaginationParams` is now exported from `@ledewire/browser`** — previously it
  was only available from `@ledewire/node`. Browser consumers building custom
  pagination UI can now import it directly:

  ```ts
  import type { PaginationParams } from '@ledewire/browser'
  ```

  **`process.env` guard for edge runtimes (`@ledewire/node`)** — the dev-mode
  warning that fires when both `storage` and `onTokenRefreshed` are configured now
  checks `typeof process === 'undefined'` before accessing `process.env`. This
  prevents a runtime crash when `@ledewire/node` is used on Cloudflare Workers,
  Deno, or Bun.

## 0.6.0

### Minor Changes

- a379cac: ## Breaking changes

  ### `lw.auth.loginWithApiKey()` moved to `lw.seller.loginWithApiKey()`

  API key authentication now lives on the seller namespace where it semantically belongs. Update all call sites:

  ```ts
  // Before
  await lw.auth.loginWithApiKey({ key: 'your_api_key' })

  // After
  await lw.seller.loginWithApiKey({ key: 'your_api_key' })
  ```

  ### `content_body` and `teaser` are now plain text

  The SDK now transparently decodes base64 on all content responses. Remove any `atob()` calls in your rendering code:

  ```ts
  // Before
  const { content_body } = await lw.content.getWithAccess('id')
  renderMarkdown(atob(content_body))

  // After — no atob() needed
  const { content_body } = await lw.content.getWithAccess('id')
  renderMarkdown(content_body)
  ```

  ### `lw.content.getWithAccess()` no longer accepts a `userId` parameter

  The second parameter was a server-side concept that had leaked into the browser package. In a browser context the authenticated user is always implicit from the token. Remove the argument if you were passing it.

  ## New features

  ### `sessionStorageAdapter`

  A new built-in token storage adapter that persists tokens for the lifetime of the current browser tab — cleared automatically when the tab is closed. Useful for sensitive workflows where `localStorage` persistence is undesirable.

  ```ts
  import { init, sessionStorageAdapter } from '@ledewire/browser'

  const lw = init({ apiKey: '...', storage: sessionStorageAdapter() })
  ```

  ## Fixes and improvements
  - **`ContentResponse` exported** from `@ledewire/browser` — was previously missing from the public surface
  - **`CheckoutState`** is now a type alias for `CheckoutStateResponse` (not a separate interface) — existing code is unaffected
  - **`external_identifier`** added to `SellerContentSearchRequest` — search content by its namespaced platform ID (e.g. `'vimeo:123456789'`)
  - **`ForbiddenError` JSDoc** now shows correct import path for both browser and node packages
  - **`metadata.reading_time`** annotated in types (not `read_time`) to prevent silent runtime `undefined`

## 0.5.0

### Minor Changes

- 75ff5e2: ## New: `lw.auth.requestPasswordReset()` and `lw.auth.resetPassword()`

  The browser SDK now exposes the full buyer password reset flow directly from `lw.auth`.

  ```ts
  // Step 1 — send reset code to buyer's email
  await lw.auth.requestPasswordReset({ email: 'buyer@example.com' })
  // → { data: { message: 'If an account with this email exists, a reset code has been sent.' } }

  // Step 2 — submit the 6-digit code and new password
  await lw.auth.resetPassword({
    email: 'buyer@example.com',
    reset_code: '123456',
    password: 'new-secure-password',
  })
  // → { data: { message: 'Password has been successfully reset.' } }
  ```

  The `reset-request` response is intentionally ambiguous — the API returns the same success message whether or not the email exists, preventing account enumeration.

  **New exported types:** `AuthPasswordResetRequestBody`, `AuthPasswordResetBody`, `AuthPasswordResetResponse`

## 0.4.0

### Minor Changes

- fb22c24: ## New: `lw.seller.content` — browse store content from the browser

  The browser SDK now includes a `seller` namespace for read-only content discovery using an API key token. This enables storefronts to list, search, and fetch their own content catalogue without needing a server-side proxy.

  ```ts
  const lw = Ledewire.init({ apiKey: 'your_api_key' })

  // Obtain a view-only seller token (API key only — no secret required)
  await lw.auth.loginWithApiKey({ key: 'your_api_key' })

  // List all content
  const items = await lw.seller.content.list()

  // Search by title, URI, or metadata
  const results = await lw.seller.content.search({ title: 'intro' })
  const byMeta = await lw.seller.content.search({ metadata: { author: 'Alice' } })

  // Fetch a single item
  const item = await lw.seller.content.get('content-id')
  ```

  ## New: `lw.auth.loginWithApiKey({ key, secret? })`

  Buyer auth now supports API key login. Provide only `key` for read-only (`view`) access — sufficient for all `lw.seller.content.*` methods. Provide both `key` and `secret` for full read/write access.

  ```ts
  // View access (read-only)
  await lw.auth.loginWithApiKey({ key: 'your_api_key' })

  // Full access (read/write)
  await lw.auth.loginWithApiKey({ key: 'your_api_key', secret: 'your_secret' })
  ```

## 0.3.0

### Minor Changes

- dc814b0: ## New: `client.config.getPublic()` — unauthenticated public config

  Both `@ledewire/node` and `@ledewire/browser` now expose a `config` namespace with a single
  `getPublic()` method. This resolves the Google Sign-In circular dependency: the
  `google_client_id` needed to render the sign-in button can now be fetched before the user
  has authenticated.

  ```ts
  // Node
  const { google_client_id } = await client.config.getPublic()

  // Browser
  const { google_client_id } = await lw.config.getPublic()
  google.accounts.id.initialize({ client_id: google_client_id, callback })
  ```

  No `apiKey` or bearer token is required. The endpoint is `GET /v1/config/public`.

  ## New: `ContentSearchRequest` extended with `title` and `uri` fields

  `seller.content.search()` now accepts `title` (case-insensitive partial match) and `uri`
  (case-insensitive partial match against `external_ref` content URIs) in addition to the
  existing `metadata` AND-match. All three fields are now optional — at least one must be
  supplied.

  ```ts
  // Search by title
  const { data } = await client.seller.content.search(storeId, { title: 'intro' })

  // Search by external URI
  const { data } = await client.seller.content.search(storeId, { uri: 'vimeo.com' })

  // Combine all three
  const { data } = await client.seller.content.search(storeId, {
    title: 'tutorial',
    uri: 'vimeo.com',
    metadata: { category: 'ml' },
  })
  ```

  ## Improved: Merchant login 403 on role mismatch is now `ForbiddenError`

  `loginWithEmail` and `loginWithGoogle` on `merchant.auth` now throw `ForbiddenError`
  (rather than a generic `LedewireError`) when credentials are valid but the account has no
  merchant store access. This is distinct from `AuthError` (wrong password / bad token).

  ```ts
  try {
    await client.merchant.auth.loginWithEmail({ email, password })
  } catch (err) {
    if (err instanceof ForbiddenError) {
      // Account exists but has no store access — wrong account
    } else if (err instanceof AuthError) {
      // Bad credentials
    }
  }
  ```

  ## New exported type: `PublicConfigResponse`

  `PublicConfigResponse` is now exported from both packages. It reflects
  `components['schemas']['PublicConfigResponse']` from the OpenAPI spec
  (`{ google_client_id: string }`).

## 0.2.2

### Patch Changes

- 3bd68d0: Fix TypeScript type declarations leaking unpublished `@ledewire/core` dependency

  `dist/index.d.ts` in both packages contained `import`/`export … from '@ledewire/core'` statements. Because `@ledewire/core` is a private internal package not published to npm, TypeScript consumers could not resolve these types, causing:
  - All re-exported types (`LedewireError`, `AuthError`, `StoredTokens`, etc.) resolving to `any`
  - `instanceof LedewireError` checks not narrowing the catch variable (`TS18046`)
  - `TokenStorage` callback parameters implicitly typed as `any` (`TS7006`)

  Both packages now produce fully self-contained declaration files with all `@ledewire/core` types inlined. Runtime behaviour is unchanged.

## 0.2.1

### Patch Changes

- f89cd38: fix: move @ledewire/core to devDependencies

  @ledewire/core is a private, internal package that is fully bundled into the
  output of @ledewire/browser and @ledewire/node at build time. Having it listed
  under `dependencies` caused npm/yarn/pnpm consumers to receive an unresolvable
  package error on install, since @ledewire/core is never published to the registry.

## 0.2.0

### Minor Changes

- 1eb6e40: Add support for external_ref content type (Vimeo, YouTube, PDFs, etc.)

### Patch Changes

- Updated dependencies [1eb6e40]
  - @ledewire/core@0.1.0
