---
'@ledewire/node': minor
'@ledewire/browser': minor
---

## New: `client.config.getPublic()` — unauthenticated public config

Both `@ledewire/node` and `@ledewire/browser` now expose a `config` namespace with a single
`getPublic()` method. This resolves the Google Sign-In circular dependency: the
`google_client_id` needed to render the sign-in button can now be fetched before the user
has authenticated.

```ts
// Node
const { google_client_id } = await client.config.getPublic()

// Browser
const { google_client_id } = await lw.config.getPublic()
google.accounts.id.initialize({ client_id: google_client_id, callback })
```

No `apiKey` or bearer token is required. The endpoint is `GET /v1/config/public`.

## New: `ContentSearchRequest` extended with `title` and `uri` fields

`seller.content.search()` now accepts `title` (case-insensitive partial match) and `uri`
(case-insensitive partial match against `external_ref` content URIs) in addition to the
existing `metadata` AND-match. All three fields are now optional — at least one must be
supplied.

```ts
// Search by title
const { data } = await client.seller.content.search(storeId, { title: 'intro' })

// Search by external URI
const { data } = await client.seller.content.search(storeId, { uri: 'vimeo.com' })

// Combine all three
const { data } = await client.seller.content.search(storeId, {
  title: 'tutorial',
  uri: 'vimeo.com',
  metadata: { category: 'ml' },
})
```

## Improved: Merchant login 403 on role mismatch is now `ForbiddenError`

`loginWithEmail` and `loginWithGoogle` on `merchant.auth` now throw `ForbiddenError`
(rather than a generic `LedewireError`) when credentials are valid but the account has no
merchant store access. This is distinct from `AuthError` (wrong password / bad token).

```ts
try {
  await client.merchant.auth.loginWithEmail({ email, password })
} catch (err) {
  if (err instanceof ForbiddenError) {
    // Account exists but has no store access — wrong account
  } else if (err instanceof AuthError) {
    // Bad credentials
  }
}
```

## New exported type: `PublicConfigResponse`

`PublicConfigResponse` is now exported from both packages. It reflects
`components['schemas']['PublicConfigResponse']` from the OpenAPI spec
(`{ google_client_id: string }`).
