---
'@ledewire/browser': minor
---

## New: `lw.seller.content` — browse store content from the browser

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
