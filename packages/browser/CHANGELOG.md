# @ledewire/browser

## 0.6.0

### Minor Changes

- a379cac: ## Breaking changes

  ### `lw.auth.loginWithApiKey()` moved to `lw.seller.loginWithApiKey()`

  API key authentication now lives on the seller namespace where it semantically belongs. Update all call sites:

  ```ts
  // Before
  await lw.auth.loginWithApiKey({ key: 'your_api_key' })

  // After
  await lw.seller.loginWithApiKey({ key: 'your_api_key' })
  ```

  ### `content_body` and `teaser` are now plain text

  The SDK now transparently decodes base64 on all content responses. Remove any `atob()` calls in your rendering code:

  ```ts
  // Before
  const { content_body } = await lw.content.getWithAccess('id')
  renderMarkdown(atob(content_body))

  // After — no atob() needed
  const { content_body } = await lw.content.getWithAccess('id')
  renderMarkdown(content_body)
  ```

  ### `lw.content.getWithAccess()` no longer accepts a `userId` parameter

  The second parameter was a server-side concept that had leaked into the browser package. In a browser context the authenticated user is always implicit from the token. Remove the argument if you were passing it.

  ## New features

  ### `sessionStorageAdapter`

  A new built-in token storage adapter that persists tokens for the lifetime of the current browser tab — cleared automatically when the tab is closed. Useful for sensitive workflows where `localStorage` persistence is undesirable.

  ```ts
  import { init, sessionStorageAdapter } from '@ledewire/browser'

  const lw = init({ apiKey: '...', storage: sessionStorageAdapter() })
  ```

  ## Fixes and improvements
  - **`ContentResponse` exported** from `@ledewire/browser` — was previously missing from the public surface
  - **`CheckoutState`** is now a type alias for `CheckoutStateResponse` (not a separate interface) — existing code is unaffected
  - **`external_identifier`** added to `SellerContentSearchRequest` — search content by its namespaced platform ID (e.g. `'vimeo:123456789'`)
  - **`ForbiddenError` JSDoc** now shows correct import path for both browser and node packages
  - **`metadata.reading_time`** annotated in types (not `read_time`) to prevent silent runtime `undefined`

## 0.5.0

### Minor Changes

- 75ff5e2: ## New: `lw.auth.requestPasswordReset()` and `lw.auth.resetPassword()`

  The browser SDK now exposes the full buyer password reset flow directly from `lw.auth`.

  ```ts
  // Step 1 — send reset code to buyer's email
  await lw.auth.requestPasswordReset({ email: 'buyer@example.com' })
  // → { data: { message: 'If an account with this email exists, a reset code has been sent.' } }

  // Step 2 — submit the 6-digit code and new password
  await lw.auth.resetPassword({
    email: 'buyer@example.com',
    reset_code: '123456',
    password: 'new-secure-password',
  })
  // → { data: { message: 'Password has been successfully reset.' } }
  ```

  The `reset-request` response is intentionally ambiguous — the API returns the same success message whether or not the email exists, preventing account enumeration.

  **New exported types:** `AuthPasswordResetRequestBody`, `AuthPasswordResetBody`, `AuthPasswordResetResponse`

## 0.4.0

### Minor Changes

- fb22c24: ## New: `lw.seller.content` — browse store content from the browser

  The browser SDK now includes a `seller` namespace for read-only content discovery using an API key token. This enables storefronts to list, search, and fetch their own content catalogue without needing a server-side proxy.

  ```ts
  const lw = Ledewire.init({ apiKey: 'your_api_key' })

  // Obtain a view-only seller token (API key only — no secret required)
  await lw.auth.loginWithApiKey({ key: 'your_api_key' })

  // List all content
  const items = await lw.seller.content.list()

  // Search by title, URI, or metadata
  const results = await lw.seller.content.search({ title: 'intro' })
  const byMeta = await lw.seller.content.search({ metadata: { author: 'Alice' } })

  // Fetch a single item
  const item = await lw.seller.content.get('content-id')
  ```

  ## New: `lw.auth.loginWithApiKey({ key, secret? })`

  Buyer auth now supports API key login. Provide only `key` for read-only (`view`) access — sufficient for all `lw.seller.content.*` methods. Provide both `key` and `secret` for full read/write access.

  ```ts
  // View access (read-only)
  await lw.auth.loginWithApiKey({ key: 'your_api_key' })

  // Full access (read/write)
  await lw.auth.loginWithApiKey({ key: 'your_api_key', secret: 'your_secret' })
  ```

## 0.3.0

### Minor Changes

- dc814b0: ## New: `client.config.getPublic()` — unauthenticated public config

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

## 0.2.2

### Patch Changes

- 3bd68d0: Fix TypeScript type declarations leaking unpublished `@ledewire/core` dependency

  `dist/index.d.ts` in both packages contained `import`/`export … from '@ledewire/core'` statements. Because `@ledewire/core` is a private internal package not published to npm, TypeScript consumers could not resolve these types, causing:
  - All re-exported types (`LedewireError`, `AuthError`, `StoredTokens`, etc.) resolving to `any`
  - `instanceof LedewireError` checks not narrowing the catch variable (`TS18046`)
  - `TokenStorage` callback parameters implicitly typed as `any` (`TS7006`)

  Both packages now produce fully self-contained declaration files with all `@ledewire/core` types inlined. Runtime behaviour is unchanged.

## 0.2.1

### Patch Changes

- f89cd38: fix: move @ledewire/core to devDependencies

  @ledewire/core is a private, internal package that is fully bundled into the
  output of @ledewire/browser and @ledewire/node at build time. Having it listed
  under `dependencies` caused npm/yarn/pnpm consumers to receive an unresolvable
  package error on install, since @ledewire/core is never published to the registry.

## 0.2.0

### Minor Changes

- 1eb6e40: Add support for external_ref content type (Vimeo, YouTube, PDFs, etc.)

### Patch Changes

- Updated dependencies [1eb6e40]
  - @ledewire/core@0.1.0
