---
'@ledewire/node': minor
'@ledewire/browser': minor
'@ledewire/x402-client': minor
---

Sync `ledewire.yml` from the API (ledewire/api `8d0afc18e7a21132b5b99003d2b6ff8fd6ad6cfe`) and regenerate the types. `content.getWithAccess`, `checkout.state` and `wallet.getPaymentStatus` now return exactly what their operation's 200 declares, and a type test pins them (plus signup and password reset) to the spec.

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
