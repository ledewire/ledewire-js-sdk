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
const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
const article = await res.json()
```

Payments are made only to the configured Ledewire API. The client logs in with your buyer key
only at its configured `apiBase` (default `https://api.ledewire.com`), and pays only for requests
to that same origin. A `402` from any other origin is returned to you unpaid — no login, no
`PAYMENT-SIGNATURE` retry.

The full x402 handshake happens invisibly:

1. First request hits the Ledewire API → `402 Payment Required` with `PAYMENT-REQUIRED` header
2. Client authenticates with buyer API key → gets buyer JWT
3. Client constructs `PAYMENT-SIGNATURE` with JWT + `contentId` from the server's extension block
4. Retries original request → `200` + content

## What happens under the hood

```
Your code                     @ledewire/x402-client
─────────────────────────     ─────────────────────────────────────────────
fetch('https://api…/x402/…')  → GET /x402/… (no payment)
                              ← 402 + PAYMENT-REQUIRED header
                              → POST {apiBase}/v1/auth/login/buyer-api-key
                              ← buyer JWT (cached for token lifetime)
                              → GET /x402/… + PAYMENT-SIGNATURE header
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
  // The only host credentials and payments go to
  apiBase?: string,

  // Optional — provide a custom fetch (e.g. for proxies or testing)
  fetch?: typeof globalThis.fetch,
})
```

`apiBase` is the only host the client sends buyer credentials or payments to. The buyer-key
login goes to `apiBase`, and only requests on the `apiBase` origin (same scheme, host and port)
are paid. The `extensions.ledewire-wallet.apiBase` field of a `PAYMENT-REQUIRED` challenge is
ignored. To buy staging content, configure the client with the staging API base, e.g.
`apiBase: 'https://api-staging.ledewire.com'`.

A `402` from any other origin is returned to the caller unpaid: `fetch` resolves with the
original `402` `Response`, and the Axios adapter rejects with the original Axios error.
`client.allowsPaymentTo(url)` tells you in advance whether a URL would be paid.

## Transport adapters

Under the hood, `createLedewireFetch` is a one-liner built on two primitives that
you can use directly when you need a different HTTP client:

| Export                  | Source                        | Purpose                                       |
| ----------------------- | ----------------------------- | --------------------------------------------- |
| `LedewirePaymentClient` | `@ledewire/x402-client`       | Holds credentials, builds `PAYMENT-SIGNATURE` |
| `wrapFetchWithPayment`  | `@ledewire/x402-client`       | Wraps any `fetch`-compatible function         |
| `wrapAxiosWithPayment`  | `@ledewire/x402-client/axios` | Adds an Axios response interceptor            |

This mirrors the `@x402/fetch` / `@x402/axios` pattern from the x402 ecosystem — the
client is separate from the transport.

### Native fetch (default)

`createLedewireFetch` is the shorthand for this:

```ts
import { LedewirePaymentClient, wrapFetchWithPayment } from '@ledewire/x402-client'

const client = new LedewirePaymentClient({ key, secret })
const fetch = wrapFetchWithPayment(globalThis.fetch, client)

const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
```

### Axios

Install `axios` then import from the subpath:

```bash
npm install axios
```

```ts
import axios from 'axios'
import { LedewirePaymentClient } from '@ledewire/x402-client'
import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'

const client = new LedewirePaymentClient({ key, secret })
const api = wrapAxiosWithPayment(axios.create(), client)

// Payment is handled transparently — same as fetch
const res = await api.get('https://api.ledewire.com/v1/x402/contents/<content-id>')
console.log(res.data)
```

The axios adapter attaches a response interceptor that catches `402` responses,
resolves the full request URL (honouring `baseURL`), checks `client.allowsPaymentTo()`,
calls `client.buildPaymentSignature()`, sets the `PAYMENT-SIGNATURE` header,
and retries the original request.

### Custom transports (ky, got, undici, …)

For any other HTTP client, call `buildPaymentSignature` directly inside your
client's interceptor, hook, or middleware. Check `allowsPaymentTo` first —
`buildPaymentSignature` throws `PaymentOriginNotAllowedError` for a URL outside the
configured Ledewire API origin:

```ts
import { LedewirePaymentClient } from '@ledewire/x402-client'
import ky from 'ky'

const client = new LedewirePaymentClient({ key, secret })

const api = ky.create({
  hooks: {
    afterResponse: [
      async (request, _options, response) => {
        if (response.status !== 402) return response

        const header = response.headers.get('payment-required')
        if (!header || !client.allowsPaymentTo(request.url)) return response

        const sig = await client.buildPaymentSignature(header, request.url)
        return ky(request.url, {
          headers: { 'PAYMENT-SIGNATURE': sig },
        })
      },
    ],
  },
})
```

The `PaymentSigner` interface is what both built-in adapters depend on —
you can also pass any object with a `buildPaymentSignature` method. Its optional
`allowsPaymentTo(url)` lets the adapters return a `402` unpaid for URLs it refuses;
a signer without it is asked to sign every `PAYMENT-REQUIRED` challenge:

