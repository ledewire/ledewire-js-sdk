# @ledewire/node

## 0.4.0

### Breaking Changes

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

  Both helpers now read `stores` from the login response directly — no second `/stores` request is made. `MerchantLoginResult.stores` is now `MerchantLoginStore[]` (fields: `.id`, `.name`, `.role`), replacing the previous `ManageableStore[]` (which had `.store_id`, `.store_name`).

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
