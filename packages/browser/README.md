# @ledewire/browser

[![npm](https://img.shields.io/npm/v/@ledewire/browser)](https://www.npmjs.com/package/@ledewire/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)

Browser SDK for the [LedeWire](https://api.ledewire.com/api-docs/index.html) content marketplace — embed buyer authentication, wallet funding, and content purchases on any website with a single script tag.

## CDN — No Install Required

```html
<!-- Pin to a major version in production -->
<script src="https://cdn.jsdelivr.net/npm/@ledewire/browser@0/dist/ledewire.min.js"></script>
<script>
  const lw = Ledewire.init({ apiKey: 'your_api_key' })

  // Determine what the visitor needs to do next
  const state = await lw.checkout.state('content-id')
  // state.checkout_state.next_required_action:
  //   'authenticate' | 'fund_wallet' | 'purchase' | 'view_content'
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

| Namespace      | Description                                      |
| -------------- | ------------------------------------------------ |
| `lw.auth`      | Buyer signup, email/password login, Google OAuth |
| `lw.wallet`    | Wallet balance, fund wallet via payment session  |
| `lw.purchases` | List and create content purchases                |
| `lw.content`   | Fetch content with buyer access info             |
| `lw.checkout`  | Checkout state — what action is required next    |

## Example: Full Checkout Flow

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
  case 'purchase':
    await lw.purchases.create({ content_id: 'article-123' })
    break
  case 'view_content':
    const content = await lw.content.get('article-123')
    // render content
    break
}
```

## Token Storage

By default tokens are stored **in memory** (most secure — cleared on page unload).
Use the built-in `localStorageAdapter` to persist sessions across reloads:

```ts
import { init, localStorageAdapter } from '@ledewire/browser'
const lw = init({ apiKey: '...', storage: localStorageAdapter() })
```

Token refresh is handled automatically — you never need to call a refresh method manually.

## Documentation

- [Getting Started Guide](https://ledewire.github.io/ledewire-js-sdk/guides/browser-cdn.html)
- [API Reference](https://ledewire.github.io/ledewire-js-sdk/api/)
- [Full SDK README](../../README.md)

## License

MIT
