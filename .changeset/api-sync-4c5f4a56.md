---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Sync with LedeWire API `4c5f4a56`.

- **Breaking:** `user.spendCap.update()` takes `daily_spend_limit_cents: number`. The API refuses `null` (422): a Buyer can change the cap but not remove it.
- **Breaking:** `spending_limit_cents` is removed from Buyer-key creation (`user.apiKeys.create()`) and from `UserApiKey`. The API refuses it with 400. A key has no spend limit of its own; the Buyer's daily Spend cap limits what it spends.
- `PurchaseResponse.payment_key_id` names the Payment key that paid for an x402 purchase, and is `null` for every other purchase.
- Publication works carry `page_kind`, `page_kind_basis`, `topics` and `topics_basis`. `publications.listWorks()` takes a `page_kind` filter (node). Acquisition works record the same labels from pricing.
- Purchase docs: a 429 `RateLimitError` past 60 purchases a minute, and SEC filings open to every signed-in Buyer (`not_subscribed` is no longer returned).
