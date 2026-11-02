# @ledewire/x402-client

## 0.4.0

### Minor Changes

- f59fe79: Add `RateLimitError`, thrown for a `429 Too Many Requests` from any endpoint (for example `content.search`, which allows 15 searches a minute per buyer). Its `retryAfter` carries the `Retry-After` header as seconds to wait, or `undefined` when the response sent none. It extends `LedewireError` with `statusCode` 429, so existing `statusCode === 429` checks keep working. `@ledewire/x402-client` re-exports it and throws it for a 429 on the paid retry or the buyer-key login (which used to surface as an `AuthError`).
- ce474c3: Sync `ledewire.yml` from the API (ledewire/api `8d0afc18e7a21132b5b99003d2b6ff8fd6ad6cfe`) and regenerate the types. `content.getWithAccess`, `checkout.state` and `wallet.getPaymentStatus` now return exactly what their operation's 200 declares, and a type test pins them (plus signup and password reset) to the spec.

  - **Breaking:** `AuthPasswordResetResponse` (buyer `auth.requestPasswordReset` / `auth.resetPassword`) is now the flat `{ message: string }` the API sends, not `{ data?: { message?: string } }`. Read `result.message`.
  - **Breaking:** `auth.loginWithEmail` and `auth.loginWithGoogle` request bodies now require `email` and `password`, and `id_token`, matching the spec.
  - **Breaking:** `CheckoutStateResponse.content_title` (and `CheckoutState`) is `string | null`.
  - **Breaking:** `WalletPaymentStatusResponse.status` can be `'reverted'`, so an exhaustive `switch` on it needs a new case. `balance_cents` stays `number | null`.
  - **Breaking:** `LedewireSettlementResponse.accessToken` (`@ledewire/x402-client`) is an optional `string`, never `null`.
  - **Breaking:** `X402BazaarResource.metadata.title` is `string | null`.
  - **Breaking:** `CompanyMemberUpdateRequest` (`company.members.update`) requires `role` or `daily_spend_limit_cents`. An empty body no longer type-checks.
  - **Breaking:** `ContentWithAccessResponse` is the API's closed shape: `id`, `content_type`, `title` (nullable), `teaser`, `price_cents`, `visibility: 'public'`, `resource_url` (nullable) and `access_info`. `content_body`, `content_uri`, `external_identifier` and `metadata` are gone. The deliverable comes only from `purchases.create()`.
  - **Breaking:** `MerchantSaleResponse` has `buyer_ref` in place of `buyer_id` and `buyer`, and its `fees.*_cents` are nullable (null until a sale completes).
  - **Breaking:** `PurchaseCreateRequest` requires `content_id` and `price_cents`.
  - **Breaking:** `PublicConfigResponse.google_client_id` is `string | null`.
  - **Breaking:** `PurchaseResponse.license`, `PurchaseResponse.content.filing`, `ContentSearchResult.filing` and `Publication.homepage` are required (nullable) fields. Reading code is unaffected; code that builds these objects, such as test mocks, must set them.
  - `AuthTokenRefreshRequest.refresh_token` is now required in the spec, but that type is not exported by the SDK, so it needs no migration.
  - `auth.signup` documents the API's `201 Created`.
  - New `AuthTokenRefreshResponse` (`@ledewire/node`): `POST /v1/auth/token/refresh` answers an `AuthenticationResponse` or a `MerchantAuthenticationResponse`.
  - Additive from the regeneration: `ContentSearchRequest` gains `cik`, `ticker`, `form_type` and `publication` filters; `ErrorType` gains `not_subscribed`, `selection_too_large` and `selection_value_too_large`; `CorpusResponse.state` gains `not_ready` and `nothing_purchased`; acquisition exclusion reasons gain `excluded_not_sold_in_bulk`; `AuthSignupRequest.name` is optional.

