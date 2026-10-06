---
'@ledewire/node': minor
'@ledewire/browser': minor
'@ledewire/x402-client': patch
---

Sync with the 2026-10 LedeWire API spec.

**Breaking (types) — Company members see no balance.** A buyer with an open Company membership
spends from the Company wallet and never sees its balance, so these fields are now `number | null`:
`WalletBalanceResponse.balance_cents` / `spendable_cents`, `WalletPaymentStatusResponse.balance_cents`,
and `ContentAccessInfo.wallet_balance_cents`. Those responses, and `UserSpendCap`, gain
`company_name` (whose wallet pays, else `null`); wallet balance and content access info also gain
`remaining_cents` (what the buyer may still spend today). Code that does arithmetic on the balance
must handle `null`.

**New**

- `company` namespace (node, `createAgentClient()`, and browser):
  - `membership.get()` / `.leave()`
  - `invitations.list()` / `.create()` / `.accept()`; `auth.signup()` accepts
    `company_invitation_token` to sign up and join in one step
  - `members.list()` / `.update()` (role or daily Spend cap) / `.remove()`
  - `machineUsers.list()` / `.create()` / `.deactivate()`, with `machineUsers.buyerKeys` and
    `machineUsers.mcpKeys` (`list` / `create` / `revoke`)
  - `wallet.createPaymentSession()` / `.listPendingTopUps()`
  - `purchases.list()` and `spend.list()` reports, filterable by member and date range
- Node: `acquisitions.cancel()` withdraws a quote, or lets a Company admin stop a held
  Company-paid acquisition.
- Node: `acquisitions.listWorks()` accepts `delivery_state`, `line_state`, and `exclusion_reason`
  filters (`AcquisitionWorksParams`).
- `AcquisitionResponse` / `CorpusResponse` carry `poll_after_seconds` while a bulk step is in
  progress; poll at that interval.
- `Publication.coverage_horizon`.
- `ErrorType` gains the bulk-acquisition refusals `exclusions_unacknowledged`, `quote_not_ready`,
  `quote_expired`, `quote_in_progress`, `invalid_acquisition_state`, `nothing_to_hold`, and
  `run_not_started`.
- `WalletPaymentStatusResponse.status` gains `awaiting_verification`, `processing`, and `cancelled`
  (ACH top-ups).
- `SpendCapReachedError` falls back to the refusal body's top-level `message` (for a Company member,
  "ask a Company admin") when the error envelope has none.
- `WalletPaymentSessionRequest.currency` is optional, as the API always allowed (it defaults to
  `usd`); the generated type had wrongly required it.
- `createMockClient()` stubs the new methods, and a test now fails if it misses any public method.
