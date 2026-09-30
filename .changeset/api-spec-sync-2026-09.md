---
'@ledewire/node': minor
'@ledewire/browser': minor
'@ledewire/x402-client': minor
---

Sync with the 2026-09 LedeWire API spec.

**Breaking — single-use purchases.** `CheckoutNextAction` / `NextRequiredAction` no longer include
`view_content` (checkout state) or `none` (content with access): the API withdrew both. A completed
purchase no longer implies access; `has_purchased` means "has ever bought". The purchased content is
delivered only on the `purchases.create()` response (`content_body` as plain UTF-8, or `content_uri`)
and is never served again, so persist it immediately.

**New**

- `SpendCapReachedError` (402, `error.type === 'daily_spend_cap_reached'`) with `capCents`,
  `spentCents`, `remainingCents`, `resetsAt`, and `bulkExempt`. Funding the wallet does not clear it.
  `LedewireError` gains an optional machine-readable `type`. x402-client throws it on a 402 with a
  spend-cap body and no `PAYMENT-REQUIRED` header.
- `user.spendCap.get()` / `.update()` (node and browser).
- `user.mcpKeys.list()` / `.create()` / `.revoke()` (node and browser).
- Node: `publications.list()` / `.listWorks()`, and `acquisitions.*` for bulk licensing: create,
  poll, requote, acknowledge exclusions, authorize, per-work results, corpus state/build/streamed
  download, signed manifest, and signing-key history. These are also available on `createAgentClient()`.
- Node: `x402.discoverResources()` for the public x402 Bazaar discovery endpoint.
- Content types `html` (inline or remote), `pdf`, `image`, and `video`; `brokered` on responses.
- Wallet balance `spendable_cents`, `held_cents`, and `holds`; `bulk_acquisition` / `bulk_hold`
  transaction reasons.
