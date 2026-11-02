---
'@ledewire/node': minor
'@ledewire/x402-client': minor
---

Add `client.x402.verifyOrigin({ url, store_id? })` and `client.x402.getJwks()` (both public, no auth), with the `X402VerifyOriginParams`, `X402VerifyOriginResponse` and `X402JwksResponse` types. A `429` from `verifyOrigin` throws `RateLimitError` with `retryAfter`; a `503` from `getJwks` throws `LedewireError` with message `'JWKS unavailable'`.
**Breaking:** `LedewireSettlementResponse` is now a type alias of the spec's generated `SettlementResponse`, so `network` is typed as `'ledewire:v1'` instead of `string`: construct with `network: 'ledewire:v1'`; the type no longer supports declaration merging.
A failed buyer-key login in `@ledewire/x402-client` now rejects with the API's own error message instead of a generic one.
