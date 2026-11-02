---
'@ledewire/x402-client': minor
---

Pay the `PAYMENT-REQUIRED` challenge the Ledewire API actually sends. The client no longer requires an `extensions['ledewire-wallet']` block (the API sends `extensions: {}`), takes the nonce and expiry from `accepts[0].extra`, takes the content id from `resource.url` (`/v1/x402/contents/{id}`), and sends `payload: { token, contentId, nonce }` so the payment settles instead of drawing a fresh `402`. A `ledewire-wallet` block's `apiBase` is still honoured when a server sends one; otherwise the configured `apiBase` is used, so pass `apiBase: 'https://api-staging.ledewire.com'` for staging content.

**Breaking:** `LedewireWalletExtra` no longer has `contentId` (the API never sent it; read the id from `resource.url`), and `LedewireWalletPayload` gains a required `nonce`. Code that builds a `LedewireWalletPayload` by hand must add the challenge's `accepts[0].extra.nonce`.
