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

## Example: Merchant Store Setup

```ts
const client = createClient()

await client.merchant.auth.loginWithEmail({
  email: 'owner@example.com',
  password: process.env.MERCHANT_PASSWORD,
})

const stores = await client.merchant.auth.listStores()
const storeId = stores[0].id

const content = await client.seller.content.list({ store_id: storeId })
```

## Documentation

- [Getting Started Guide](https://ledewire.github.io/ledewire-js-sdk/guides/node-npm.html)
- [API Reference](https://ledewire.github.io/ledewire-js-sdk/api/)
- [Full SDK README](../../README.md)

## License

MIT
