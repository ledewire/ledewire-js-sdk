# SDK method coverage against the SDK's own spec

Resolves ledewire/ledewire-js-sdk#69 (parent map #67). Read-only audit of `main` at `6d2da04`.
Reference is the SDK's own `ledewire.yml` (116 operations) and `packages/core/src/api.gen.ts`, not
the API's current spec (that diff is #68).

Method: a script (python3, `yaml`) extracted every `http.get/post/put/patch/delete(<T>)(path)` call in
`packages/{core,node,browser,x402-client}/src` (non-test), normalised `${...}` to `{}`, and matched
method+path against the spec's operations. A second pass compared each call's generic response type
(resolved through the aliases in `packages/core/src/types.ts`) with the operation's 2xx schema, and
hand-typed request interfaces with the spec's request bodies and query parameters.

## 1. Mismatches: SDK methods vs the SDK's own spec

**No method uses a wrong path or HTTP method.** All 174 extracted calls match a spec operation.
Query parameters match too (`topics[]`, `page`/`per_page`, `from`/`to`/`cursor`/`limit`, `member`/`kind`,
`user_id`, `content_id`, `limit`/`offset`), and so do request-body field names and required fields in the
hand-typed request interfaces. What does diverge:

| # | Finding | Package(s) | Covered by |
|---|---|---|---|
| M1 | `PurchaseCreateRequest` has no `required` list in the spec, so `purchases.create({ content_id })` type-checks but the API refuses it (needs `price_cents`). The SDK matches its spec; the spec is wrong. | core types; node, browser `purchases.create` | **#64** |
| M2 | Exported `ContentSearchRequest` (node `resources/seller/content.ts`, `index.ts:157`) is the *seller* shape, while `content.search` takes `BuyerContentSearchRequest` (= `Partial<ContentSearchRequest schema>`). Browser exports a third copy, `SellerContentSearchRequest`. Same shape is also hand-typed as `MerchantContentSearchRequest`. | node, browser | **#62** (names); the three-way duplication is not mentioned |
| M3 | `content.getWithAccess` is typed `ContentWithAccessResponse` (a component schema with `allOf ContentResponse + access_info`), but the operation's inline 200 schema in the same `ledewire.yml` is `{content, access:{has_full_access,next_required_action,paywall_position}}`. The spec contradicts itself; the SDK follows the component. Node also keeps the `userId` param (spec: `user_id` query) and, unlike browser, does **not** run `decodeContentFields` or `encodeURIComponent(id)` (`node/src/resources/content.ts:42-53` vs `browser/src/resources/content.ts:42-47`). | node, browser | **#65** (drop `userId`, regenerate types). Decode and encode gaps are **not covered** |
| M4 | Two more operations whose inline 200 schema differs from the component the SDK returns: `GET /v1/checkout/state/{content_id}` (inline has no required fields, no `content_title`/`price_cents`; component has them) and `GET /v1/wallet/payment-status/{session_id}` (inline status enum `pending/succeeded/completed/failed/canceled`, component `pending/awaiting_verification/processing/completed/failed/cancelled`; `balance_cents` nullable only in the component). `api.gen.ts` types the operation from the inline schema, so `operations['...']` and the SDK's exported type disagree. | node, browser (`checkout.state`, `wallet.paymentStatus`) | **not covered** |
| M5 | Node `seller.content.*` calls `/v1/merchant/{storeId}/content...` (needs a `storeId`, same endpoints as `merchant.content`), not the spec's `/v1/seller/content...`. `SellerContentNamespace` is a duplicate of `MerchantContentNamespace` that misdescribes itself as API-key `/v1/seller`. Browser `seller.content` does call `/v1/seller/content` (3 of 6 ops). | node, browser | **not covered**; falls under #71 (seller retirement) |
| M6 | Hand-typed duplicates of spec schemas with no drift guard. All match today, but will drift silently: `AuthPasswordResetRequestBody/Body/Response`, `MerchantPasswordReset*` (response duplicates `MessageResponse`), `MerchantDomainAddRequest/VerifyRequest/VerifyResponse`, `MerchantPricingRuleCreateRequest`, `MerchantUserUpdateRequest`, `AcquisitionCreateRequest`, `StoreConfig`, `PublicationListParams`, `PublicationWorksParams`, `AcquisitionWorksParams`, `X402DiscoveryParams`, `Company*Params`. `core/token-manager.ts:190` (`createRefreshFn`) also hand-types the `/v1/auth/token/refresh` response instead of `AuthenticationResponse` (drops `token_type`, `invitations`). `Content` (create union) is hand-written with a drift guard and a TODO to alias the generated type. | core, node | **not covered** (only the `Content` TODO exists in-code) |
| M7 | `@ledewire/x402-client` has no generated types: `LedewirePaymentRequired`, `LedewirePaymentRequirements`, `LedewireWalletExtra/Extension/Payload`, `LedewireSettlementResponse`, `LedewirePaymentRefusal` are hand-typed. The spec describes the `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE` headers only as prose, so there is nothing to diff against. Its login (`auth.ts`, `/v1/auth/login/buyer-api-key`) is a raw `fetch`, bypassing core's `HttpClient`. | x402-client | **not covered** |
| M8 | `merchant.users.invite` interpolates `storeId` unencoded (`merchant/users.ts:82`); every sibling method uses `encodeURIComponent`. Minor. | node | **not covered** |
| M9 | `/v1/seller/{buyers,config,sales,sales/summary}` are wrapped (`node/src/resources/seller/`) and exist in the SDK's spec, but those endpoints were retired in the API. | node | tracked as **#71** |

