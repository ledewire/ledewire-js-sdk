---
'@ledewire/node': minor
---

**Complete API endpoint coverage** — Added 14 missing endpoints to achieve 100% coverage of the LedeWire API

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
