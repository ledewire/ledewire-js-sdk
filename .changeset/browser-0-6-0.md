---
'@ledewire/browser': minor
---

## Breaking changes

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
