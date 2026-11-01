# API spec drift since the SDK's 2026-10-21 copy

Resolves ledewire/ledewire-js-sdk#68 (parent map #67). Researched 2026-11-01.

## Sources and method

- **Reference:** `ledewire/api` `docs/api/v1/ledewire.yml` (123 operations, 159 schemas; identical on `main` and `staging`).
- **SDK copy:** `ledewire.yml` at SDK `origin/main` (116 operations, 151 schemas), last synced 2026-10-21.
- **Attribution:** `git log --since=2026-10-20 -- docs/api/v1/ledewire.yml` in `ledewire/api` (69 commits), plus `git log -S` pickaxe per token. Commits are cited by short SHA (all on API `staging`; only #1484 has a merge commit in range).
- **Method:** both files parsed with PyYAML. For every operation and component schema, `description`, `summary`, `title` (when a string annotation, not a property name), `example` and `examples` were stripped, then the remainder diffed structurally. `$ref`s were not resolved, so a changed shape behind a `$ref` shows up as a changed schema, and an inline-to-`$ref` swap shows up on the operation.
- **Not verified:** wire behaviour. Classes below follow the spec and the API commit messages, not a live call.

### Classes

| Class | Meaning |
| --- | --- |
| **doc-only** | No machine-readable shape change (text, examples only) |
| **additive** | New op, optional field or param, new response code, widened response enum, new header |
| **breaking** | Removed, renamed, retyped, newly required, enum narrowed, or a wire behaviour change |
| **breaking (types)** | The spec changed in a way that breaks generated types or callers, but the commit says the wire is unchanged (the spec was wrong and is now corrected) |

"Additive*" marks a widened **response** enum: wire-compatible, but exhaustive `switch` code on the old values stops being exhaustive.

## Totals

| | Count |
| --- | --- |
| Operations added | 11 (8 protocol, see below; 3 SDK-relevant) |
| Operations removed | 4 (`/v1/seller/{sales,sales/summary,buyers,config}`) |
| Shared operations | 112; 100 differ textually, **73 differ in shape**, 39 are doc-only (112 minus 73) |
| Schemas added | 12 (7 protocol or OAuth/MCP, 5 SDK-relevant) |
| Schemas removed | 4 (`AhoyVisit`, `JWTClaims`, `MonthlyData`, `User`; unreferenced, nothing in `packages/*/src` uses them) |
| Shared schemas | 147; 55 differ textually, **35 differ in shape**, 20 are doc-only |

Of the 73 shape-changed operations, roughly 45 differ **only** by added error responses (401/403/409/422/429 + `Retry-After`) or `security` markers. Those are additive and listed in one row each. The rest are enumerated per area.

## Protocol endpoints (out of scope, noted only)

Added in the API, all from `8a5faf7b` (OAuth, "document eight routed operations") and the MCP transport work `afae8207`/`d59d972a`:

`GET|POST /oauth/authorize`, `POST /oauth/authorize/google`, `POST /oauth/token`, `POST /oauth/revoke`, `GET /.well-known/oauth-protected-resource/v1/mcp`, `GET /v1/mcp`, `DELETE /v1/mcp` (the last two answer 405). New schemas: `OauthTokenRequest`, `OauthTokenResponse`, `OauthTokenErrorResponse`, `OauthAuthorizeErrorResponse`, `OauthRevokeRequest`, `OauthProtectedResourceMetadata`, `OauthTooManyRequestsResponse`, `McpJsonRpcResponse`.

Changes to existing protocol ops and schemas, also noted only: `POST /v1/mcp` (additive: now a typed `McpJsonRpcResponse`, new 400/404/406/413/415/429 codes; breaking for MCP clients: 401 carries only `invalid_token`, 403 is `insufficient_scope` with `WWW-Authenticate`, per `d59d972a`; request body no longer allows a batch array in the spec); `McpJsonRpcRequest.method` gains `server/discover` (`afae8207`, `1fd1aa6d`); `OauthAuthorizationServerMetadata.authorization_response_iss_parameter_supported` added (`ddb1d4fe`); `OauthClientRegistrationRequest` gains length and count bounds on URIs, contacts and software fields (tightening; no commit pinned, doc reconciliation inside `8a5faf7b`); `POST /oauth/register` documents 429 + `Retry-After`; `/oauth/token` refresh failures answer **400 `invalid_grant`, not 401** (`8a5faf7b`, breaking for any hand-rolled OAuth client).

## Breaking changes, by area

### Auth

| Change | Class | Commit |
| --- | --- | --- |
| `POST /v1/auth/login/email`, `/v1/auth/merchant/login/email`, `/v1/auth/login/api-key`: wrong credentials now **401, not 404** (`/login/buyer-api-key` already did). `/merchant/login/email` loses its documented 404, gains 401 | breaking (wire) | `727c0559` (refs api#1416) |
| `POST /v1/auth/login/google` and `/merchant/login/google`: documented 401 and 503 removed; **every token problem answers 400** (merchant contract also gains a JWT-shape rule) | breaking (wire) | `8a5faf7b` |
| `POST /v1/auth/token/refresh` 200 is now `anyOf [AuthenticationResponse, MerchantAuthenticationResponse]` (was `AuthenticationResponse`); documents 400/401/403 | breaking (types) | `749ff751`, `8a5faf7b` |
| `POST /v1/auth/signup`: success is **201** (spec said 200); `name` no longer required; new 400/409; `password` 6-72 chars, `name` min length 1 | breaking (types) for the response code; `name` optional is additive | `8a5faf7b` |
| `POST /v1/auth/password/reset` and `/reset-request` 200 is flat `MessageResponse {message}` (was `{data:{message}}`). `password` min length 6, `reset_code` pattern `^\d{6}$` (also on merchant reset) | breaking (types) | `8a5faf7b` |
| `AuthLoginEmailRequest` (`email`,`password`), `AuthLoginOAuthRequest` (`id_token`), `AuthTokenRefreshRequest` (`refresh_token`) now declare `required` | breaking (types) (previously all-optional in generated types) | `8a5faf7b` |
| All public auth ops (`login/*`, `signup`, `token/refresh`, password reset, merchant equivalents) are now `security: []`; 429s carry `Retry-After` (`AuthRetryAfter` header, new) | additive | `8a5faf7b` |
| `GET /v1/auth/invite-info/{token}` (new; 200 `InviteInfoResponse`, 404/409/410), `POST /v1/auth/merchant/accept-invitation` (new; bearer-authed; 200 `MerchantInvitationAcceptedResponse`, 400/401/403/404/409/410/422 with `InvitationNotAcceptedError`) | additive (new ops/schemas) | `8a5faf7b` |
| `GET /v1/config/public` and `/v1/merchant/{store_id}/config` (`PublicConfigResponse`): `google_client_id` is `string|null`, now required on the merchant response. `/v1/seller/config` **removed**, replaced by `/v1/merchant/{store_id}/config` | breaking (types); removal is breaking (wire) | `8a5faf7b`, `328964b3` |
| `GET|POST /v1/user/api-keys`, `UserApiKeyCreateRequest`: `spending_limit_cents` min 1 / max 2147483647, nullable; `name` min length 1; new 400/401/403/422 responses | additive (documented) with tightened bounds | `65cff2a9`, `6bd9a718` |

### Buyer content and purchases

| Change | Class | Commit |
| --- | --- | --- |
| `GET /v1/content/{id}/with-access`: `user_id` query param **removed** and ignored; **every store credential is refused with 403**; auth is Buyer token or none (`security: [{}, BearerAuth]`) | breaking (wire). `packages/node/src/resources/content.ts:48` still sends `user_id` | `85f7e830`, `dc6977c4`, `18e842d6` |
| `ContentWithAccessResponse` no longer `allOf ContentResponse`: now a closed object (`additionalProperties: false`) of `id, content_type, title, teaser, price_cents, visibility (public only), resource_url, access_info`. `content_body`, `content_uri`, `external_identifier`, `metadata` are gone; `title` and `resource_url` nullable | breaking (types and wire) | `d43b2b0e`, `85f7e830` |
| `GET /v1/checkout/state/{content_id}`: inline schema replaced by `CheckoutStateResponse`; `content_title` is `string|null`; also optional auth, new 401/403 | breaking (types) minor, additive otherwise | `65cff2a9`, `85f7e830` |
| `GET /v1/seller/content`, `POST /v1/seller/content/search` list items are `ContentListItem`, not `ContentResponse` (drops `content_body`, `metadata`; `teaser` nullable; `created_at` and `content_uri` required) | breaking (types) | `d43b2b0e` |
| All `/v1/seller/content*` ops `deprecated: true` with `Deprecation`, `Sunset: 2026-09-01` and `Link` headers (routes still serve past that date). Replacement is `/v1/merchant/{store_id}/content` | additive (deprecation), removal is the next break | `d43b2b0e` |
| `ContentSearchRequest` gains `cik`, `ticker`, `form_type`, `publication` filters | additive | `301d2d8a`, `c380df3e`, `09f342d7` |
| `ContentSearchResult.filing` (new `ContentSearchFiling`) and `PurchaseResponse.content.filing`, both nullable but now in `required` | additive (response) | `0a8982b6`, `f6365039`, `8d6c1806` (DEFR14A in `form_type`) |
| `PurchaseResponse.license` (new `PurchaseLicense`, nullable, in `required`); `content.publication` typed as `PurchasePublication {id,name}` (same shape) | additive | `b9ccd003`, `3a816bf9` |
| `McpPurchaseReceipt` gains `publication` and `license`; `McpFullContent.license` now `PurchaseLicense` (same shape) | additive | `3a816bf9`, `b9ccd003` |
| `GET /v1/purchases/{id}/license_document` (new; PDF, markdown or octet-stream; 401/403/404) | additive | `b9ccd003` |
| `POST /v1/purchases`: 422 is `anyOf [InsufficientFundsError, ErrorResponse]` (was `oneOf`); `PurchaseCreateRequest` now requires `content_id`, `price_cents` | breaking (types) minor | `f94da7eb`, `65cff2a9` |
| `GET /v1/purchase/verify`: documented 404 removed | doc-only | `65cff2a9` |
| `ErrorResponse.error.type` enum gains `not_subscribed`, `selection_too_large`, `selection_value_too_large` | additive* | `7a542eb9`, `75f3bcef`, `799a5d61` |

### Merchant and seller

| Change | Class | Commit |
| --- | --- | --- |
| `GET /v1/seller/sales`, `/sales/summary`, `/buyers` **removed**. Use `/v1/merchant/{store_id}/sales`, `/sales/summary`, `/buyers`. `@ledewire/node` `resources/seller/{sales,buyers}.ts` (and `config.ts`) call dead routes | breaking (wire) | `00533ee5` (refs api#1413) |
| `GET /v1/seller/config` **removed**; use `/v1/merchant/{store_id}/config` | breaking (wire) | `8a5faf7b` |
| `MerchantSaleResponse`: `buyer_id` and `buyer {id,name}` **removed**, `buyer_ref` (`^bref_v1_[0-9a-f]{22}$`) added and required; `fees.*_cents` nullable | breaking (wire) | `3b8bcc51` |
| `POST /v1/merchant/{store_id}/users`: bogus 200 removed (201 stays); new 401/403/409 | doc-only | `328964b3` |
| `POST /v1/merchant/{store_id}/pricing_rules`: `price_cents` max 2147483647 | additive (tightened) | `6bd9a718` |
| Merchant content, sales, buyers, domains: new 400/401/403/422 documented | additive (documented) | `328964b3`, `e21272b6`, `c39ad3cd` |
| Merchant content writes and member admin require a **full** API key (permission rule) | breaking (wire) for `view`-permission keys; spec text only | `e21272b6`, `c39ad3cd` |
| Invitation flow: see Auth (`invite-info`, `accept-invitation`). `InviteInfoResponse.invited_email` is `string|null` | additive | `8a5faf7b` |
| Ahoy: `POST /ahoy/events` answers `{}`, array or `{events:[...]}` accepted, `name` required on a single event; `POST /ahoy/visits` body optional, 200 returns `visit_token`, `visitor_token`, `visit_id`, `visitor_id` (was `{success}`), refusals are `text/plain`, 413 added, `Ahoy-Visit`/`Ahoy-Visitor` headers; `AhoyVisitRequest` drops server-derived fields; `AhoyEvent` drops `user_id`, `visit_id` | breaking (types) | `00533ee5`, `bd5e7b4b` |

### Company

| Change | Class | Commit |
| --- | --- | --- |
| `GET /v1/company/purchases` gains `limit` query param | additive | `fc512f81` |
| `DELETE /v1/company/members/{id}` 409; `DELETE|GET /v1/company/membership` 403; `POST /v1/company/invitations/accept` 403 `InvitationNotAcceptedError` | additive (documented) | `fc512f81`, `c3d481ca`, `39aeedbe` |
| `CompanyMemberRoleRequest`: `minProperties: 1` replaced by `anyOf [{required:[role]},{required:[daily_spend_limit_cents]}]` | breaking (types) minor (stricter than before) | `fc512f81` |
| `UserSpendCapUpdateRequest.daily_spend_limit_cents` max 2147483647 | additive (tightened) | `6bd9a718` |
| `GET /v1/user/spend-cap` 403 | additive | `fc512f81` |

### Acquisitions and publications

| Change | Class | Commit |
| --- | --- | --- |
| Every `/v1/acquisitions*` route documents 403 (Invalid Role); Company admins can reach the corpus routes | additive (documented) | `799a5d61` |
| `AcquisitionResponse.exclusions[].reason` and `AcquisitionWork.exclusion_reason` gain `excluded_not_sold_in_bulk` | additive* | `5535bf64` |
| `CorpusResponse.state` gains `not_ready`, `nothing_purchased` (a corpus that bought nothing is no longer `rebuild_required`) | additive* (behaviour shift on `rebuild_required`) | `799a5d61`, `e8b424df` |
| `GET /v1/publications`, `/v1/publications/{id}`: optional Buyer auth (`security: [{}, BearerAuth]`) so subscribed Buyers see SEC EDGAR; new 401/403; `limit` param, `page` min 1, `per_page` default 25 / 1-100 | additive | `dda2455b` |
| `Publication.homepage` (`{title,description,site_name,language}|null`) added and in `required` | additive (response) | `06981443` (2026-10-20, before the sync date but not in the SDK's copy) |

### Wallet and checkout

| Change | Class | Commit |
| --- | --- | --- |
| `GET /v1/wallet/payment-status/{session_id}`: inline schema (`succeeded`, `canceled`, integer balance) replaced by `WalletPaymentStatusResponse`. The SDK copy's inline status enum was wrong; the named schema's enum now also has `reverted`; `balance_cents` nullable | breaking (types) for anything on the inline enum; named schema change is additive* | `65cff2a9` |
| `POST /v1/wallet/payment-session`: `amount_cents` 1-2147483647, `currency` `^[uU][sS][dD]$`, `metadata` max 20 properties, key max 40, values scalar max 500; 402 documented | additive (tightened) | `65cff2a9`, `6bd9a718` |
| `POST /v1/wallet/payment-webhook` and `/v1/webhooks/payment`: body is `PaymentWebhookEvent`; `Stripe-Signature` header required; 200 `{received:true}`; 401/403 removed, 400 and 500 added | breaking (types); server-to-server only | `65cff2a9`, `8a5faf7b` |
| `GET /v1/wallet/transactions` 403 | additive | `65cff2a9` |

### x402

| Change | Class | Commit |
| --- | --- | --- |
| `GET /v1/x402/contents/{id}`: `Authorization` header param removed (security scheme covers it); `PAYMENT-RESPONSE` header documented as base64 `SettlementResponse`; 422 `oneOf`→`anyOf`; 429 `Retry-After` | breaking (types) minor, otherwise additive | `d43b2b0e` |
| `SettlementResponse.accessToken` narrowed from `string|null` to `string` | breaking (types) for callers that handled null (a safe narrowing for readers) | `d43b2b0e` |
| `X402ContentResponse.license` added (`PurchaseLicense|null`, optional) | additive | `b9ccd003` |
| `X402BazaarResource.metadata.title` widened from `string` to `string|null` | breaking (types) | `d43b2b0e` |
| `GET /v1/x402/discovery/resources`: `limit` max 100 dropped from the spec, `offset` max 1000000 added, 400, `security: []` | additive (tightened/clarified) | `c0b7cbcb` |
| `GET /v1/x402/verify-origin`: optional `store_id` query, 429 `Retry-After` | additive | `d43b2b0e` |
| `GET /.well-known/x402-jwks.json` 503 body is `{error: "JWKS unavailable"}` rather than `ErrorResponse`; `GET /.well-known/ledewire-signing-keys.json` gains `ETag` and 304 | breaking (types) minor; additive | `00533ee5`, `ed7d55ec` |

### Errors (cross-cutting)

- About 45 shape-changed ops only gain documented `ErrorResponse` responses (401, 403, 409, 422, 400) or lose a `default`. Additive. Generated clients that branched on `default` lose that branch for auth, user-keys and wallet routes (`65cff2a9`, `8a5faf7b`).
- `ErrorResponse.error.type` enum: **+** `not_subscribed`, `selection_too_large`, `selection_value_too_large`; nothing removed (additive*).
- `/v1` unhandled exceptions now render as `ErrorResponse` (or JSON-RPC on MCP): `553a4e46`, `6ea083b1` (behaviour; not in the spec diff).
- Deleted-user tokens now answer 401 (`87792cab`); an invitation revoke by a non-admin is refused before lookup (`c3d481ca`). Behaviour only.
- `Retry-After` is now a typed header (`AuthRetryAfter`, `minimum: 1`) on auth 429s, plus an untyped one on x402 and MCP 429s. The SDK already has `retry-after.test.ts` in `packages/node`.

### Other

- New `components.headers`: `AuthRetryAfter`, `SellerContentDeprecation`, `SellerContentSunset`, `SellerContentSuccessor` (additive).
- Removed unreferenced schemas `JWTClaims`, `MonthlyData`, `User` (`ed7d55ec`) and `AhoyVisit` (`00533ee5`). Not used by any SDK source (only present in `api.gen.ts`), so regeneration is the whole fix.

## Breaking changes at a glance (wire)

1. **Auth:** wrong credentials on email, merchant-email and api-key login are now 401, not 404 (`727c0559`). Google login answers 400 for every token problem (`8a5faf7b`). `/oauth/token` refresh failure is 400 (`8a5faf7b`).
2. **Buyer content:** `with-access` drops `user_id`, refuses store credentials with 403, and returns a closed, smaller shape (`85f7e830`, `d43b2b0e`).
3. **Merchant/seller:** `/v1/seller/{sales,sales/summary,buyers,config}` are gone (`00533ee5`, `8a5faf7b`). `MerchantSaleResponse` swaps `buyer_id` and `buyer` for `buyer_ref` (`3b8bcc51`). Merchant content writes need a full key (`e21272b6`).
4. **Seller content:** `/v1/seller/content*` is deprecated (sunset date already past, still served); list items become `ContentListItem` (`d43b2b0e`).
5. **Company, acquisitions, wallet, x402:** no wire breaks; type-level changes only (see tables). The `X402ContentResponse` / `X402BazaarResource` shapes the map asked about: `X402ContentResponse` only **gains** optional `license`; `X402BazaarResource.metadata.title` becomes nullable; `SettlementResponse.accessToken` narrows to non-null.

## Doc-only

The remaining 39 shared operations and 20 shared schemas differ only in `description`, `summary`, `title` or `example` text (for example the `document_url` "deprecated" wording reversed in `891f4cd9`, search cursor text in `35622e48`, MCP error text in `1fd1aa6d`). No action beyond re-syncing `ledewire.yml`.

## Reproduce

Two small PyYAML scripts did this: load both files, strip `description`/`summary`/`title`/`example(s)`, then recursively diff each operation and `components.schemas` entry (parameters keyed by `(in, name)`). Operations are keyed by method and path. Run with `python3` (no `jq` on the dev box).
