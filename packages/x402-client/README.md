# @ledewire/x402-client

[![npm](https://img.shields.io/npm/v/@ledewire/x402-client)](https://www.npmjs.com/package/@ledewire/x402-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Runtime-agnostic x402 fetch wrapper for the [Ledewire](https://ledewire.com) payment network. Drop in as a replacement for `fetch` and it automatically handles `402 Payment Required` challenges using the `ledewire-wallet` scheme — no payment code required in your agent or script.

Every payment is a **Payment authorization** the client signs itself with an Ed25519
**Payment key**: one payee, one amount, one resource, a short validity window and a nonce it
generates. The private key never leaves the client, and no session token or API key is sent
to pay. Money moves only between Ledewire wallets, in US dollars; nothing touches a blockchain.

Works in **Node.js 20+**, **Deno**, **Cloudflare Workers**, current browsers, and any
environment with web-standard `fetch` and WebCrypto Ed25519.

## Install

```bash
npm install @ledewire/x402-client
```

## Quick Start

### 1. Register a Payment key, once

```ts
import { registerPaymentKey } from '@ledewire/x402-client'

// Authenticates with a buyer API key (or pass `accessToken`), generates an Ed25519
// key pair, and registers its public half with a proof of possession.
const { paymentKey } = await registerPaymentKey({
  key: process.env.LEDEWIRE_BUYER_KEY, // e.g. bktst_abc123
  secret: process.env.LEDEWIRE_BUYER_SECRET,
  name: 'research-agent',
})

// Store both somewhere secret. privateKey is the only copy; Ledewire never sees it.
// paymentKey.id         → LEDEWIRE_PAYMENT_KEY_ID
// paymentKey.privateKey → LEDEWIRE_PAYMENT_KEY
```

A Buyer holds at most 10 active Payment keys. Give each client its own, so revoking one
doesn't stop the others.

### 2. Pay with it

```ts
import { createLedewireFetch } from '@ledewire/x402-client'

const fetch = createLedewireFetch({
  paymentKey: {
    id: process.env.LEDEWIRE_PAYMENT_KEY_ID,
    privateKey: process.env.LEDEWIRE_PAYMENT_KEY, // 43-char base64url Ed25519 seed
  },
  maxPriceCents: 500, // never pay more than $5.00 for one request
})

// That's it — payment is handled transparently
const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
const article = await res.json()
```

Payments are made only to the configured Ledewire API. The client pays only for requests to
its configured `apiBase` (default `https://api.ledewire.com`). A `402` from any other origin
is returned to you unpaid, with no `PAYMENT-SIGNATURE` retry.

The full x402 handshake happens invisibly:

1. First request hits the Ledewire API → `402 Payment Required` with a `PAYMENT-REQUIRED` header
2. The client checks the price against `maxPriceCents` and fills in a Payment authorization:
   `to` = `payTo`, `value` = `amount`, `asset`, `resource` = `resource.url`, a window of
   `maxTimeoutSeconds` from now, and 32 fresh random bytes as the nonce
3. It signs `ledewire-payment-authorization:` + the canonical JSON of the authorization
4. Retries the original request once with `PAYMENT-SIGNATURE` → `200` + content

## What happens under the hood

```
Your code                     @ledewire/x402-client
─────────────────────────     ─────────────────────────────────────────────
fetch('https://api…/x402/…')  → GET /x402/… (no payment)
                              ← 402 + PAYMENT-REQUIRED (payTo, amount, resource.url)
                                sign a Payment authorization locally (Ed25519)
                              → GET /x402/… + PAYMENT-SIGNATURE (redirects refused)
                              ← 200 + PAYMENT-RESPONSE + content
res ←─────────────────────────────────────────────────────────────────────
```

The decoded `PAYMENT-SIGNATURE`:

```json
{
  "x402Version": 2,
  "accepted": {
    "scheme": "ledewire-wallet",
    "network": "ledewire:v1",
    "amount": "250",
    "...": "…"
  },
  "payload": {
    "signature": "<base64url Ed25519 signature>",
    "authorization": {
      "from": "<Payment key id>",
      "to": "store:<store id>",
      "value": "250",
      "asset": "USD",
      "resource": "https://api.ledewire.com/v1/x402/contents/<content-id>",
      "validAfter": 1793000000,
      "validBefore": 1793000300,
      "nonce": "<64 lowercase hex characters>"
    }
  }
}
```

The scheme is specified on Ledewire's published `ledewire-wallet` scheme page, which includes
a fixed test vector; this package's tests check it byte for byte.

## Configuration

```ts
import { createLedewireFetch } from '@ledewire/x402-client'
import type { LedewireFetchConfig } from '@ledewire/x402-client'

const fetch = createLedewireFetch({
  paymentKey: {
    id: string,         // PaymentKey.id from registration
    privateKey: string, // 32-byte Ed25519 seed, unpadded base64url (43 chars)
  },

  // Optional — the most one request may cost, in cents. A higher price is
  // refused with PriceAboveMaximumError before anything is signed.
  maxPriceCents?: number,

  // Optional — defaults to https://api.ledewire.com. The only origin paid.
  apiBase?: string,

  // Optional — provide a custom fetch (e.g. for proxies or testing)
  fetch?: typeof globalThis.fetch,
})
```

A malformed `privateKey` or `id` throws a `TypeError` when the client is created; the
message never contains the key. The private key is imported once as a non-extractable
WebCrypto key and the string is dropped.

`apiBase` is the only origin the client pays. Only requests on the `apiBase` origin (same
scheme, host and port) are paid, and nothing in a `PAYMENT-REQUIRED` challenge changes it. To
buy staging content, configure the client with the staging API base, e.g.
`apiBase: 'https://api-staging.ledewire.com'`, and a Payment key registered on staging.

A `402` from any other origin is returned to the caller unpaid: `fetch` resolves with the
original `402` `Response`, and the Axios adapter rejects with the original Axios error.
`client.allowsPaymentTo(url)` tells you in advance whether a URL would be paid.

Before it signs, the client checks what the challenge asks: the authorization pays whoever
`payTo` names. Set `maxPriceCents` so a price you didn't expect is refused rather than paid.

## Payment keys

| Export                                         | Purpose                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `registerPaymentKey(options)`                  | Generate (or take) a key and register it for the signed-in Buyer                |
| `createPaymentKeyRegistration(name, privKey?)` | Build `{ name, public_key, proof }` without sending it                          |
| `generatePaymentKey()`                         | A new `{ privateKey, publicKey }` pair, both unpadded base64url                 |
| `canonicalAuthorization(authorization)`        | The canonical JSON a signature covers (after `ledewire-payment-authorization:`) |

`registerPaymentKey` sends `{ name, public_key, proof }` to `POST {apiBase}/v1/user/payment-keys`,
where `proof` is a signature by the key over `ledewire-payment-key:` followed by `public_key`.
It authenticates with a buyer API key (`key` and `secret`) or a buyer `accessToken`, and
returns `{ paymentKey, record }`: `paymentKey` is `{ id, privateKey }`, ready for
`createLedewireFetch`, and `record` is the API's `PaymentKey` (public half only).

A Company **Machine user** can't register its own keys. A Company admin builds the body with
`createPaymentKeyRegistration()`, registers it for the Machine user, and gives the software
running as it the key id and private key.

## Transport adapters

Under the hood, `createLedewireFetch` is a one-liner built on two primitives that
you can use directly when you need a different HTTP client:

| Export                  | Source                        | Purpose                                          |
| ----------------------- | ----------------------------- | ------------------------------------------------ |
| `LedewirePaymentClient` | `@ledewire/x402-client`       | Holds the Payment key, signs `PAYMENT-SIGNATURE` |
| `wrapFetchWithPayment`  | `@ledewire/x402-client`       | Wraps any `fetch`-compatible function            |
| `wrapAxiosWithPayment`  | `@ledewire/x402-client/axios` | Adds an Axios response interceptor               |

This mirrors the `@x402/fetch` / `@x402/axios` pattern from the x402 ecosystem — the
client is separate from the transport.

### Native fetch (default)

`createLedewireFetch` is the shorthand for this:

```ts
import { LedewirePaymentClient, wrapFetchWithPayment } from '@ledewire/x402-client'

const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })
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

const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })
const api = wrapAxiosWithPayment(axios.create(), client)

// Payment is handled transparently — same as fetch
const res = await api.get('https://api.ledewire.com/v1/x402/contents/<content-id>')
console.log(res.data)
```

The axios adapter attaches a response interceptor that catches `402` responses,
resolves the full request URL (honouring `baseURL`), checks `client.allowsPaymentTo()`,
calls `client.buildPaymentSignature()`, sets the `PAYMENT-SIGNATURE` header,
and retries the original request once, with `maxRedirects: 0`.

### Custom transports (ky, got, undici, …)

For any other HTTP client, call `buildPaymentSignature` directly inside your
client's interceptor, hook, or middleware. Check `allowsPaymentTo` first —
`buildPaymentSignature` throws `PaymentOriginNotAllowedError` for a URL outside the
configured Ledewire API origin. Every call signs a new authorization, so send each one
once and don't let it follow a redirect:

```ts
import { LedewirePaymentClient } from '@ledewire/x402-client'
import ky from 'ky'

const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })

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
          redirect: 'error',
          retry: 0,
        })
      },
    ],
  },
})
```

The `PaymentSigner` interface is what both built-in adapters depend on —
you can also pass any object with a `buildPaymentSignature` method. Its optional
`allowsPaymentTo(url)` lets the adapters return a `402` unpaid for URLs it refuses;
a signer without it is asked to sign every `PAYMENT-REQUIRED` challenge. Its optional
`shouldResign(code)` decides whether a refused payment is signed once more; a signer
without it never re-signs:

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

`registerPaymentKey` needs a buyer token once, to register the key. Create a buyer API key from
a buyer account:

```ts
import { createClient } from '@ledewire/node'

const client = createClient()
await client.auth.loginWithEmail({ email, password })

// The buyer's daily Spend cap (client.user.spendCap) limits what is spent
const { key, secret } = await client.user.apiKeys.create({ name: 'my-agent' })
// Store secret immediately — it is never shown again
```

Or create one at ledewire.com/settings/api-keys. Paying itself never sends it.

## Error handling

When the API refuses a well-formed signed payment, the paid request comes back `402` with a
fresh `PAYMENT-REQUIRED` challenge whose `error` is a refusal code (the body's `error.type`
repeats it). Nothing is charged. The adapters handle each code as follows:

| Refusal code                        | What the client does                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_authorization_expired`     | Signs once more with a fresh window and nonce (check your clock if it repeats)                                                        |
| `amount_mismatch`                   | With `maxPriceCents` set, signs once more at the new price if within it; above it throws `PriceAboveMaximumError`. Without it, throws |
| `invalid_ledewire_wallet_signature` | Throws `PaymentRefusedError`                                                                                                          |
| `unknown_payment_key`               | Throws `PaymentRefusedError` — the key isn't registered, or was revoked                                                               |
| `recipient_mismatch`                | Throws `PaymentRefusedError`                                                                                                          |
| `resource_mismatch`                 | Throws `PaymentRefusedError`                                                                                                          |
| `nonce_already_used`                | Throws `PaymentRefusedError` — never re-sent; check whether the work was bought                                                       |

A request is signed at most twice, and at most one of those payments can settle: a refused
payment charges nothing.

```ts
import {
  createLedewireFetch,
  PaymentRefusedError,
  PriceAboveMaximumError,
  InsufficientFundsError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  LedewireError,
  SpendCapReachedError,
  PaymentOriginNotAllowedError,
} from '@ledewire/x402-client'

const fetch = createLedewireFetch({ paymentKey, maxPriceCents: 500 })

try {
  const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
} catch (err) {
  if (err instanceof PaymentRefusedError) {
    // err.refusal (and err.type) is the code, e.g. 'unknown_payment_key'
  } else if (err instanceof PriceAboveMaximumError) {
    // err.amountCents is above err.maxPriceCents — nothing was signed
  } else if (err instanceof InsufficientFundsError) {
    // 422 — wallet balance too low, top up at ledewire.com/wallet
  } else if (err instanceof SpendCapReachedError) {
    // 402 spend-cap body — nothing to retry or fund.
    // Clears only at err.resetsAt, or when the cap is raised via client.user.spendCap.update().
    //
    // These numbers are informational. Never change the buyer's actual
    // LedeWire spend cap based on this error; confirm first against the real
    // API via `user.spendCap.get()`.
    console.error(`Spend cap reached: ${err.spentCents}/${err.capCents} cents`)
  } else if (err instanceof UnsupportedSchemeError) {
    // The 402 was not a ledewire-wallet challenge — pass through or handle
  } else if (err instanceof MalformedPaymentRequiredError) {
    // The PAYMENT-REQUIRED challenge is malformed, or holds a value the client won't sign
  } else if (err instanceof PaymentOriginNotAllowedError) {
    // Only from a direct buildPaymentSignature() call: the URL is not on the
    // configured Ledewire API origin, so it is never paid
  } else if (err instanceof LedewireError) {
    // Any other refusal — check err.statusCode / err.type
    console.error(err.statusCode, err.type, err.message)
  }
}
```

`AuthError`, `ForbiddenError`, `LedewireError`, `RateLimitError`, and `SpendCapReachedError` are re-exported from
`@ledewire/core` — LedeWire's private shared internals, not published to npm. Always import them
from `@ledewire/x402-client` (or `@ledewire/node`), never from `@ledewire/core` directly.

| Error                           | Cause                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `PaymentRefusedError`           | The API refused the signed payment; `.refusal` is the code                   |
| `PriceAboveMaximumError`        | The price is above `maxPriceCents`; nothing was signed                       |
| `InsufficientFundsError`        | Wallet balance too low (`422`)                                               |
| `SpendCapReachedError`          | Buyer's daily spend cap reached — funding does _not_ clear it                |
| `UnsupportedSchemeError`        | 402 response uses a non-`ledewire-wallet` scheme                             |
| `MalformedPaymentRequiredError` | `PAYMENT-REQUIRED` is invalid, missing a field, or holds one it won't sign   |
| `RateLimitError`                | `429` on the paid request or on registration — see `.retryAfter`             |
| `PaymentOriginNotAllowedError`  | `buildPaymentSignature` called for a URL off the configured API              |
| `LedewireError`                 | All other Ledewire API errors, e.g. `400 Malformed PAYMENT-SIGNATURE header` |

A paid request refused with a `PAYMENT-RESPONSE` header (an x402 `SettleResponse` with
`success: false`) is still mapped by its `errorReason`, as in earlier versions.

A `402` on the _first_ (unpaid) request always means "here's your `PAYMENT-REQUIRED` challenge" —
the API never refuses that first request, so a bare `402` with no `PAYMENT-REQUIRED` header
passes straight through unchanged for the caller to inspect.

## Upgrading from 0.4

0.5 no longer pays with a buyer API key, because the API no longer accepts session-token
payments. Register a Payment key once with `registerPaymentKey({ key, secret, name })`, store
the returned `paymentKey`, and configure the client with
`{ paymentKey, maxPriceCents }` instead of `{ key, secret }`. `NonceExpiredError`,
`LedewireWalletExtra` and `LedewireWalletExtension` are gone: the challenge no longer carries
a server nonce or a discovery block.

## Runtime compatibility

This package uses only web-standard APIs: `fetch`, `atob`, `btoa`, `TextEncoder`,
`Response`, `Headers`, `URL`, and WebCrypto (`crypto.subtle` Ed25519, `crypto.getRandomValues`).
It has no Node.js-specific imports and no dependencies. It runs unchanged on:

- Node.js 20+
- Deno
- Cloudflare Workers
- Vercel Edge Runtime
- Current browsers (Chrome 137+, Firefox 129+, Safari 17+)

## Related packages

- [`@ledewire/node`](../node) — full Ledewire API client for Node.js (buyer auth, wallet, purchases, merchant)
- [`@ledewire/browser`](../browser) — Ledewire SDK for browser applications
