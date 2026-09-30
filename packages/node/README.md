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

| Namespace                      | Description                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `client.config`                | Platform-level public config (no auth required)                                               |
| `client.auth`                  | Buyer signup, email/password login, Google OAuth, password reset                              |
| `client.wallet`                | Buyer wallet balance (incl. `held_cents`/`holds` from bulk acquisitions) and payment sessions |
| `client.purchases`             | Buyer purchase history, create purchases, verify ownership                                    |
| `client.content`               | Fetch content with buyer access info                                                          |
| `client.checkout`              | Checkout state — what action is required next                                                 |
| `client.user.apiKeys`          | Manage buyer API keys for autonomous agents                                                   |
| `client.user.spendCap`         | Buyer's daily spend cap — read and update the ceiling                                         |
| `client.user.mcpKeys`          | Manage buyer MCP API keys for the Ledewire MCP server                                         |
| `client.publications`          | Bulk-licensing catalog: publications and their works (public)                                 |
| `client.acquisitions`          | Bulk licensing: quote, authorize, corpus download, signed manifest                            |
| `client.x402`                  | Public x402 Bazaar resource discovery (no auth required)                                      |
| `client.merchant.auth`         | Merchant login (email / Google), store discovery, password reset                              |
| `client.merchant.users`        | Merchant user management (invite, list, update, remove)                                       |
| `client.merchant.content`      | Merchant content CRUD + search (merchant JWT auth)                                            |
| `client.merchant.buyers`       | Buyer statistics within a store                                                               |
| `client.merchant.sales`        | Sales reporting and revenue statistics                                                        |
| `client.merchant.config`       | Store configuration                                                                           |
| `client.merchant.domains`      | x402 domain verification for URL-based content gating                                         |
| `client.merchant.pricingRules` | x402 URL pattern-based pricing rules                                                          |
| `client.seller.content`        | Seller content CRUD + search (API key auth)                                                   |
| `client.seller.sales`          | Seller sales statistics and revenue reporting                                                 |
| `client.seller.buyers`         | Anonymized buyer statistics (API key auth)                                                    |
| `client.seller.config`         | Store configuration (API key auth)                                                            |

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

  // Side-effects only — storage.setTokens is already the persistence hook.
  // Use onTokenRefreshed for audit logging or cache invalidation on refresh.
  onTokenRefreshed: async (tokens) => {
    await auditLog.record('token_refreshed', { expiresAt: tokens.expiresAt })
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
No API key is required. Token refresh is automatic — the SDK handles it transparently.

### Email / password login

The one-step helper logs in and returns both the normalized tokens and the accessible stores
list in a single HTTP call:

```ts
import { createClient, ForbiddenError } from '@ledewire/node'

const client = createClient({
  // Required for serverless/edge — MemoryTokenStorage (default) resets on cold start.
  storage: {
    getTokens: async () => JSON.parse((await redis.get('lw:tokens')) ?? 'null'),
    setTokens: async (t) => redis.set('lw:tokens', JSON.stringify(t)),
    clearTokens: async () => redis.del('lw:tokens'),
  },
  onAuthExpired: () => redirect('/login'),
})

try {
  const { tokens, stores } = await client.merchant.auth.loginWithEmailAndListStores({
    email: 'owner@example.com',
    password: process.env.MERCHANT_PASSWORD,
  })
  // tokens: StoredTokens — { accessToken, refreshToken, expiresAt: number (Unix ms) }
  // stores: MerchantLoginStore[] — use .id, .name, .role
  const storeId = stores[0].id
} catch (err) {
  if (err instanceof ForbiddenError) {
    // Valid credentials but account has no merchant store access (e.g. buyer account).
    // err.message: "This account does not have merchant access. Use a merchant or owner account."
  }
}
```

### Google OAuth login

Same flow with a Google ID token instead of email/password:

```ts
const { tokens, stores } = await client.merchant.auth.loginWithGoogleAndListStores({
  id_token: googleIdToken, // from Google Identity Services callback
})
const storeId = stores[0].id
```

### Password reset

Two-step flow — request a code, then submit it with the new password:

```ts
// Step 1 — send a 6-digit reset code to the merchant's email.
// Always returns 200 to prevent email enumeration.
await client.merchant.auth.requestPasswordReset({ email: 'owner@example.com' })

// Step 2 — submit the code and new password.
await client.merchant.auth.resetPassword({
  email: 'owner@example.com',
  reset_code: '246810',
  password: 'new-secure-password',
})
```

### Separate login + store list (when you need full store detail)

Use this only when you need fields available on `ManageableStore` but not on `MerchantLoginStore`
(`store_key`, `logo`):

```ts
await client.merchant.auth.loginWithEmail({ email, password })
const stores = await client.merchant.auth.listStores() // ManageableStore[]
const storeId = stores[0].id // .id and .name match MerchantLoginStore
```

## Example: Merchant Store Setup

```ts
const client = createClient()

await client.merchant.auth.loginWithEmail({
  email: 'owner@example.com',
  password: process.env.MERCHANT_PASSWORD,
})

const stores = await client.merchant.auth.listStores()
const storeId = stores[0].id

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

// Inline HTML — content_body and content_uri are mutually exclusive for 'html'
await client.seller.content.create(storeId, {
  content_type: 'html',
  title: 'Interactive Report',
  content_body: '<h1>Q3 Results</h1><p>...</p>',
  price_cents: 900,
  visibility: 'public',
})

// Remote HTML, PDF, image, and video all require content_uri (never content_body)
await client.seller.content.create(storeId, {
  content_type: 'pdf',
  title: 'Annual Report (PDF)',
  content_uri: 'https://cdn.example.com/reports/annual-2026.pdf',
  price_cents: 2000,
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

## Example: Buyer Spend Cap & MCP API Keys

Every buyer starts with a default daily spend cap governing every wallet debit
(MCP, REST, and the web payment gate). Read it, raise it, or remove it (`null`):

```ts
const cap = await client.user.spendCap.get()
if (cap.remaining_cents !== null && cap.remaining_cents < 500) {
  console.warn(`Only ${cap.remaining_cents}c left before the cap resets at ${cap.resets_at}`)
}

await client.user.spendCap.update({ daily_spend_limit_cents: 2000 }) // raise to $20/day
await client.user.spendCap.update({ daily_spend_limit_cents: null }) // remove the cap
```

MCP API keys authenticate agent requests to the Ledewire MCP server. The
`secret` is shown once at creation — store it immediately:

```ts
const { key, secret } = await client.user.mcpKeys.create({
  label: 'my-rag-agent',
  can_search: true,
  can_purchase: true,
})
await secretsManager.put('LEDEWIRE_MCP_CREDENTIAL', `${key}:${secret}`)

const keys = await client.user.mcpKeys.list() // secrets never included
await client.user.mcpKeys.revoke(keys[0].id) // to change scopes: revoke + recreate
```

## Example: Bulk Licensing (Acquisitions)

Buy a publication's entire catalog (or a date-bounded slice of it) in one
transaction instead of purchasing works one at a time:

```ts
// 1. Browse the catalog and pull a page of work URLs.
const { data: publications } = await client.publications.list()
const publication = publications.find((p) => p.bulk_licensable)
const { data: urls } = await client.publications.listWorks(publication.id, {
  from: '2026-01-01',
  to: '2026-01-31',
})

// 2. Submit the Selection. Quoting is asynchronous.
let acquisition = await client.acquisitions.create({ urls: urls.map((w) => w.url) })
while (acquisition.quote_state === 'pending') {
  await new Promise((r) => setTimeout(r, 2000))
  acquisition = await client.acquisitions.get(acquisition.id)
}

// 3. Acknowledge whatever cannot be sold — required before authorizing.
acquisition = await client.acquisitions.acknowledgeExclusions(acquisition.id)

// 4. Place the hold and start the run.
try {
  acquisition = await client.acquisitions.authorize(acquisition.id)
} catch (err) {
  if (err instanceof SpendCapReachedError) {
    // Funding the wallet will not clear this — it's a daily policy limit.
    console.error(`Spend cap reached; resets at ${err.resetsAt}.`)
    return
  }
  throw err
}

// 5. Poll until the run settles, then check for partial failure.
while (acquisition.status === 'authorized' || acquisition.status === 'acquiring') {
  await new Promise((r) => setTimeout(r, 5000))
  acquisition = await client.acquisitions.get(acquisition.id)
}
const { data: works } = await client.acquisitions.listWorks(acquisition.id)
const failed = works.filter((w) => w.delivery_state === 'undelivered')

// 6. Stream the corpus archive to a file.
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const result = await client.acquisitions.downloadCorpus(acquisition.id)
if (result.ready) {
  await pipeline(Readable.fromWeb(result.body), createWriteStream('corpus.tar.gz'))
}

// 7. Verify the signed manifest against the append-only signing-key log —
// never trust the `jwk` embedded in the manifest's own JWS header.
const manifest = await client.acquisitions.getManifest(acquisition.id)
const keyHistory = await client.acquisitions.signingKeyHistory()
```

## Example: x402 Bazaar Discovery

Public, unauthenticated browsing of resources gated by the x402
`ledewire-wallet` scheme:

```ts
const { total, resources } = await client.x402.discoverResources({ limit: 20 })
for (const resource of resources) {
  console.log(resource.metadata.title, resource.metadata.teaser)
}
```

Pay for a discovered resource via the x402 flow itself — see
[`@ledewire/x402-client`](../x402-client/) — not through this namespace, which
never carries delivered content.

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

| Subclass               | Status  | When thrown                                                                                                   |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `AuthError`            | 401     | Invalid credentials, expired token, failed token refresh                                                      |
| `ForbiddenError`       | 403     | Valid credentials, wrong account role (e.g. buyer on merchant endpoint)                                       |
| `NotFoundError`        | 404     | Resource not found, wrong email/password on email login                                                       |
| `PurchaseError`        | 409/422 | Purchase validation failure (price mismatch, duplicate, etc.)                                                 |
| `SpendCapReachedError` | 402     | Buyer's daily spend cap reached — `purchases.create()`, the x402 content gate, and `acquisitions.authorize()` |
| `LedewireError`        | any     | Catch-all base class for all other API errors                                                                 |

Every `LedewireError` also carries `type` (the API error body's machine-readable
`error.type`, e.g. `'daily_spend_cap_reached'`, `'insufficient_funds'`) and
`details` (any extra top-level fields on the error body). `instanceof` checks
work even across the separately bundled copies of `@ledewire/core` inside
`@ledewire/node`, `@ledewire/browser`, and `@ledewire/x402-client` — an error
thrown by the x402-client is still recognized by `SpendCapReachedError`
imported from `@ledewire/node`.

**`SpendCapReachedError` — funding the wallet does not clear it:**

```ts
import { SpendCapReachedError } from '@ledewire/node'

try {
  await client.purchases.create({ content_id })
} catch (err) {
  if (err instanceof SpendCapReachedError) {
    // A daily policy limit, not a balance problem — do NOT prompt the buyer
    // to fund their wallet. It clears when the window rolls over at
    // err.resetsAt, or when the cap is raised via client.user.spendCap.update().
    console.error(
      `Spend cap reached: spent ${err.spentCents} of ${err.capCents} cents. Resets at ${err.resetsAt}.`,
    )
  }
}
```

## Documentation

- [Getting Started Guide](https://ledewire.github.io/ledewire-js-sdk/guides/node-npm.html)
- [API Reference](https://ledewire.github.io/ledewire-js-sdk/api/)
- [Full SDK README](../../README.md)

## License

MIT
