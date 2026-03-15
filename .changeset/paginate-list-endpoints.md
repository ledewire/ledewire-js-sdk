---
'@ledewire/node': minor
---

## Breaking: all list endpoints now return paginated envelopes

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
