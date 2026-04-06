---
'@ledewire/x402-client': minor
---

**Initial release of `@ledewire/x402-client`**

Runtime-agnostic x402 fetch wrapper for the Ledewire `ledewire-wallet` payment scheme. Drop it in as a replacement for `fetch` and the full `402 Payment Required` handshake happens transparently — no payment code required in your agent or script.

```ts
import { createLedewireFetch } from '@ledewire/x402-client'

const fetch = createLedewireFetch({
  key: process.env.LEDEWIRE_BUYER_KEY,
  secret: process.env.LEDEWIRE_BUYER_SECRET,
})

// Payment is handled automatically
const res = await fetch('https://blog.example.com/posts/great-article')
const article = await res.json()
```

**Features:**

- Fully transparent 402→pay→retry loop using the `ledewire-wallet` x402 scheme
- Buyer JWT cached in-memory and auto-refreshed 60 seconds before expiry
- `apiBase` self-configures from the server's `PAYMENT-REQUIRED` extension block
- Typed error hierarchy: `InsufficientFundsError`, `NonceExpiredError`, `UnsupportedSchemeError`, `MalformedPaymentRequiredError`
- Web-standard APIs only — works on Node 18+, Deno, Cloudflare Workers, Vercel Edge
