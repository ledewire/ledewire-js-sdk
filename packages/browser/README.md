# @ledewire/browser

[![npm](https://img.shields.io/npm/v/@ledewire/browser)](https://www.npmjs.com/package/@ledewire/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Browser SDK for the [LedeWire](https://api.ledewire.com/api-docs/index.html) content marketplace — embed buyer authentication, wallet funding, content purchases, and seller content discovery on any website with a single script tag.

## CDN — No Install Required

```html
<!-- Pin to a major version in production -->
<script src="https://cdn.jsdelivr.net/npm/@ledewire/browser@0/dist/ledewire.min.js"></script>
<script>
  const lw = Ledewire.init({ apiKey: 'your_api_key' })

  // Determine what the visitor needs to do next
  const state = await lw.checkout.state('content-id')
  // state.checkout_state.next_required_action:
  //   'authenticate' | 'fund_wallet' | 'purchase'
</script>
```

## npm / ESM

```bash
npm install @ledewire/browser
```

```ts
import { init, localStorageAdapter } from '@ledewire/browser'

const lw = init({
  apiKey: 'your_api_key',
  // Persist sessions across page reloads (defaults to in-memory)
  storage: localStorageAdapter(),
  // Called when the session expires and cannot be refreshed
  onAuthExpired: () => showLoginModal(),
})
```

## Client Namespaces

| Namespace           | Description                                                                     |
| ------------------- | ------------------------------------------------------------------------------- |
| `lw.config`         | Platform public config (no auth required)                                       |
| `lw.auth`           | Buyer signup, email/password login, Google OAuth, API key login, password reset |
| `lw.wallet`         | Wallet balance, fund wallet via payment session                                 |
| `lw.purchases`      | List and create content purchases                                               |
| `lw.content`        | Fetch content with buyer access info                                            |
| `lw.checkout`       | Checkout state — what action is required next                                   |
| `lw.seller.content` | List, search, and get store content (API key auth)                              |

## Example: Fetch Google OAuth Client ID Before Sign-In

```ts
const lw = Ledewire.init({ apiKey: 'your_api_key' })

// No login needed — safe to call on page load
const { google_client_id } = await lw.config.getPublic()
google.accounts.id.initialize({ client_id: google_client_id, callback: handleCredential })
google.accounts.id.renderButton(document.getElementById('signin-btn'), { theme: 'outline' })
```

## Example: Full Checkout Flow

Purchases are single-use: a completed purchase does not by itself grant access
again later. `has_purchased` means only "has ever bought" — buying delivers the
content directly in the `purchases.create()` response, and that response is the
only place `content_body` / `content_uri` ever appear for a purchase.

```ts
const lw = Ledewire.init({ apiKey: 'your_api_key' })

const { checkout_state } = await lw.checkout.state('article-123')

switch (checkout_state.next_required_action) {
  case 'authenticate':
    await lw.auth.loginWithEmail({ email, password })
    break
  case 'fund_wallet':
    const session = await lw.wallet.createPaymentSession({ amount_cents: 500 })
    // redirect to session.payment_url
    break
  case 'purchase': {
    // Buying is how the buyer receives the content — the delivery comes back
    // directly in this response, never from a later GET. Persist it now:
    // there is no route that serves the same delivery again.
    const purchase = await lw.purchases.create({ content_id: 'article-123' })
    await saveDeliveredContent(purchase) // your own persistence, e.g. IndexedDB

    if (purchase.content_body) {
      // content_body is always plain UTF-8 text on the wire — never
      // base64-encoded — so no decoding step is needed. What it contains
      // depends on purchase.content.content_type.
      if (purchase.content.content_type === 'markdown') {
        renderMarkdown(purchase.content_body)
      } else if (purchase.content.content_type === 'html') {
        // Inline HTML content is seller-supplied and must be sanitised
        // before insertion — never assign it to innerHTML directly.
        container.innerHTML = DOMPurify.sanitize(purchase.content_body)
      }
    } else if (purchase.content_uri) {
      // content_uri points at a remote resource (video, PDF, image, or
      // remote HTML). Check the scheme before navigating or linking to it —
      // the URI is seller-supplied and a non-http(s) scheme should not be
      // followed automatically.
      const uri = new URL(purchase.content_uri)
      if (['https:', 'http:'].includes(uri.protocol)) {
        window.location.href = purchase.content_uri
      }
    }
    break
  }
}
```

## Example: Seller Content Discovery

Use `lw.seller.loginWithApiKey` with only the `key` to obtain a read-only token,
then browse your store's content catalogue directly from the browser:

```ts
const lw = Ledewire.init({ apiKey: 'your_api_key' })

// Obtain a view-only seller token (key only — no secret needed)
await lw.seller.loginWithApiKey({ key: 'your_api_key' })

// List all content
const items = await lw.seller.content.list()

// Search by title, URI, or metadata
const results = await lw.seller.content.search({ title: 'intro' })
const byMeta = await lw.seller.content.search({ metadata: { author: 'Alice' } })

// Fetch a single item
const item = await lw.seller.content.get('content-id')
```

## Token Storage

By default tokens are stored **in memory** (most secure — cleared on page unload).
Two built-in adapters are available for persistent sessions:

```ts
import { init, localStorageAdapter, sessionStorageAdapter } from '@ledewire/browser'

// Persists across tabs and browser restarts
const lw = init({ apiKey: '...', storage: localStorageAdapter() })

// Persists within the current tab only (cleared on tab close)
const lw = init({ apiKey: '...', storage: sessionStorageAdapter() })
```

Token refresh is handled automatically — you never need to call a refresh method manually.

## Documentation

- [Getting Started Guide](https://ledewire.github.io/ledewire-js-sdk/guides/browser-cdn.html)
- [API Reference](https://ledewire.github.io/ledewire-js-sdk/api/)
- [Full SDK README](../../README.md)

## License

MIT
