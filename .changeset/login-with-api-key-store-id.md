---
'@ledewire/node': minor
'@ledewire/browser': minor
---

`client.auth.loginWithApiKey()` now resolves with `store_id`, the store the API key belongs to, typed by the new `StoreAuthenticationResponse`: `const { store_id } = await client.auth.loginWithApiKey({ key, secret })`, then pass it to `client.merchant.*(store_id)`. It is read from the API response (added in ledewire/api#1675), never decoded from the token.
`StoredTokens` gains an optional `storeId`, set on a store API-key login and on every refresh of that session, so `storage.setTokens` and `onTokenRefreshed` see it. It is absent for every other session.