Note M3/M4: the spec-internal contradiction means regenerating `api.gen.ts` (#68) will not by itself fix
the SDK's exported types, since `types.ts` aliases the *component* schemas and the operation types come
from the inline ones.

## 2. Spec operations with no SDK method

Per package, of the 116 operations. Browser is buyer-only by design (#53), so merchant, seller and
acquisition ops missing from browser are **not** listed as gaps.

**Missing from `@ledewire/node` (so missing everywhere except where noted):**

| Operation | Notes |
|---|---|
| `POST /v1/seller/content`, `PATCH /v1/seller/content/{id}`, `DELETE /v1/seller/content/{id}` | No wrapper in any package. Retired API surface, fold into #71. |
| `GET /v1/seller/content`, `POST /v1/seller/content/search`, `GET /v1/seller/content/{id}` | Browser only (`seller.content`); node's `seller.content` hits `/v1/merchant` instead (M5). #71. |
| `GET /v1/x402/contents/{id}` | Reached through `@ledewire/x402-client` adapters (the 402 / `PAYMENT-SIGNATURE` flow), never as a node or browser method. Plausibly intentional. |
| `GET /v1/x402/verify-origin` (query `url`, required) | No wrapper anywhere. Candidate for a node merchant method, decide in a build ticket. |
| `GET /.well-known/x402-jwks.json` | No wrapper. Needed to verify the settlement `accessToken` offline; the SDK has a signing-keys method (`/.well-known/ledewire-signing-keys.json`) but not this one. |
| `POST /v1/auth/token/refresh` | Only an internal `fetch` in core (`createRefreshFn`); no public method. Probably fine. |
| `POST /v1/wallet/payment-webhook`, `POST /v1/webhooks/payment` | Server-to-server Stripe webhooks. Intentionally unwrapped. |
| `POST /ahoy/events`, `POST /ahoy/visits` | Analytics beacons. Intentionally unwrapped. |
| `GET /.well-known/oauth-authorization-server`, `POST /oauth/register`, `POST /v1/mcp` | Protocol endpoints, out of scope per map #67. |

Everything else in the spec is wrapped in node, including all `/v1/merchant/{store_id}/*`,
`/v1/company/*` (machine users, buyer keys, MCP keys included), acquisitions (incl. `corpus/download`,
`manifest`), publications, topics, `purchase/verify`, `/v1/x402/discovery/resources` and the signing-keys
history. Browser lacks, beyond the intentional merchant/seller/acquisition set: `/v1/content/search`,
`/v1/publications*`, `/v1/topics`, `/v1/x402/discovery/resources`, which is exactly the parity question
in **#53** (open, awaiting a human decision), not a new gap.

## 3. Cross-reference to open SDK issues

| Issue | Relationship to this audit |
|---|---|
| #53 browser parity | Covers every browser-side omission above (publications, topics, search, acquisitions, x402 discovery). |
| #61 typed 429 / 422 errors | No spec mismatch; error-class gap only. Not a method-coverage finding. |
| #62 `ContentSearchRequest` naming | Covers M2 (names). |
| #63 `content_body` format docs | Spec description gap on `PurchaseResponse`/`ContentResponse`; not a method mismatch. |
| #64 `price_cents` required | Covers M1. |
| #65 `getWithAccess` buyer-only | Covers part of M3 (drop `userId`, types). Not the missing decode/encode, nor M4. |
| #66 login 401 handling | Behavioural; no spec mismatch. Not a coverage finding. |

Not covered by any open issue: M3 (decode/encode), M4, M5 (beyond #71), M6, M7, M8, and the unwrapped
ops `x402/verify-origin` and `x402-jwks.json`.
