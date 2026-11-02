---
'@ledewire/node': minor
---

- **Breaking:** `client.content.getWithAccess(id)` no longer takes a `userId`, and no longer sends `user_id`. `GET /v1/content/{id}/with-access` is a Buyer route: call it with a buyer token (or none), and it reports only the caller's own access. A store credential (a merchant login, `auth.loginWithApiKey`, or `createClient({ apiKey, apiSecret })`) gets `403`, thrown as `ForbiddenError`. There is no replacement for looking up another buyer's access.
- **Breaking:** `client.content.getWithAccess` now returns `teaser` as plain UTF-8 text, decoded from base64, as `@ledewire/browser` does. Drop any `atob` / `Buffer.from(teaser, 'base64')` on its result.
- `client.content.getWithAccess` URL-encodes `id`, so an id containing `/` reaches the right content.
