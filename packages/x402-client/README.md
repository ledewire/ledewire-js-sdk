# @ledewire/x402-client

[![npm](https://img.shields.io/npm/v/@ledewire/x402-client)](https://www.npmjs.com/package/@ledewire/x402-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Runtime-agnostic x402 fetch wrapper for the [Ledewire](https://ledewire.com) payment network. Drop in as a replacement for `fetch` and it automatically handles `402 Payment Required` challenges using the `ledewire-wallet` scheme — no payment code required in your agent or script.

Works in **Node.js 18+**, **Deno**, **Cloudflare Workers**, and any environment with web-standard `fetch`.

## Install

```bash
npm install @ledewire/x402-client
```

## Quick Start

```ts
import { createLedewireFetch } from '@ledewire/x402-client'

// Create a buyer API key at ledewire.com/settings/api-keys
const fetch = createLedewireFetch({
  key: process.env.LEDEWIRE_BUYER_KEY, // e.g. bktst_abc123
  secret: process.env.LEDEWIRE_BUYER_SECRET, // 64-char hex, shown once at creation
})

// That's it — payment is handled transparently
const res = await fetch('https://blog.example.com/posts/great-article')
const article = await res.json()
```

The full x402 handshake happens invisibly:

1. First request hits the origin → `402 Payment Required` with `PAYMENT-REQUIRED` header
2. Client authenticates with buyer API key → gets buyer JWT
3. Client constructs `PAYMENT-SIGNATURE` with JWT + `contentId` from the server's extension block
4. Retries original request → `200` + content

## What happens under the hood

```
Your code                     @ledewire/x402-client
─────────────────────────     ─────────────────────────────────────────────
fetch('https://origin/post')  → GET /post (no payment)
                              ← 402 + PAYMENT-REQUIRED header
                              → POST /v1/auth/login/buyer-api-key
                              ← buyer JWT (cached for token lifetime)
                              → GET /post + PAYMENT-SIGNATURE header
                              ← 200 + content
res ←─────────────────────────────────────────────────────────────────────
```

## Configuration

```ts
import { createLedewireFetch } from '@ledewire/x402-client'
import type { LedewireFetchConfig } from '@ledewire/x402-client'

const fetch = createLedewireFetch({
  key: string,      // Buyer API key (e.g. bktst_abc123)
  secret: string,   // 64-char hex secret, shown once at creation

  // Optional — defaults to https://api.ledewire.com
  // Overridden automatically by the server's PAYMENT-REQUIRED extension block
  apiBase?: string,

  // Optional — provide a custom fetch (e.g. for proxies or testing)
  fetch?: typeof globalThis.fetch,
})
```

The `apiBase` is self-configuring: when the `PAYMENT-REQUIRED` response includes an
`extensions.ledewire-wallet.apiBase` field (standard for Ledewire-gated content), that
value takes precedence over any configured `apiBase`. This means the same client works
for staging and production content without any configuration changes.

## Getting a buyer API key

Create a key from a buyer account:

```ts
import { createClient } from '@ledewire/node'

const client = createClient()
await client.auth.loginWithEmail({ email, password })

const { key, secret } = await client.user.apiKeys.create({
  name: 'my-agent',
  spending_limit_cents: 5000, // $50 cap — optional
})
// Store secret immediately — it is never shown again
```

Or create one at ledewire.com/settings/api-keys.

## Error handling

```ts
import {
  createLedewireFetch,
  InsufficientFundsError,
  NonceExpiredError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
} from '@ledewire/x402-client'
import { AuthError, LedewireError } from '@ledewire/x402-client'

const fetch = createLedewireFetch({ key, secret })

try {
  const res = await fetch('https://blog.example.com/posts/article')
} catch (err) {
  if (err instanceof InsufficientFundsError) {
    // Wallet has insufficient funds — top up at ledewire.com/wallet
  } else if (err instanceof NonceExpiredError) {
    // Payment nonce expired — retry the fetch from the beginning
  } else if (err instanceof UnsupportedSchemeError) {
    // The 402 was not a ledewire-wallet challenge — pass through or handle
  } else if (err instanceof MalformedPaymentRequiredError) {
    // Server sent a malformed PAYMENT-REQUIRED — likely a server misconfiguration
  } else if (err instanceof LedewireError) {
    console.error(err.statusCode, err.message)
  }
}
```

| Error                           | Cause                                                           |
| ------------------------------- | --------------------------------------------------------------- |
| `InsufficientFundsError`        | Wallet balance too low (server returned 422)                    |
| `NonceExpiredError`             | Payment nonce expired before retry — simply retry `fetch()`     |
| `UnsupportedSchemeError`        | 402 response uses a non-`ledewire-wallet` scheme                |
| `MalformedPaymentRequiredError` | `PAYMENT-REQUIRED` header is invalid or missing required fields |
| `AuthError`                     | Buyer API key credentials are invalid (401 on payment)          |
| `LedewireError`                 | All other Ledewire API errors — check `.statusCode`             |

## Token lifecycle

`LedewireAuthManager` caches the buyer JWT and re-authenticates automatically when the
token is within 60 seconds of expiry. For agents with lifetimes shorter than a single
token TTL (typically 30 minutes), authentication happens exactly once.

For long-running processes, the `LedewireAuthManager` instance inside the returned `fetch`
handles re-authentication transparently on every payment attempt.

## Runtime compatibility

This package uses only web-standard APIs: `fetch`, `atob`, `btoa`, `Response`, `Headers`,
and `URL`. It has no Node.js-specific imports. It runs unchanged on:

- Node.js 18+
- Deno
- Cloudflare Workers
- Vercel Edge Runtime
- Any other runtime with standard `fetch`

## Related packages

- [`@ledewire/node`](../node) — full Ledewire API client for Node.js (buyer auth, wallet, purchases, merchant)
- [`@ledewire/browser`](../browser) — Ledewire SDK for browser applications
