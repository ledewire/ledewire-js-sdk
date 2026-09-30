# @ledewire/x402-client

## 0.3.2

### Patch Changes

- 647e6d8: Publish via npm trusted publishing (OIDC) instead of a long-lived npm token. Releases now carry npm provenance attestations, and each package's metadata links back to its source directory in the GitHub repository.

## 0.3.1

### Patch Changes

- 508cdab: Raise the axios peer dependency from `>=1.16.0` to `>=1.20.0`, excluding versions affected by the advisories published 2026-09-30: HTTP/2 adapter bypassing DNS lookup and proxy controls (GHSA-3pq3-5fj3-cg6v), a denial of service from an unhandled HTTP/2 session `error` event (GHSA-542g-h47m-68v8), ReDoS in the `data:` URL parser (GHSA-c29m-xwm3-cm6r) and in proxy host normalization (GHSA-mghh-pgcx-3jjj), and prototype-pollution gadgets (GHSA-x97p-jq2g-jp4f, plus two moderate advisories).

## 0.3.0

### Minor Changes

- 8976828: Sync with the 2026-09 LedeWire API spec.

  **Breaking — single-use purchases.** `CheckoutNextAction` / `NextRequiredAction` no longer include
  `view_content` (checkout state) or `none` (content with access): the API withdrew both. A completed
  purchase no longer implies access; `has_purchased` means "has ever bought". The purchased content is
  delivered only on the `purchases.create()` response (`content_body` as plain UTF-8, or `content_uri`)
  and is never served again, so persist it immediately.

  **New**
  - `SpendCapReachedError` (402, `error.type === 'daily_spend_cap_reached'`) with `capCents`,
    `spentCents`, `remainingCents`, `resetsAt`, and `bulkExempt`. Funding the wallet does not clear it.
    `LedewireError` gains an optional machine-readable `type`. x402-client's fetch and Axios adapters
    throw it — and map `insufficient_funds`/`invalid_ledewire_wallet_payload_token`/
    `invalid_ledewire_wallet_payload_role` to `InsufficientFundsError`/`AuthError`/`ForbiddenError` —
    from the PAID request's `402` refusal, per the x402 v2 HTTP transport spec
    (`PAYMENT-RESPONSE` header, ledewire/api#1066); a pre-api#1066 fallback still reads the same
    errors off a bare `402`/`422`/`401`/`403` when that header is absent.
  - `user.spendCap.get()` / `.update()` (node and browser).
  - `user.mcpKeys.list()` / `.create()` / `.revoke()` (node and browser).
  - Node: `publications.list()` / `.listWorks()`, and `acquisitions.*` for bulk licensing: create,
    poll, requote, acknowledge exclusions, authorize, per-work results, corpus state/build/streamed
    download, signed manifest, and signing-key history. These are also available on `createAgentClient()`.
  - Node: `x402.discoverResources()` for the public x402 Bazaar discovery endpoint.
  - Content types `html` (inline or remote), `pdf`, `image`, and `video`; `brokered` on responses.
  - Wallet balance `spendable_cents`, `held_cents`, and `holds`; `bulk_acquisition` / `bulk_hold`
    transaction reasons.

## 0.2.1

### Patch Changes

- 199de9c: Tighten axios peer dependency from `>=1.0.0` to `>=1.16.0` to exclude versions affected by multiple high/critical security advisories including prototype pollution gadgets, NO_PROXY bypass (SSRF), header injection, ReDoS via cookie name, and credential leak via proxy redirect.

## 0.2.0

### Minor Changes

- 7e8b30c: **Initial release of `@ledewire/x402-client`**

  Runtime-agnostic x402 payment client for the Ledewire `ledewire-wallet` payment scheme.
  Drop it in as a replacement for `fetch`, wire it into Axios, or call `buildPaymentSignature`
  directly inside any other HTTP client's interceptor.

  ```ts
  // fetch — one-liner drop-in
  import { createLedewireFetch } from '@ledewire/x402-client'

  const fetch = createLedewireFetch({ key, secret })
  const res = await fetch('https://blog.example.com/posts/great-article')
  ```

  ```ts
  // Axios — response interceptor
  import axios from 'axios'
  import { LedewirePaymentClient } from '@ledewire/x402-client'
  import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'

  const client = new LedewirePaymentClient({ key, secret })
  const api = wrapAxiosWithPayment(axios.create(), client)
  ```

  ```ts
  // Any other HTTP client — use buildPaymentSignature directly
  const sig = await client.buildPaymentSignature(
    response.headers.get('payment-required'),
    request.url,
  )
  ```

  **Features:**
  - Fully transparent 402→pay→retry loop using the `ledewire-wallet` x402 scheme
  - `LedewirePaymentClient` core class + `PaymentSigner` interface separates credentials from transport
  - `wrapFetchWithPayment` — fetch adapter (main export)
  - `wrapAxiosWithPayment` — Axios adapter (`@ledewire/x402-client/axios` subpath, optional peer dep)
  - `payment-identifier` idempotency extension: stable UUID per request when server advertises support, preventing double-charging on network retries
  - Buyer JWT cached in-memory and auto-refreshed 60 seconds before expiry
  - `apiBase` self-configures from the server's `PAYMENT-REQUIRED` extension block
  - Typed error hierarchy: `InsufficientFundsError`, `NonceExpiredError`, `UnsupportedSchemeError`, `MalformedPaymentRequiredError`
  - Web-standard APIs only — works on Node 18+, Deno, Cloudflare Workers, Vercel Edge
