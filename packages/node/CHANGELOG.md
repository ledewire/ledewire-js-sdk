# @ledewire/node

## 0.12.0

### Minor Changes

- 614423c: Sync with the LedeWire API spec as of 2026-10-07.
  - `company.wallet.get()` reads the Company wallet (`balance_cents`, `held_cents`, `pending_top_up_cents`): the only place the Company balance appears. Admin only.
  - `company.invitations.revoke(id)` withdraws a pending invitation. Admin only.
  - `company.machineUsers.update(id, { name?, description? })` renames a Machine user or changes its description. Its keys keep working. Admin only.
  - `auth.signup()` and `auth.loginWithGoogle()` accept `invitation_token` (store invitation), and `loginWithGoogle()` also accepts `company_invitation_token`. For an existing Google account, the response's new `invitations` field reports each token's `InvitationOutcome`.
  - New types: `CompanyWallet`, `CompanyMachineUserUpdateRequest`, `InvitationOutcome`, `InvitationRefusalReason`. `ErrorType` gains `invitation_not_accepted`.

  **Behavior change (API):** a signup whose invitation token can't be accepted is now refused with a 422 `LedewireError` (`type === 'invitation_not_accepted'`, with `details.reason` and `details.invitation`) and no account is created. Previously the account was created without a membership. `company.invitations.accept()` refusals now carry `details.reason` too.

## 0.11.0

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

## 0.10.1

### Patch Changes

- 647e6d8: Publish via npm trusted publishing (OIDC) instead of a long-lived npm token. Releases now carry npm provenance attestations, and each package's metadata links back to its source directory in the GitHub repository.

## 0.10.0

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

## 0.9.0

### Minor Changes

- 5584a58: **Complete API endpoint coverage** — Added 14 missing endpoints to achieve 100% coverage of the LedeWire API

  ### New Features

  #### Buyer password reset

  ```ts
  await client.auth.requestPasswordReset({ email: 'buyer@example.com' })
  await client.auth.resetPassword({ email, reset_code: '123456', password: 'new-pass' })
  ```

  #### Purchase verification

  ```ts
  const { purchased } = await client.purchases.verify('content-id')
  ```

  #### Merchant content namespace (merchant JWT auth)

  Complete CRUD operations using merchant JWT instead of API key:

  ```ts
  await client.merchant.content.list(storeId)
  await client.merchant.content.create(storeId, { ... })
  await client.merchant.content.search(storeId, { title: 'intro' })
  await client.merchant.content.get(storeId, contentId)
  await client.merchant.content.update(storeId, contentId, { ... })
  await client.merchant.content.delete(storeId, contentId)
  ```

  #### Merchant domain verification trigger

  ```ts
  await client.merchant.domains.verify(storeId, { domain: 'example.com' })
  ```

  #### Seller sales, buyers, and config namespaces (API key auth)

  ```ts
  // Sales reporting
  const summary = await client.seller.sales.summary()
  const sales = await client.seller.sales.list()

  // Anonymized buyer statistics
  const buyers = await client.seller.buyers.list()

  // Store configuration
  const config = await client.seller.config.get()
  ```

  ### Type Exports

  Added exports for new request/response types:
  - `MerchantContentSearchRequest`
  - `MerchantDomainVerifyRequest`
  - `MerchantDomainVerifyResponse`

## Unreleased

### Minor Changes

- **Added missing API endpoints** — Complete SDK coverage of all LedeWire API endpoints:

  #### Buyer password reset

  ```ts
  await client.auth.requestPasswordReset({ email: 'buyer@example.com' })
  await client.auth.resetPassword({ email, reset_code: '123456', password: 'new-pass' })
  ```

  #### Purchase verification

  ```ts
  const { purchased } = await client.purchases.verify('content-id')
  ```

  #### Merchant domain verification trigger

  ```ts
  await client.merchant.domains.verify(storeId, { domain: 'example.com' })
  ```

  #### Merchant content namespace (merchant JWT auth)

  Full CRUD operations identical to `seller.content` but using merchant JWT instead of API key:

  ```ts
  await client.merchant.content.list(storeId)
  await client.merchant.content.create(storeId, { ... })
  await client.merchant.content.search(storeId, { title: 'intro' })
  await client.merchant.content.get(storeId, contentId)
  await client.merchant.content.update(storeId, contentId, { ... })
  await client.merchant.content.delete(storeId, contentId)
  ```

  #### Seller sales, buyers, and config namespaces (API key auth)

  ```ts
  // Sales reporting
  const summary = await client.seller.sales.summary()
  const sales = await client.seller.sales.list()

  // Anonymized buyer statistics
  const buyers = await client.seller.buyers.list()

  // Store configuration
  const config = await client.seller.config.get()
  ```

## 0.8.0

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

## 0.7.0

### Minor Changes

