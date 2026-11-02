---
'@ledewire/x402-client': minor
---

Pay the `PAYMENT-REQUIRED` challenge the Ledewire API actually sends. The client no longer requires an `extensions['ledewire-wallet']` block (the API sends `extensions: {}`), takes the nonce and expiry from `accepts[0].extra`, takes the content id from `resource.url` (`/v1/x402/contents/{id}`), and sends `payload: { token, contentId, nonce }` so the payment settles instead of drawing a fresh `402`. Pass `apiBase: 'https://api-staging.ledewire.com'` for staging content.

The client no longer follows an `apiBase` named in a payment challenge (`extensions['ledewire-wallet'].apiBase`): the buyer key and secret are sent only to the configured API base (`apiBase`, default `https://api.ledewire.com`), since the server answering `402` is untrusted.

**Breaking:** `LedewireWalletExtra` no longer has `contentId` (the API never sent it; read the id from `resource.url`), and `LedewireWalletPayload` gains a required `nonce`. Code that builds a `LedewireWalletPayload` by hand must add the challenge's `accepts[0].extra.nonce`.
