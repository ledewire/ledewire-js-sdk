---
'@ledewire/node': minor
'@ledewire/browser': minor
---

A rejected login no longer looks like an expired session.

Login, signup and password-reset calls now go out without the stored bearer token, and a `401` from them is treated as rejected credentials: the SDK no longer refreshes the session and resends the login. Before, a failed login with a session stored was sent twice, counting twice against the API's per-account login backoff, and could fire `onAuthExpired` and clear a session that was still valid.

- A failed login rejects with `AuthError` whose `message` is the API's (e.g. `Invalid email or password`, `Invalid key or secret`) instead of `Session expired. Please re-authenticate.`
- Affected calls: `auth.loginWithEmail`, `auth.loginWithGoogle`, `auth.loginWithBuyerApiKey`, `auth.loginWithApiKey` (node), `seller.loginWithApiKey` (browser), `merchant.auth.loginWithEmail` / `loginWithGoogle` (and their `…AndListStores` helpers), `auth.signup`, and the buyer and merchant `requestPasswordReset` / `resetPassword`.
- **Breaking:** wrong credentials on `POST /v1/auth/login/email` (`auth.loginWithEmail`), `POST /v1/auth/merchant/login/email` (`merchant.auth.loginWithEmail`, `loginWithEmailAndListStores`) and `POST /v1/auth/login/api-key` (`auth.loginWithApiKey`, browser `seller.loginWithApiKey`) now reject with `AuthError` (401) instead of `NotFoundError` (404), as the API answers them with 401 from ledewire/api#1483. Code that caught `NotFoundError` for a bad password or key must catch `AuthError`.