```ts
import type { PaymentSigner } from '@ledewire/x402-client'

const signer: PaymentSigner = {
  async buildPaymentSignature(header, url) {
    // custom implementation
  },
  allowsPaymentTo(url) {
    return new URL(url).origin === 'https://api.ledewire.com'
  },
}
```

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

The PAID request (the one carrying `PAYMENT-SIGNATURE`) can come back non-OK for reasons
other than a bad signature — insufficient funds, an expired buyer JWT, an account role that
can't spend, or the buyer's daily spend cap. Per the x402 v2 HTTP transport spec
(ledewire/api#1066), the API reports this as a `402` with a `PAYMENT-RESPONSE` header — a
base64 JSON `SettleResponse` with `success: false` and an `errorReason` — and both adapters
map that `errorReason` to a typed error:

```ts
import {
  createLedewireFetch,
  InsufficientFundsError,
  NonceExpiredError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  AuthError,
  ForbiddenError,
  LedewireError,
  SpendCapReachedError,
  PaymentOriginNotAllowedError,
} from '@ledewire/x402-client'

const fetch = createLedewireFetch({ key, secret })

try {
  const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
} catch (err) {
  if (err instanceof InsufficientFundsError) {
    // errorReason: insufficient_funds — wallet balance too low, top up at ledewire.com/wallet
  } else if (err instanceof NonceExpiredError) {
    // Payment nonce expired — retry the fetch from the beginning
  } else if (err instanceof UnsupportedSchemeError) {
    // The 402 was not a ledewire-wallet challenge — pass through or handle
  } else if (err instanceof MalformedPaymentRequiredError) {
    // Server sent a malformed PAYMENT-REQUIRED — likely a server misconfiguration
  } else if (err instanceof SpendCapReachedError) {
    // errorReason: daily_spend_cap_reached — nothing to retry or fund.
    // Clears only at err.resetsAt, or when the cap is raised via client.user.spendCap.update().
    //
    // These numbers are informational. Never change the buyer's actual
    // LedeWire spend cap based on this error; confirm first against the real
    // API via `user.spendCap.get()`.
    console.error(`Spend cap reached: ${err.spentCents}/${err.capCents} cents`)
  } else if (err instanceof PaymentOriginNotAllowedError) {
    // Only from a direct buildPaymentSignature() call: the URL is not on the
    // configured Ledewire API origin, so it is never paid
  } else if (err instanceof AuthError) {
    // errorReason: invalid_ledewire_wallet_payload_token — buyer JWT rejected, re-authenticate
  } else if (err instanceof ForbiddenError) {
    // errorReason: invalid_ledewire_wallet_payload_role — this account can't spend
  } else if (err instanceof LedewireError) {
    // Any other refusal — err.type carries the raw errorReason so callers can
    // still branch on a reason this SDK version doesn't have its own class for.
    console.error(err.statusCode, err.type, err.message)
  }
}
```

`AuthError`, `ForbiddenError`, `LedewireError`, and `SpendCapReachedError` are re-exported from
`@ledewire/core` — LedeWire's private shared internals, not published to npm. Always import them
from `@ledewire/x402-client` (or `@ledewire/node`), never from `@ledewire/core` directly.

| Error                           | `errorReason` (spec form)               | Cause                                                           |
| ------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| `InsufficientFundsError`        | `insufficient_funds`                    | Wallet balance too low                                          |
| `SpendCapReachedError`          | `daily_spend_cap_reached`               | Buyer's daily spend cap reached — funding does _not_ clear it   |
| `AuthError`                     | `invalid_ledewire_wallet_payload_token` | Buyer JWT in the `PAYMENT-SIGNATURE` payload was rejected       |
| `ForbiddenError`                | `invalid_ledewire_wallet_payload_role`  | Account role can't spend                                        |
| `NonceExpiredError`             | —                                       | Payment nonce expired before retry — simply retry `fetch()`     |
| `UnsupportedSchemeError`        | —                                       | 402 response uses a non-`ledewire-wallet` scheme                |
| `MalformedPaymentRequiredError` | —                                       | `PAYMENT-REQUIRED` header is invalid or missing required fields |
| `PaymentOriginNotAllowedError`  | —                                       | `buildPaymentSignature` called for a URL off the configured API |
| `LedewireError`                 | any other value, on `err.type`          | All other Ledewire API errors — check `.statusCode`/`.type`     |

**Legacy (pre-api#1066, removed once the API always sends `PAYMENT-RESPONSE`):** without that
header on the paid leg, the same errors are inferred from the bare response instead — a `402`
spend-cap body maps to `SpendCapReachedError`, `422` to `InsufficientFundsError`, `401` to
`AuthError`, and `403` to `ForbiddenError`.

A `402` on the _first_ (unpaid) request always means "here's your `PAYMENT-REQUIRED` challenge" —
the API never refuses that first request, so a bare `402` with no `PAYMENT-REQUIRED` header
passes straight through unchanged for the caller to inspect.

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
