---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Remove `client.seller` from `@ledewire/node` and `lw.seller` from `@ledewire/browser`.

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