- c64b260: Add `client.x402.verifyOrigin({ url, store_id? })` and `client.x402.getJwks()` (both public, no auth), with the `X402VerifyOriginParams`, `X402VerifyOriginResponse` and `X402JwksResponse` types. A `429` from `verifyOrigin` throws `RateLimitError` with `retryAfter`; a `503` from `getJwks` throws `LedewireError` with message `'JWKS unavailable'`.
  **Breaking:** `LedewireSettlementResponse` is now a type alias of the spec's generated `SettlementResponse`, so `network` is typed as `'ledewire:v1'` instead of `string`: construct with `network: 'ledewire:v1'`; the type no longer supports declaration merging.
  A failed buyer-key login in `@ledewire/x402-client` now rejects with the API's own error message instead of a generic one.

## 0.3.4

### Patch Changes

- fc9e21f: The client now only pays and authenticates against the configured Ledewire API.

  - The buyer-key login always goes to the client's configured `apiBase` (default `https://api.ledewire.com`). The `extensions.ledewire-wallet.apiBase` field of a `PAYMENT-REQUIRED` challenge no longer changes where the client logs in.
  - A payment is built only when the request that received the `402` is on the configured `apiBase` origin. A `402` from any other origin is returned to the caller unpaid, with no login and no `PAYMENT-SIGNATURE` retry: `wrapFetchWithPayment` / `createLedewireFetch` return the original `Response`, and `wrapAxiosWithPayment` rejects with the original Axios error. The Axios adapter resolves `baseURL` plus a relative `url` before checking.
  - The paid retry doesn't follow redirects (`redirect: 'error'` for fetch, `maxRedirects: 0` for Axios), so `PAYMENT-SIGNATURE` is only ever sent to the URL that was checked.
  - `wrapAxiosWithPayment` pays a request at most once. If the paid retry is answered with another `402` challenge, it rejects instead of paying again.
  - New `LedewirePaymentClient.allowsPaymentTo(url)` reports whether a URL is on the configured API origin.
  - `PaymentSigner` gains an optional `allowsPaymentTo(url)`. Custom signers that don't implement it keep their current behaviour.
  - New `PaymentOriginNotAllowedError` (a `LedewireError`, status `402`) is thrown when `buildPaymentSignature` is called directly with a URL outside the configured API origin.
  - `LedewireAuthManager.apiBase` is now `readonly`.

## 0.3.3

### Patch Changes

- 00a70cd: Sync with the 2026-10 LedeWire API spec.

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

## 0.3.2

### Patch Changes

- 647e6d8: Publish via npm trusted publishing (OIDC) instead of a long-lived npm token. Releases now carry npm provenance attestations, and each package's metadata links back to its source directory in the GitHub repository.

## 0.3.1

### Patch Changes

- 508cdab: Raise the axios peer dependency from `>=1.16.0` to `>=1.20.0`, excluding versions affected by the advisories published 2026-09-30: HTTP/2 adapter bypassing DNS lookup and proxy controls (GHSA-3pq3-5fj3-cg6v), a denial of service from an unhandled HTTP/2 session `error` event (GHSA-542g-h47m-68v8), ReDoS in the `data:` URL parser (GHSA-c29m-xwm3-cm6r) and in proxy host normalization (GHSA-mghh-pgcx-3jjj), and prototype-pollution gadgets (GHSA-x97p-jq2g-jp4f, plus two moderate advisories).

## 0.3.0

### Minor Changes