- 939da71: **`client.merchant.auth` now supports password reset** — two new methods mirror
  the buyer-side password reset flow:

  ```ts
  // Step 1: request a reset code (always returns 200 — enumeration-safe)
  await client.merchant.auth.requestPasswordReset({ email: 'merchant@example.com' })

  // Step 2: submit the code and new password
  await client.merchant.auth.resetPassword({
    email: 'merchant@example.com',
    reset_code: '123456',
    password: 'newSecurePassword',
  })
  ```

  Three new types are exported from `@ledewire/node`:
  `MerchantPasswordResetRequestBody`, `MerchantPasswordResetBody`,
  `MerchantPasswordResetResponse`.

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

  ### `content_body` and `teaser` are now plain text in and out

  The SDK now transparently handles base64 encoding on write and decoding on read for all content endpoints. Update any `seller.content.create` and `seller.content.update` call sites — pass plain text, not base64:

  ```ts
  // Before
  await client.seller.content.create(storeId, {
    content_type: 'markdown',
    content_body: Buffer.from('# Hello\n\nWorld').toString('base64'),
    teaser: Buffer.from('A short teaser.').toString('base64'),
    // ...
  })

  // After — plain text, SDK handles encoding
  await client.seller.content.create(storeId, {
    content_type: 'markdown',
    content_body: '# Hello\n\nWorld',
    teaser: 'A short teaser.',
    // ...
  })
  ```

  Responses from `get`, `list`, `search`, `create`, and `update` now return `content_body` and `teaser` as plain UTF-8 text. Remove any `Buffer.from(x, 'base64').toString()` decoding in consumer code.

  ## Fixes and improvements
  - **`ContentSearchRequest` exported** from `@ledewire/node` — was previously missing from the public surface
  - **`external_identifier`** added to `ContentSearchRequest` — search content by its namespaced platform ID (e.g. `'vimeo:123456789'`)
  - **`content.getWithAccess(id, userId?)`** — JSDoc now documents the `userId` parameter as a merchant server-side proxy lookup (check a specific buyer's access state without impersonating them)
  - **`metadata.reading_time`** annotated in types (not `read_time`) to prevent silent runtime `undefined`
  - **`ForbiddenError` JSDoc** now shows correct import path for both browser and node packages

## 0.5.0

### Breaking Changes

- `ManageableStore` (returned by `client.merchant.auth.listStores()`) fields renamed
  to match `MerchantLoginStore`: `store_id` → `id`, `store_name` → `name`.

  Both types now use the same field names for the store identifier and display name,
  eliminating the context-switching between combo helpers and `listStores()`.

  ```ts
  // Before
  const stores = await client.merchant.auth.listStores()
  stores[0].store_id // string
  stores[0].store_name // string

  // After
  stores[0].id // string
  stores[0].name // string
  ```

  `store_key`, `role`, `is_author`, and `logo` are unchanged.

- `MerchantLoginResult.tokens` is now typed as `StoredTokens` instead of
  `MerchantAuthenticationResponse`.

  Previously the combo helpers returned the raw API shape (snake_case fields,
  `expires_at` as an ISO 8601 string), requiring manual remapping before the
  tokens could be passed to a `TokenStorage` adapter:

  ```ts
  // Before — manual remapping required
  const { tokens } = await client.merchant.auth.loginWithEmailAndListStores(...)
  storage.accessToken = tokens.access_token
  storage.expiresAt = parseExpiresAt(tokens.expires_at)
  ```

  Now `tokens` is already normalized — ready to use directly:

  ```ts
  // After — no remapping needed
  const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores(...)
  // tokens: { accessToken, refreshToken, expiresAt } — same shape as TokenStorage
  await myStorage.setTokens(tokens)
  const storeId = stores[0].id
  ```

  The tokens are still stored automatically in the configured `storage` adapter
  (behaviour unchanged). This only affects code that reads fields off `tokens`
  directly — update any `tokens.access_token` → `tokens.accessToken`,
  `tokens.expires_at` → `tokens.expiresAt`.

  Applies to both `loginWithEmailAndListStores` and `loginWithGoogleAndListStores`.

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

## 0.3.0

### Minor Changes

- 4a823a9: ## Breaking: all list endpoints now return paginated envelopes

  `merchant.users.list`, `merchant.sales.list`, `merchant.buyers.list`, `seller.content.list`, and `seller.content.search` now return `{ data, pagination }` envelopes instead of plain arrays.

  ```ts
  // Before
  const items = await client.seller.content.list(storeId)

  // After
  const { data: items, pagination } = await client.seller.content.list(storeId)
  console.log(
    `${pagination.total} total, page ${pagination.current_page} of ${pagination.total_pages}`,
  )
  ```

  All list methods now accept an optional `{ page?, per_page? }` second argument.

  ## New: `merchant.users.update()` for per-author fee management

  ```ts
  // Set a custom revenue share for an author (basis points: 1800 = 18%)
  await client.merchant.users.update(storeId, userId, { author_fee_bps: 1800 })

  // Revert to store default
  await client.merchant.users.update(storeId, userId, { author_fee_bps: null })
  ```

  ## Changed: `loginWithEmailAndListStores` / `loginWithGoogleAndListStores` are now a single HTTP call

  Both helpers now read `stores` from the login response directly — no second `/stores` request is made. `MerchantLoginResult.stores` is now `MerchantLoginStore[]` (fields: `.id`, `.name`, `.role`), replacing the previous `ManageableStore[]`.

  ```ts
  const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores(email, password)
  console.log(stores[0].id) // ✅  was stores[0].store_id
  console.log(stores[0].name) // ✅  was stores[0].store_name
  ```

  ## New: `@ledewire/node/testing` subpath export

  Testing utilities (`createMockClient`, `MockNodeClient`) are now published under a dedicated subpath so they never end up in production bundles:

  ```ts
  import { createMockClient } from '@ledewire/node/testing'
  ```

  ## New exported types

  `MerchantLoginStore`, `PaginationMeta`, `PaginatedContentList`, `PaginatedSalesList`, `PaginatedBuyersList`, `PaginatedUsersList`, `PaginationParams`, `MerchantUserUpdateRequest`

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
