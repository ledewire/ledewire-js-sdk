# LedeWire JS SDK

[![CI](https://github.com/ledewire/ledewire-js-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/ledewire/ledewire-js-sdk/actions/workflows/ci.yml)
[![Coverage: ≥90%](https://img.shields.io/badge/coverage-%E2%89%A590%25-brightgreen)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Official JavaScript/TypeScript SDK for the [LedeWire API](https://api.ledewire.com/api-docs/index.html) — the content marketplace platform for selling articles, guides, and media behind a paywall.

## Packages

| Package                                  | Description                                         | Version                                                                                                   |
| ---------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`@ledewire/browser`](packages/browser/) | Browser SDK for embedding a paywall on any website  | [![npm](https://img.shields.io/npm/v/@ledewire/browser)](https://www.npmjs.com/package/@ledewire/browser) |
| [`@ledewire/node`](packages/node/)       | Node.js SDK — full API for building merchant stores | [![npm](https://img.shields.io/npm/v/@ledewire/node)](https://www.npmjs.com/package/@ledewire/node)       |

## CDN — No Install Required

Drop this script tag on any page to enable buyer authentication, wallet funding,
and content purchases:

```html
<!-- Pin to a major version in production -->
<script src="https://cdn.jsdelivr.net/npm/@ledewire/browser@1/dist/ledewire.min.js"></script>
<script>
  const lw = Ledewire.init({ apiKey: 'your_api_key' })

  // Determine what the current visitor needs to do next
  const state = await lw.checkout.state('content-id')
  // state.checkout_state.next_required_action:
  //   'authenticate' | 'fund_wallet' | 'purchase' | 'view_content'
</script>
```

## Node.js

```bash
npm install @ledewire/node
```

```ts
import { createClient } from '@ledewire/node'

// Full access (API key + secret)
const client = createClient({
  apiKey: process.env.LEDEWIRE_API_KEY,
  apiSecret: process.env.LEDEWIRE_API_SECRET,
})

// Merchant email/password auth
const client = createClient()
await client.merchant.auth.loginWithEmail({ email, password })
const stores = await client.merchant.auth.listStores()
```

## Documentation

- [Getting Started & Guides](https://ledewire.github.io/ledewire-js-sdk/)
- [API Reference](https://ledewire.github.io/ledewire-js-sdk/api/)
- [LedeWire REST API Docs](https://api.ledewire.com/api-docs/index.html)
- [Examples](examples/)

## Contributing

See [CONTRIBUTING.md](.github/CONTRIBUTING.md).

```bash
pnpm install
pnpm build
pnpm test
```

## License

MIT
