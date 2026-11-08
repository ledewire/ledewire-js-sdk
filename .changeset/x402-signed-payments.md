---
'@ledewire/x402-client': minor
---

**Breaking:** the client needs a Payment key and no longer pays with a session token, because the API no longer accepts session-token payments. Configure `createLedewireFetch` and `LedewirePaymentClient` with `{ paymentKey: { id, privateKey } }` instead of `{ key, secret }`, after registering a key once with `registerPaymentKey({ key, secret, name })`.

- Each payment is a Payment authorization signed with the key's Ed25519 private half (WebCrypto, no new dependency) over `ledewire-payment-authorization:` and the RFC 8785 canonical JSON of the authorization, with a fresh 32-byte random nonce. The private key never leaves the client.
- New `maxPriceCents` option: a higher price throws `PriceAboveMaximumError` before anything is signed.
- A refused payment throws `PaymentRefusedError`, whose `refusal` names the code. `payment_authorization_expired` is re-signed once, and `amount_mismatch` once within `maxPriceCents`. A request is signed at most twice.
- New `registerPaymentKey`, `createPaymentKeyRegistration`, `generatePaymentKey` and `canonicalAuthorization` exports.
- **Breaking:** `NonceExpiredError`, `LedewireWalletExtra` and `LedewireWalletExtension` are removed. The challenge carries no server nonce or discovery block, and `extra: {}` now parses.
- **Breaking:** `LedewirePaymentClient.auth` is removed, and the package needs Node.js 20+ (or any runtime with WebCrypto Ed25519).
