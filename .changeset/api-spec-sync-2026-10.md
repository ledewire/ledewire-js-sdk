---
'@ledewire/node': minor
'@ledewire/browser': minor
---

Sync the SDK with the October 2026 LedeWire API spec.

- **Company (node):** new `client.company` namespace for Company membership, members, invitations, Machine users with their Buyer and MCP keys, the Company wallet and top-ups, purchases, and spend per member.
- **Topics and publications (node):** new `client.topics.list()` for the Topic directory. `publications.list()` takes `q`, `bulk_licensable` and `topics`. New `publications.get(id)`.
- **Content search (node):** `client.content.search()` runs the buyer search across every Store and Publication, with cursor paging.
- **Acquisitions (node):** `client.acquisitions.cancel(id)` withdraws a quote or stops a Company-paid hold.
- **Breaking type changes:** `wallet.balance()` `balance_cents` and `spendable_cents` are `null` for a Company member. `remaining_cents` and `company_name` are new on wallet, spend cap and content access responses. `WalletPaymentStatus` gains new statuses.
- **Auth:** signup and Google login accept `invitation_token` and `company_invitation_token`. Login responses can carry an `invitations` outcome.
- **HTTP client:** query params accept booleans and arrays. An array repeats its key, as in `topics[]`.
