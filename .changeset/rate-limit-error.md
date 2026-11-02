---
'@ledewire/node': minor
'@ledewire/browser': minor
'@ledewire/x402-client': minor
---

Add `RateLimitError`, thrown for a `429 Too Many Requests` from any endpoint (for example `content.search`, which allows 15 searches a minute per buyer). Its `retryAfter` carries the `Retry-After` header as seconds to wait, or `undefined` when the response sent none. It extends `LedewireError` with `statusCode` 429, so existing `statusCode === 429` checks keep working. `@ledewire/x402-client` re-exports it and throws it for a 429 on the paid retry or the buyer-key login (which used to surface as an `AuthError`).
