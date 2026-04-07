# @ledewire/x402-client

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
