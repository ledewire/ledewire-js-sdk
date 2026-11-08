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

| Namespace             | Description                                                                     |
| --------------------- | ------------------------------------------------------------------------------- |
| `lw.config`           | Platform public config (no auth required)                                       |
| `lw.auth`             | Buyer signup, email/password login, Google OAuth, API key login, password reset |
| `lw.wallet`           | Wallet balance, fund wallet via payment session                                 |
| `lw.purchases`        | List and create content purchases; download a purchase's licence document       |
| `lw.content`          | Fetch content with buyer access info                                            |
| `lw.checkout`         | Checkout state — what action is required next                                   |
| `lw.user.spendCap`    | Buyer's daily spend cap — read and update the ceiling                           |
| `lw.user.mcpKeys`     | Manage buyer MCP API keys for the Ledewire MCP server                           |
| `lw.user.paymentKeys` | Register, list and revoke the Ed25519 Payment keys that sign x402 payments      |
| `lw.company`          | Company wallets: membership, invitations, members, Machine users, top-ups       |

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

const { price_cents, checkout_state } = await lw.checkout.state('article-123')

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
    // price_cents is the price the buyer was shown; a stale one is refused (422).
    const purchase = await lw.purchases.create({ content_id: 'article-123', price_cents })
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

## Example: Purchase Licences

Every purchase carries `license` (a `PurchaseLicense`, or `null` when none was recorded —
every Store work, and older brokered purchases; `null` never means "no rights"), plus
`content.publication` (the brokered work's Publication, or `null`) and `content.filing`
(the SEC filing, or `null`). When `license.document_url` is set,
`lw.purchases.licenseDocument()` downloads it as `{ body: ArrayBuffer, contentType }` —
usually `application/pdf`, or `text/markdown` for an SEC filing's terms.

```ts
const purchase = await lw.purchases.get(purchaseId)
if (purchase.license?.document_url) {
  const { body, contentType } = await lw.purchases.licenseDocument(purchase.id)
  // The type is the source's choice: offer a download, never render it inline.
  // Pass the type through only for the two expected ones, so a server-sent
  // text/html can never run in this origin.
  const type = /^(application\/pdf|text\/markdown)\s*(;|$)/.test(contentType)
    ? contentType
    : 'application/octet-stream'
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'licence'
  a.click()
  URL.revokeObjectURL(url)
}
```

## Example: Spend Cap & MCP API Keys

```ts
// Every buyer starts with a default daily spend cap governing every wallet
// debit. Exceeding it throws SpendCapReachedError (402) from
// lw.purchases.create() — funding the wallet does not clear it.
const cap = await lw.user.spendCap.get()
if (cap.remaining_cents !== null && cap.remaining_cents < 500) {
  console.warn(`Only ${cap.remaining_cents}c left before the cap resets at ${cap.resets_at}`)
}
await lw.user.spendCap.update({ daily_spend_limit_cents: 2000 }) // raise to $20/day

// MCP API keys authenticate agent requests to the Ledewire MCP server. The
// secret is shown once at creation — store it immediately.
const { key, secret } = await lw.user.mcpKeys.create({ label: 'my-agent', can_search: true })
const keys = await lw.user.mcpKeys.list() // secrets never included
await lw.user.mcpKeys.revoke(keys[0].id) // to change scopes: revoke + recreate

// Payment keys: the public Ed25519 keys that sign x402 payments. Never a login
// credential and no secret; the SDK never takes the private key. `public_key` is
// unpadded base64url of the 32 raw public-key bytes; `proof` is unpadded base64url
// of that key's signature over 'ledewire-payment-key:' + public_key (see the
// @ledewire/node README for a Node crypto recipe). At most 10 active: register the
// replacement before revoking. Buyer tokens only; a bad proof or key gets 422.
const paymentKey = await lw.user.paymentKeys.create({ name: 'my-agent', public_key, proof })
const paymentKeys = await lw.user.paymentKeys.list() // a plain array, newest first
await lw.user.paymentKeys.revoke(paymentKey.id)
```

## Example: Company Wallets

A Company is a shared wallet that pays for its members' purchases. A member
**never sees the Company balance**: `wallet.balance()` returns
`balance_cents: null`, and `remaining_cents` / `company_name` say what they may
still spend today and whose wallet pays. Handle `null` before rendering or
doing arithmetic on a balance.

```ts
const wallet = await lw.wallet.balance()
const label =
  wallet.company_name !== null
    ? `${wallet.company_name} pays — ${wallet.remaining_cents ?? '∞'}c left today`
    : `Balance: ${wallet.balance_cents}c`

// Accepting an invitation needs the token from the invitation email:
await lw.company.invitations.accept({ token }) // existing account
await lw.auth.signup({ email, password, name, company_invitation_token: token }) // new account

// Company admins: members, spend caps, Machine users, top-ups, reports
const { data: members } = await lw.company.members.list()
await lw.company.members.update(members[0].id, { daily_spend_limit_cents: 5000 })
const { balance_cents, held_cents } = await lw.company.wallet.get() // the Company balance
const { data: pending } = await lw.company.wallet.listPendingTopUps()
```

The full surface (`membership`, `invitations`, `members`, `machineUsers` with
`buyerKeys` / `mcpKeys` / `paymentKeys`, `wallet`, `purchases`, `spend`) matches
[`@ledewire/node`](../node/README.md#example-company-wallets). Admin-only
methods throw `ForbiddenError` for a plain member.

## Store content management lives server-side

`@ledewire/browser` is buyer-only. It has no `lw.seller` namespace and no store
API-key login: a store API key must never be shipped to a browser. Manage store
content from a server with `client.merchant.content.*` in
[`@ledewire/node`](../node/README.md), passing the store's id explicitly.

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
