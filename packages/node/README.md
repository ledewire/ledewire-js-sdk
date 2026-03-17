# @ledewire/node

[![npm](https://img.shields.io/npm/v/@ledewire/node)](https://www.npmjs.com/package/@ledewire/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Node.js SDK for the [LedeWire](https://api.ledewire.com/api-docs/index.html) content marketplace — full API surface for building merchant stores, managing sellers, and processing buyer flows on the server side.

## Install

```bash
npm install @ledewire/node
```

## Quick Start

```ts
import { createClient } from '@ledewire/node'

// Full access: API key + secret grants read/write seller permissions
const client = createClient({
  apiKey: process.env.LEDEWIRE_API_KEY,
  apiSecret: process.env.LEDEWIRE_API_SECRET,
})

// Merchant email/password auth
const client = createClient()
await client.merchant.auth.loginWithEmail({ email, password })
const stores = await client.merchant.auth.listStores()
```

## Client Namespaces

| Namespace                | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `client.config`          | Platform-level public config (no auth required)     |
| `client.auth`            | Buyer signup, email/password login, Google OAuth    |
| `client.wallet`          | Buyer wallet balance and payment sessions           |
| `client.purchases`       | Buyer purchase history and create purchases         |
| `client.content`         | Fetch content with buyer access info                |
| `client.checkout`        | Checkout state — what action is required next       |
| `client.merchant.auth`   | Merchant login (email / Google) and store discovery |
| `client.merchant.users`  | Merchant user management                            |
| `client.merchant.buyers` | Buyer management within a store                     |
| `client.merchant.sales`  | Sales reporting                                     |
| `client.merchant.config` | Store configuration                                 |
| `client.seller.content`  | Seller content management (list, create, update)    |

## Configuration

```ts
const client = createClient({
  apiKey: process.env.LEDEWIRE_API_KEY,
  apiSecret: process.env.LEDEWIRE_API_SECRET, // omit for read-only seller access
  baseUrl: 'https://api-staging.ledewire.com', // optional, defaults to production

  // Persist tokens across server restarts (optional)
  storage: {
    getTokens: async () => JSON.parse((await redis.get('lw:tokens')) ?? 'null'),
    setTokens: async (t) => redis.set('lw:tokens', JSON.stringify(t)),
    clearTokens: async () => redis.del('lw:tokens'),
  },

  onTokenRefreshed: async (tokens) => {
    await db.sessions.upsert({ tokens })
  },

  onAuthExpired: () => {
    console.error('LedeWire session expired — re-authenticate')
  },
})
```

Token refresh is handled automatically — you never need to call a refresh method manually.

> **Serverless / edge note:** The default `MemoryTokenStorage` resets on every cold start,
> which means tokens are lost between function invocations. Always provide a custom `storage`
> adapter (database, Redis, encrypted cookie) when deploying to serverless or edge runtimes.

## Example: Merchant JWT Auth (no API key)

Use this flow when running a merchant backend that authenticates via email/password or Google.
The one-step helper logs in and returns both the token response and the accessible stores list
in a single call:

```ts
import { createClient } from '@ledewire/node'

const client = createClient({
  // Persist tokens across requests (required for serverless)
  storage: {
    getTokens: async () => JSON.parse((await redis.get('lw:tokens')) ?? 'null'),
    setTokens: async (t) => redis.set('lw:tokens', JSON.stringify(t)),
    clearTokens: async () => redis.del('lw:tokens'),
  },
  onAuthExpired: () => {
    // Session fully expired — redirect user to re-authenticate
    redirect('/login')
  },
})

// Single call: logs in and returns stores together
const { stores } = await client.merchant.auth.loginWithEmailAndListStores({
  email: 'owner@example.com',
  password: process.env.MERCHANT_PASSWORD,
})
const storeId = stores[0].id
```

Or use separate calls if you need the token response independently:

```ts
await client.merchant.auth.loginWithEmail({ email, password })
const stores = await client.merchant.auth.listStores()
const storeId = stores[0].store_id // ManageableStore uses .store_id
```

## Example: Merchant Store Setup

```ts
const client = createClient()

await client.merchant.auth.loginWithEmail({
  email: 'owner@example.com',
  password: process.env.MERCHANT_PASSWORD,
})

const stores = await client.merchant.auth.listStores()
const storeId = stores[0].store_id // ManageableStore uses .store_id

// Create a markdown article
await client.seller.content.create(storeId, {
  content_type: 'markdown',
  title: 'Hello World',
  content_body: btoa('# Hello World\nFull article body here.'),
  price_cents: 500,
  visibility: 'public',
})

// Create an external reference (e.g. a Vimeo video)
await client.seller.content.create(storeId, {
  content_type: 'external_ref',
  title: 'Intro to Machine Learning',
  content_uri: 'https://vimeo.com/987654321',
  external_identifier: 'vimeo:987654321',
  price_cents: 1500,
  visibility: 'public',
})

const items = await client.seller.content.list(storeId)
// items.data — ContentListItem[]
// items.pagination — PaginationMeta

// Search by title (partial match), URI, and/or metadata
const results = await client.seller.content.search(storeId, { title: 'intro' })
const byUri = await client.seller.content.search(storeId, { uri: 'vimeo.com' })
const combined = await client.seller.content.search(storeId, {
  title: 'tutorial',
  metadata: { category: 'ml' },
})

// Fetch Google OAuth client ID before the user has signed in
const { google_client_id } = await client.config.getPublic()
// google.accounts.id.initialize({ client_id: google_client_id, callback })
```

## Error Handling

All SDK errors extend `LedewireError` — use `instanceof` checks on named subclasses:

```ts
import { createClient, ForbiddenError, AuthError, NotFoundError } from '@ledewire/node'

try {
  await client.merchant.auth.loginWithGoogle({ id_token })
} catch (err) {
  if (err instanceof ForbiddenError) {
    // 403 — credentials are VALID but the account has no merchant store access.
    // This is the expected error when a personal Google account previously
    // registered as a buyer is used on the merchant login endpoint.
    // err.message → "This account does not have merchant access. Use a merchant or owner account."
    // Fix: use a dedicated merchant/owner account, or have a store owner add your account.
    console.error('Wrong account role:', err.message)
  } else if (err instanceof AuthError) {
    // 401 — bad credentials or expired token. Re-authenticate.
    console.error('Authentication failed:', err.message)
  } else if (err instanceof NotFoundError) {
    // 404 — resource not found (e.g. wrong email/password on email login).
    console.error('Not found:', err.message)
  }
}
```

| Subclass         | Status  | When thrown                                                             |
| ---------------- | ------- | ----------------------------------------------------------------------- |
| `AuthError`      | 401     | Invalid credentials, expired token, failed token refresh                |
| `ForbiddenError` | 403     | Valid credentials, wrong account role (e.g. buyer on merchant endpoint) |
| `NotFoundError`  | 404     | Resource not found, wrong email/password on email login                 |
| `PurchaseError`  | 409/422 | Purchase validation failure (price mismatch, duplicate, etc.)           |
| `LedewireError`  | any     | Catch-all base class for all other API errors                           |

## Documentation

- [Getting Started Guide](https://ledewire.github.io/ledewire-js-sdk/guides/node-npm.html)
- [API Reference](https://ledewire.github.io/ledewire-js-sdk/api/)
- [Full SDK README](../../README.md)

## License

MIT
