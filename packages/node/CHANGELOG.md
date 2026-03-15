# @ledewire/node

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
