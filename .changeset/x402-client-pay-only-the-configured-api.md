---
'@ledewire/x402-client': patch
---

The client now only pays and authenticates against the configured Ledewire API.

- The buyer-key login always goes to the client's configured `apiBase` (default `https://api.ledewire.com`). The `extensions.ledewire-wallet.apiBase` field of a `PAYMENT-REQUIRED` challenge no longer changes where the client logs in.
- A payment is built only when the request that received the `402` is on the configured `apiBase` origin. A `402` from any other origin is returned to the caller unpaid, with no login and no `PAYMENT-SIGNATURE` retry: `wrapFetchWithPayment` / `createLedewireFetch` return the original `Response`, and `wrapAxiosWithPayment` rejects with the original Axios error. The Axios adapter resolves `baseURL` plus a relative `url` before checking.
- `wrapAxiosWithPayment` pays a request at most once. If the paid retry is answered with another `402` challenge, it rejects instead of paying again.
- New `LedewirePaymentClient.allowsPaymentTo(url)` reports whether a URL is on the configured API origin.
- `PaymentSigner` gains an optional `allowsPaymentTo(url)`. Custom signers that don't implement it keep their current behaviour.
- New `PaymentOriginNotAllowedError` (a `LedewireError`, status `402`) is thrown when `buildPaymentSignature` is called directly with a URL outside the configured API origin.
- `LedewireAuthManager.apiBase` is now `readonly`.