- 8976828: Sync with the 2026-09 LedeWire API spec.

  **Breaking — single-use purchases.** `CheckoutNextAction` / `NextRequiredAction` no longer include
  `view_content` (checkout state) or `none` (content with access): the API withdrew both. A completed
  purchase no longer implies access; `has_purchased` means "has ever bought". The purchased content is
  delivered only on the `purchases.create()` response (`content_body` as plain UTF-8, or `content_uri`)
  and is never served again, so persist it immediately.

  **New**
  - `SpendCapReachedError` (402, `error.type === 'daily_spend_cap_reached'`) with `capCents`,
    `spentCents`, `remainingCents`, `resetsAt`, and `bulkExempt`. Funding the wallet does not clear it.
    `LedewireError` gains an optional machine-readable `type`. x402-client's fetch and Axios adapters
    throw it — and map `insufficient_funds`/`invalid_ledewire_wallet_payload_token`/
    `invalid_ledewire_wallet_payload_role` to `InsufficientFundsError`/`AuthError`/`ForbiddenError` —
    from the PAID request's `402` refusal, per the x402 v2 HTTP transport spec
    (`PAYMENT-RESPONSE` header, ledewire/api#1066); a pre-api#1066 fallback still reads the same
    errors off a bare `402`/`422`/`401`/`403` when that header is absent.
  - `user.spendCap.get()` / `.update()` (node and browser).
  - `user.mcpKeys.list()` / `.create()` / `.revoke()` (node and browser).
  - Node: `publications.list()` / `.listWorks()`, and `acquisitions.*` for bulk licensing: create,
    poll, requote, acknowledge exclusions, authorize, per-work results, corpus state/build/streamed
    download, signed manifest, and signing-key history. These are also available on `createAgentClient()`.
  - Node: `x402.discoverResources()` for the public x402 Bazaar discovery endpoint.
  - Content types `html` (inline or remote), `pdf`, `image`, and `video`; `brokered` on responses.
  - Wallet balance `spendable_cents`, `held_cents`, and `holds`; `bulk_acquisition` / `bulk_hold`
    transaction reasons.

## 0.2.1

### Patch Changes

- 199de9c: Tighten axios peer dependency from `>=1.0.0` to `>=1.16.0` to exclude versions affected by multiple high/critical security advisories including prototype pollution gadgets, NO_PROXY bypass (SSRF), header injection, ReDoS via cookie name, and credential leak via proxy redirect.

## 0.2.0

### Minor Changes

- 7e8b30c: **Initial release of `@ledewire/x402-client`**

  Runtime-agnostic x402 payment client for the Ledewire `ledewire-wallet` payment scheme.
  Drop it in as a replacement for `fetch`, wire it into Axios, or call `buildPaymentSignature`
  directly inside any other HTTP client's interceptor.

  ```ts
  // fetch — one-liner drop-in
  import { createLedewireFetch } from '@ledewire/x402-client'

  const fetch = createLedewireFetch({ key, secret })
  const res = await fetch('https://blog.example.com/posts/great-article')
  ```

  ```ts
  // Axios — response interceptor
  import axios from 'axios'
  import { LedewirePaymentClient } from '@ledewire/x402-client'
  import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'

  const client = new LedewirePaymentClient({ key, secret })
  const api = wrapAxiosWithPayment(axios.create(), client)
  ```

  ```ts
  // Any other HTTP client — use buildPaymentSignature directly
  const sig = await client.buildPaymentSignature(
    response.headers.get('payment-required'),
    request.url,
  )
  ```

  **Features:**
  - Fully transparent 402→pay→retry loop using the `ledewire-wallet` x402 scheme
  - `LedewirePaymentClient` core class + `PaymentSigner` interface separates credentials from transport
  - `wrapFetchWithPayment` — fetch adapter (main export)
  - `wrapAxiosWithPayment` — Axios adapter (`@ledewire/x402-client/axios` subpath, optional peer dep)
  - `payment-identifier` idempotency extension: stable UUID per request when server advertises support, preventing double-charging on network retries
  - Buyer JWT cached in-memory and auto-refreshed 60 seconds before expiry
  - `apiBase` self-configures from the server's `PAYMENT-REQUIRED` extension block
  - Typed error hierarchy: `InsufficientFundsError`, `NonceExpiredError`, `UnsupportedSchemeError`, `MalformedPaymentRequiredError`
  - Web-standard APIs only — works on Node 18+, Deno, Cloudflare Workers, Vercel Edge
