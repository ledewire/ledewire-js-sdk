/**
 * Core TypeScript types for the LedeWire SDK.
 *
 * API shape types are generated from `ledewire.yml`
 * (run `pnpm --filter @ledewire/core generate:types` to regenerate).
 * SDK-internal types (token storage, stored tokens) are hand-written below.
 *
 * @module
 */
import type { components } from './api.gen.js'

// ---------------------------------------------------------------------------
// Generated API schema type aliases
// ---------------------------------------------------------------------------

/** JWT bearer token response returned by all buyer authentication endpoints. */
export type AuthenticationResponse = components['schemas']['AuthenticationResponse']

/** Token response for merchant (store owner) authentication. */
export type MerchantAuthenticationResponse = components['schemas']['MerchantAuthenticationResponse']

/** Request body for buyer email/password signup. */
export type AuthSignupRequest = components['schemas']['AuthSignupRequest']

/** Request body for buyer email/password login. */
export type AuthLoginEmailRequest = components['schemas']['AuthLoginEmailRequest']

/** Request body for buyer Google OAuth login. */
export type AuthLoginOAuthRequest = components['schemas']['AuthLoginOAuthRequest']

/** Request body for API key authentication (seller). */
export type AuthLoginApiKeyRequest = components['schemas']['AuthLoginApiKeyRequest']

/** Request body for merchant email/password login. */
export type MerchantEmailLoginRequest = components['schemas']['MerchantEmailLoginRequest']

/** Request body for merchant Google OAuth login. */
export type MerchantGoogleLoginRequest = components['schemas']['MerchantGoogleLoginRequest']

/** A store visible to the authenticated merchant user. */
export type ManageableStore = components['schemas']['ManageableStore']

/** A lightweight store entry embedded in the merchant auth response. */
export type MerchantLoginStore = components['schemas']['MerchantLoginStore']

/** A user associated with a merchant store. */
export type MerchantUser = components['schemas']['MerchantUser']

/** Request body for inviting a user to a merchant store. */
// openapi-typescript generates properties with `default:` as required on both
// request and response bodies. For request bodies the correct behaviour is
// optional — the server applies the default when the field is omitted.
// Override here so consumers don't have to supply the field unnecessarily.
export type MerchantInviteRequest = Omit<
  components['schemas']['MerchantInviteRequest'],
  'is_author'
> & { is_author?: boolean }

/** Response from inviting a user to a merchant store. */
export type MerchantInviteResponse = components['schemas']['MerchantInviteResponse']

/** Checkout state for a specific piece of content and user. */
export type ContentAccessInfo = components['schemas']['ContentAccessInfo']

/** The next action a buyer must take in the checkout flow. */
export type NextRequiredAction = ContentAccessInfo['next_required_action']

/** A piece of content with buyer access information. */
export type ContentWithAccessResponse = components['schemas']['ContentWithAccessResponse']

/** A content item in a list response. */
export type ContentListItem = components['schemas']['ContentListItem']

/**
 * Content creation request body — a discriminated union on `content_type`.
 *
 * - `'markdown'` requires `content_body` (plain text markdown — the SDK
 *   encodes it to base64 before transmission).
 * - `'external_ref'` requires `content_uri` (the external resource URL) and
 *   optionally `external_identifier` (namespaced platform ID, e.g. `vimeo:123`).
 * - `'html'` is either inline (`content_body`, plain HTML — the SDK base64-encodes
 *   it before sending) or remote (`content_uri`) — **exactly one of the two**, never
 *   both. The two shapes are modelled as separate union members, each disallowing
 *   the other's field via `?: never`, so passing both is a compile-time error.
 * - `'pdf'`, `'image'`, and `'video'` all require `content_uri` (the SDK never
 *   accepts `content_body` for these types).
 *
 * @remarks
 * This type is intentionally hand-written rather than aliased from
 * `components['schemas']['Content']`. The OpenAPI spec defines `Content` as a
 * flat object (no `oneOf`/`discriminator`), so `openapi-typescript` cannot
 * generate the discriminated union that callers need for type-narrowing.
 *
 * A compile-time assignability guard below (`_ContentDriftGuard`) will produce
 * a TypeScript error if this type drifts from the generated schema.
 *
 * TODO: remove the hand-written union and alias the generated type once
 * `ledewire.yml` uses `oneOf` + `discriminator` for the `Content` schema.
 */
export type Content =
  | {
      /** @discriminator */
      content_type: 'markdown'
      /** Content title. */
      title: string
      /** Full article body in plain text markdown. The SDK base64-encodes this before sending. */
      content_body: string
      /** Optional article teaser in plain text markdown. The SDK base64-encodes this before sending. */
      teaser?: string
      /** Price for the content in cents. */
      price_cents: number
      /** @default public */
      visibility: 'public' | 'unlisted'
      /** Flexible metadata for additional context. */
      metadata?: {
        author?: string
        /** @format date-time */
        publication_date?: string
        /** Estimated read time, e.g. `'5 min'`. Note: the correct key is `reading_time`, not `read_time`. */
        reading_time?: string
        [key: string]: unknown
      }
    }
  | {
      /** @discriminator */
      content_type: 'external_ref'
      /** Content title. */
      title: string
      /** URI of the external resource (Vimeo, YouTube, PDF, etc.). */
      content_uri: string
      /** Optional namespaced platform ID, e.g. `vimeo:123456789`. */
      external_identifier?: string
      /** Optional article teaser in plain text markdown. The SDK base64-encodes this before sending. */
      teaser?: string
      /** Price for the content in cents. */
      price_cents: number
      /** @default public */
      visibility: 'public' | 'unlisted'
      /** Flexible metadata for additional context. */
      metadata?: {
        author?: string
        /** @format date-time */
        publication_date?: string
        /** Estimated read time, e.g. `'5 min'`. Note: the correct key is `reading_time`, not `read_time`. */
        reading_time?: string
        [key: string]: unknown
      }
    }
  | {
      /** @discriminator */
      content_type: 'html'
      /** Content title. */
      title: string
      /** Full HTML body. The SDK base64-encodes this before sending. Mutually exclusive with `content_uri`. */
      content_body: string
      /** Not accepted alongside inline `content_body` — submitting both is rejected with `400`. */
      content_uri?: never
      /** Optional article teaser in plain text markdown. The SDK base64-encodes this before sending. */
      teaser?: string
      /** Price for the content in cents. */
      price_cents: number
      /** @default public */
      visibility: 'public' | 'unlisted'
      /** Flexible metadata for additional context. */
      metadata?: {
        author?: string
        /** @format date-time */
        publication_date?: string
        /** Estimated read time, e.g. `'5 min'`. Note: the correct key is `reading_time`, not `read_time`. */
        reading_time?: string
        [key: string]: unknown
      }
    }
  | {
      /** @discriminator */
      content_type: 'html'
      /** Content title. */
      title: string
      /** URI of the remote HTML resource. Mutually exclusive with `content_body`. */
      content_uri: string
      /** Not accepted alongside remote `content_uri` — submitting both is rejected with `400`. */
      content_body?: never
      /** Optional namespaced platform ID, e.g. `vimeo:123456789`. */
      external_identifier?: string
      /** Optional article teaser in plain text markdown. The SDK base64-encodes this before sending. */
      teaser?: string
      /** Price for the content in cents. */
      price_cents: number
      /** @default public */
      visibility: 'public' | 'unlisted'
      /** Flexible metadata for additional context. */
      metadata?: {
        author?: string
        /** @format date-time */
        publication_date?: string
        /** Estimated read time, e.g. `'5 min'`. Note: the correct key is `reading_time`, not `read_time`. */
        reading_time?: string
        [key: string]: unknown
      }
    }
  | {
      /** @discriminator */
      content_type: 'pdf' | 'image' | 'video'
      /** Content title. */
      title: string
      /** URI of the remote resource. Required — these types are always remote. */
      content_uri: string
      /** Not accepted for `pdf`/`image`/`video` content. */
      content_body?: never
      /** Optional namespaced platform ID, e.g. `vimeo:123456789`. */
      external_identifier?: string
      /** Optional article teaser in plain text markdown. The SDK base64-encodes this before sending. */
      teaser?: string
      /** Price for the content in cents. */
      price_cents: number
      /** @default public */
      visibility: 'public' | 'unlisted'
      /** Flexible metadata for additional context. */
      metadata?: {
        author?: string
        /** @format date-time */
        publication_date?: string
        /** Estimated read time, e.g. `'5 min'`. Note: the correct key is `reading_time`, not `read_time`. */
        reading_time?: string
        [key: string]: unknown
      }
    }

/**
 * Compile-time drift guard for the hand-written `Content` type.
 *
 * Requires `Content` to be assignable to `components['schemas']['Content']`
 * (the generated flat schema). If `ledewire.yml` adds new required fields or
 * narrows enum values, TypeScript will error here before the mismatch can cause
 * a runtime bug. This is the only protection against silent drift until the spec
 * adopts `oneOf`+`discriminator` and `Content` can be generated automatically.
 *
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ContentDriftGuard<_T extends U, U> = never
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ContentSchemaCheck = _ContentDriftGuard<Content, components['schemas']['Content']>

/** Full content item returned by all seller content endpoints. */
export type ContentResponse = components['schemas']['ContentResponse']

/** Request body for updating content. */
export type ContentUpdateRequest = components['schemas']['ContentUpdateRequest']

/** Request body for creating a wallet payment session. */
export type WalletPaymentSessionRequest = components['schemas']['WalletPaymentSessionRequest']

/** Response from creating a wallet payment session. */
export type WalletPaymentSessionResponse = components['schemas']['WalletPaymentSessionResponse']

/** Current wallet balance for the authenticated buyer. */
export type WalletBalanceResponse = components['schemas']['WalletBalanceResponse']

/** Status of a wallet payment session. */
export type WalletPaymentStatusResponse = components['schemas']['WalletPaymentStatusResponse']

/** A single wallet transaction entry. */
export type WalletTransactionItem = components['schemas']['WalletTransactionItem']

/** Request body for creating a purchase. */
export type PurchaseCreateRequest = components['schemas']['PurchaseCreateRequest']

/** A purchase record. */
export type PurchaseResponse = components['schemas']['PurchaseResponse']

/** Full checkout state for a buyer/content pair, including auth and fund status. */
export type CheckoutStateResponse = components['schemas']['CheckoutStateResponse']

/** Purchase verification result. */
export type PurchaseVerifyResponse = components['schemas']['PurchaseVerifyResponse']

/** Sales summary statistics for a store. */
export type SalesSummaryResponse = components['schemas']['SalesSummaryResponse']

/** A single sale record for a merchant store, including platform fee breakdown. */
export type MerchantSaleResponse = components['schemas']['MerchantSaleResponse']

/** Per-content-title sales rollup returned by the merchant sales list endpoint. */
export type SalesStatisticsItem = components['schemas']['SalesStatisticsItem']

/** Buyer statistics item for a merchant store. */
export type BuyerStatisticsItem = components['schemas']['BuyerStatisticsItem']

/** A merchant x402 URL pricing rule. */
export type MerchantPricingRule = components['schemas']['MerchantPricingRule']

/** A merchant domain verification record for x402 URL gating. */
export type MerchantDomainVerification = components['schemas']['MerchantDomainVerification']

/** Request body for authenticating as a buyer using a named API key + secret. */
export type AuthLoginBuyerApiKeyRequest = components['schemas']['AuthLoginBuyerApiKeyRequest']

/** A buyer API key record (secret is never included after creation). */
export type UserApiKey = components['schemas']['UserApiKey']

/** Request body for creating a new buyer API key. */
export type UserApiKeyCreateRequest = components['schemas']['UserApiKeyCreateRequest']

/**
 * Response returned once when a buyer API key is created.
 * The `secret` is shown exactly once and cannot be retrieved again.
 * Store it immediately in a secrets manager.
 */
export type UserApiKeyCreateResponse = components['schemas']['UserApiKeyCreateResponse']

/**
 * Machine-readable reason on an API error envelope, present on refusals that carry one.
 * Branch on this rather than on `message`, which is prose and may be reworded.
 *
 * - `retrieval_failed` — transient; worth retrying.
 * - `not_licensable` — report the work as undelivered.
 * - `price_drifted` — re-quote before retrying.
 * - `client_error` — ours to fix; must never be retried unchanged.
 * - `insufficient_funds` — cleared by funding the wallet.
 * - `daily_spend_cap_reached` — deliberately **not** cleared by funding the wallet; see
 *   {@link SpendCapReachedError}.
 *
 * On the bulk acquisition steps:
 *
 * - `exclusions_unacknowledged` — call `acquisitions.acknowledgeExclusions()` first.
 * - `quote_not_ready` — keep polling a `pending` quote, or re-quote a `failed` one
 *   (`quote_state` says which).
 * - `quote_expired` — re-quote.
 * - `quote_in_progress` — wait for the re-quote already running.
 * - `invalid_acquisition_state` — re-read the acquisition; `status` and
 *   `expected_status` arrive in `LedewireError.details`.
 * - `nothing_to_hold` — every work was excluded; a different Selection is needed.
 * - `run_not_started` — the run could not be queued, so nothing was held and the same
 *   authorization is safe to retry.
 */
export type ErrorType = NonNullable<components['schemas']['ErrorResponse']['error']['type']>

/** The `ErrorResponse` schema — an API error envelope `{ error: { code, message, type? } }`. */
export type ErrorResponse = components['schemas']['ErrorResponse']

/**
 * The authenticated buyer's daily spend cap, read against the current spend window.
 * The cap governs every wallet debit the buyer makes — MCP, REST, or the web payment
 * gate — and spend is derived from completed purchases, so a refund returns allowance.
 *
 * `cap_cents`, `spent_cents`, `remaining_cents` and `resets_at` are spelled exactly as
 * they are in {@link DailySpendCapReachedErrorBody}, so a refusal and this resource
 * describe the same numbers.
 */
export type UserSpendCap = components['schemas']['UserSpendCap']

/**
 * Request body for `PATCH /v1/user/spend-cap`. `daily_spend_limit_cents` is required
 * and nullable: `null` is how a buyer becomes uncapped, and an omitted field is a
 * client error rather than a request to be uncapped.
 */
export type UserSpendCapUpdateRequest = components['schemas']['UserSpendCapUpdateRequest']

/** An MCP API key record (secret is never included after creation). */
export type McpApiKey = components['schemas']['McpApiKey']

/** Request body for creating a new MCP API key. */
export type McpApiKeyCreateRequest = components['schemas']['McpApiKeyCreateRequest']

/**
 * Response returned once when an MCP API key is created.
 * The `secret` is shown exactly once and cannot be retrieved again.
 */
export type McpApiKeyCreateResponse = components['schemas']['McpApiKeyCreateResponse']

/**
 * A Publication a buyer can license from in bulk — the title a Bulk acquisition is
 * organised around. Listed from LedeWire's own registry, reconciled daily against the
 * broker's directory, rather than from a live call.
 */
export type Publication = components['schemas']['Publication']

/** Every {@link Publication} the broker reports as ready to license, paginated. */
export type PublicationListResponse = components['schemas']['PublicationListResponse']

/**
 * A work a {@link Publication} has available to license, as the broker's catalog lists
 * it. `url` is exactly what an acquisition Selection takes.
 */
export type PublicationWork = components['schemas']['PublicationWork']

/**
 * One page of a Publication's works, read live from the broker's catalog. Unpriced —
 * pricing happens when a Selection of these URLs is quoted.
 */
export type PublicationWorkListResponse = components['schemas']['PublicationWorkListResponse']

/**
 * Query parameters accepted by `GET /v1/publications/{id}/works`.
 * `from`/`to` are inclusive dates (`YYYY-MM-DD`); `cursor` is the previous page's
 * `next_cursor`, sent back with the same `from`/`to`; `limit` defaults to the maximum
 * (1000).
 */
export interface PublicationWorksParams {
  /** Earliest modification date, inclusive, as `YYYY-MM-DD`. */
  from?: string
  /** Latest modification date, inclusive, as `YYYY-MM-DD`. */
  to?: string
  /** The previous page's `next_cursor`, sent with the same `from`/`to`. */
  cursor?: string
  /** Works per page. Maximum 1000. Defaults to the maximum. */
  limit?: number
  [key: string]: string | number | undefined
}

/**
 * A Bulk acquisition — the resource the whole bulk-licensing flow hangs off. The
 * buyer holds this id from the moment they submit a Selection, and every later step
 * reads or advances it: the quote arrives on it, the acknowledgement is a timestamp
 * on it, the hold is sized from its total, and the run writes its outcome back to it.
 */
export type AcquisitionResponse = components['schemas']['AcquisitionResponse']

/** The priced Selection of an {@link AcquisitionResponse}, and the promise made about it. */
export type AcquisitionQuote = components['schemas']['AcquisitionQuote']

/**
 * One work in an acquisition's Selection, and what happened to it. Every submitted
 * row appears, including the ones LedeWire refused.
 */
export type AcquisitionWork = components['schemas']['AcquisitionWork']

/** Per-work dispositions for a Bulk acquisition, paginated. */
export type PaginatedAcquisitionWorkList = components['schemas']['PaginatedAcquisitionWorkList']

/**
 * Query parameters accepted by `GET /v1/acquisitions/{acquisition_id}/works`:
 * pagination plus optional filters. Filters combine with AND, and
 * `pagination.total` counts only the matching works.
 */
export interface AcquisitionWorksParams {
  /** Page number (1-based). Defaults to 1. */
  page?: number
  /** Items per page. Maximum 100. Defaults to 25. */
  per_page?: number
  /** Only works in this delivery state, e.g. `'undelivered'` to list what failed. */
  delivery_state?: AcquisitionWork['delivery_state']
  /** Only lines in this pricing state, e.g. `'excluded'`. */
  line_state?: AcquisitionWork['line_state']
  /** Only excluded lines refused for this reason. */
  exclusion_reason?: NonNullable<AcquisitionWork['exclusion_reason']>
  [key: string]: string | number | undefined
}

/**
 * Where a Bulk acquisition's Corpus is — a state, never an error. A corpus is a
 * rendering of purchases the buyer already holds, not an entitlement of its own, so
 * it can be discarded and rebuilt at no cost to the buyer.
 */
export type CorpusResponse = components['schemas']['CorpusResponse']

/**
 * The signed Manifest of a Bulk acquisition — the audit record itself, not a summary
 * of one. Permanent: it does not expire the way the corpus blob does.
 */
export type CorpusManifestResponse = components['schemas']['CorpusManifestResponse']

/**
 * The append-only, hash-chained log of every Ed25519 key that has signed an
 * audit-export manifest. The trust anchor a verifier resolves a manifest's `kid`
 * through. Served from the public `GET /.well-known/ledewire-signing-keys.json`.
 */
export type SigningKeyHistoryResponse = components['schemas']['SigningKeyHistoryResponse']

/** A single x402 v2 resource entry returned by the Bazaar discovery endpoint. */
export type X402BazaarResource = components['schemas']['X402BazaarResource']

/** Response from the public x402 Bazaar discovery endpoint (`GET /v1/x402/discovery/resources`). */
export type X402BazaarDiscoveryResponse = components['schemas']['X402BazaarDiscoveryResponse']

/**
 * Query parameters accepted by `GET /v1/x402/discovery/resources`.
 */
export interface X402DiscoveryParams {
  /** Number of resources to return (max 100). */
  limit?: number
  /** Zero-based offset for pagination. */
  offset?: number
  [key: string]: number | undefined
}

/**
 * The REST and x402 web-gate form of a daily-spend-cap refusal, returned with HTTP
 * `402 Payment Required` by `POST /v1/purchases`, `GET /v1/x402/contents/{id}`, and
 * acquisition authorization. This is the raw wire shape; the SDK throws it as
 * {@link SpendCapReachedError} rather than handing back the JSON body directly.
 */
export type DailySpendCapReachedErrorBody = components['schemas']['DailySpendCapReachedError']

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

/** A Company membership role. Only an `admin` can manage the Company. */
export type CompanyRole = CompanyMembership['role']

/**
 * The authenticated buyer's own open Company membership. Names the Company but
 * never its balance: a member sees only what they may still spend.
 */
export type CompanyMembership = components['schemas']['CompanyMembership']

/**
 * A pending invitation to join a Company. Joining always waits for the invitee
 * to accept, because it moves their spending onto the Company wallet. Never
 * carries the acceptance token, which reaches only the invited address.
 */
export type CompanyInvitation = components['schemas']['CompanyInvitation']

/** The Company's pending invitations. */
export type CompanyInvitationList = components['schemas']['CompanyInvitationList']

/** Request body for inviting someone to the Company. */
// openapi-typescript marks `role` (which has a `default:`) as required; the
// server applies `member` when it is omitted, so make it optional here.
export type CompanyInvitationRequest = Omit<
  components['schemas']['CompanyInvitationRequest'],
  'role'
> & { role?: CompanyRole }

/** Request body for accepting a Company invitation. */
export type CompanyInvitationAcceptRequest = components['schemas']['CompanyInvitationAcceptRequest']

/**
 * An open Company membership as a Company admin sees it. `id` is the membership
 * id the `company.members` methods take — not the member's `user_id`.
 */
export type CompanyMember = components['schemas']['CompanyMember']

/** The Company's open memberships. */
export type CompanyMemberList = components['schemas']['CompanyMemberList']

/**
 * Request body for changing a member's role or daily Spend cap — at least one
 * of the two. `daily_spend_limit_cents` cannot be `null`: a Company member is
 * never uncapped.
 */
export type CompanyMemberUpdateRequest = components['schemas']['CompanyMemberRoleRequest']

/**
 * A Machine user: a Buyer with a name and no email, password or login, owned by
 * a Company and joined as a non-admin member. It authenticates only with the
 * Buyer keys and MCP API keys a Company admin issues it. Deactivation is
 * permanent.
 */
export type CompanyMachineUser = components['schemas']['CompanyMachineUser']

/** The Company's Machine users. */
export type CompanyMachineUserList = components['schemas']['CompanyMachineUserList']

/** Request body for creating a Machine user. */
export type CompanyMachineUserCreateRequest = components['schemas']['CompanyMachineUserRequest']

/**
 * A Machine user's Buyer key (secret never included after creation). It logs in
 * through `auth.loginWithBuyerApiKey()`; its limit is the Machine user's
 * membership Spend cap.
 */
export type CompanyMachineUserBuyerKey = components['schemas']['CompanyMachineUserBuyerKey']

/** A Machine user's Buyer keys, oldest first. */
export type CompanyMachineUserBuyerKeyList = components['schemas']['CompanyMachineUserBuyerKeyList']

/** Request body for creating a Machine user's Buyer key. */
export type CompanyMachineUserBuyerKeyCreateRequest =
  components['schemas']['CompanyMachineUserBuyerKeyRequest']

/**
 * Returned once when a Machine user's Buyer key is created. The `secret` is
 * shown exactly once and cannot be retrieved again.
 */
export type CompanyMachineUserBuyerKeyCreateResponse =
  components['schemas']['CompanyMachineUserBuyerKeyCreateResponse']

/**
 * A Machine user's active MCP API key. Carries buyer scopes only
 * (`mcp:search`, `mcp:purchase`), never a store, and does not expire.
 */
export type CompanyMachineUserMcpKey = components['schemas']['CompanyMachineUserMcpKey']

/** A Machine user's MCP API keys, oldest first. */
export type CompanyMachineUserMcpKeyList = components['schemas']['CompanyMachineUserMcpKeyList']

/** Request body for creating a Machine user's MCP API key. */
export type CompanyMachineUserMcpKeyCreateRequest =
  components['schemas']['CompanyMachineUserMcpKeyRequest']

/**
 * Returned once when a Machine user's MCP API key is created. The `secret` is
 * shown exactly once and cannot be retrieved again.
 */
export type CompanyMachineUserMcpKeyCreateResponse =
  components['schemas']['CompanyMachineUserMcpKeyCreateResponse']

/** A Company wallet top-up that has not settled yet. */
export type CompanyPendingTopUp = components['schemas']['CompanyPendingTopUp']

/** The Company's unsettled top-ups, newest first. */
export type CompanyPendingTopUpList = components['schemas']['CompanyPendingTopUpList']

/**
 * One thing the Company paid for — a purchase or a Bulk acquisition drawn on
 * the Company wallet — attributed to the membership that bought it.
 */
export type CompanyPurchase = components['schemas']['CompanyPurchase']

/**
 * The membership a {@link CompanyPurchase} or spend row is attributed to.
 * Recorded at payment time, so it still names a member who has since left.
 */
export type CompanyPurchaseMember = components['schemas']['CompanyPurchaseMember']

/** Everything the Company paid for, newest first, paginated. */
export type CompanyPurchaseList = components['schemas']['CompanyPurchaseList']

/** What each membership, open or closed, has spent of the Company's money. */
export type CompanySpendList = components['schemas']['CompanySpendList']

/**
 * Filters shared by the Company purchase and spend reports. `from`/`to` are
 * inclusive `YYYY-MM-DD` days read in the Company's timezone.
 */
export interface CompanyReportFilters {
  /** A membership id (`member.id`), open or closed. */
  member?: string
  /** The first day to include, `YYYY-MM-DD`, in the Company's timezone. */
  from?: string
  /** The last day to include, `YYYY-MM-DD`, in the Company's timezone. */
  to?: string
  [key: string]: string | number | undefined
}

/** Query parameters accepted by `GET /v1/company/purchases`. */
export interface CompanyPurchasesParams extends CompanyReportFilters {
  /** Only purchases, or only Bulk acquisitions. Both by default. */
  kind?: CompanyPurchase['kind']
  /** Page number (1-based). Defaults to 1. */
  page?: number
  /** Items per page. Maximum 100. Defaults to 25. */
  per_page?: number
}

/**
 * Query parameters accepted by `GET /v1/company/spend`. Lifetime spend when
 * neither `from` nor `to` is given.
 */
export type CompanySpendParams = CompanyReportFilters

/**
 * Pagination parameters accepted by paginated list endpoints.
 *
 * Pass as the final argument to any `list()` or `search()` method that
 * accepts optional pagination. Omitting either field defers to the server
 * default (page 1, 25 items per page).
 */
export interface PaginationParams {
  /** Page number (1-based). Defaults to 1. */
  page?: number
  /** Items per page. Maximum 100. Defaults to 25. */
  per_page?: number
  [key: string]: number | undefined
}

/** Pagination metadata included in all paginated list responses. */
export type PaginationMeta = components['schemas']['PaginationMeta']

/** Paginated list of content items (merchant content endpoints). */
export type PaginatedContentList = components['schemas']['PaginatedContentList']

/** Paginated list of per-title sales statistics. */
export type PaginatedSalesList = components['schemas']['PaginatedSalesList']

/** Paginated list of anonymised buyer statistics. */
export type PaginatedBuyersList = components['schemas']['PaginatedBuyersList']

/** Paginated list of store members. */
export type PaginatedUsersList = components['schemas']['PaginatedUsersList']

// ---------------------------------------------------------------------------
// SDK-level types (inline API shapes not promoted to named schemas)
// ---------------------------------------------------------------------------

/**
 * Platform-level public configuration returned by `GET /v1/config/public`.
 * No authentication required. Use this to get the Google OAuth client ID
 * before the user has signed in.
 */
export type PublicConfigResponse = components['schemas']['PublicConfigResponse']

/**
 * Store public configuration returned by `GET /v1/merchant/{store_id}/config`.
 * The `google_client_id` is used to initialise the Google OAuth button on the
 * buyer-facing storefront.
 */
export interface StoreConfig {
  google_client_id?: string
}

/**
 * Request body for initiating a buyer password reset.
 * Sent to `POST /v1/auth/password/reset-request`.
 */
export interface AuthPasswordResetRequestBody {
  /** The buyer's registered email address. */
  email: string
}

/**
 * Request body for completing a buyer password reset.
 * Sent to `POST /v1/auth/password/reset`.
 */
export interface AuthPasswordResetBody {
  /** The buyer's registered email address. */
  email: string
  /** 6-digit numeric code delivered to the buyer's email. */
  reset_code: string
  /** New password (minimum 6 characters). */
  password: string
}

/**
 * Response returned by both password reset endpoints.
 * Contains a human-readable confirmation message.
 */
export interface AuthPasswordResetResponse {
  data?: {
    message?: string
  }
}

// ---------------------------------------------------------------------------
// SDK-internal types (not in the OpenAPI spec)
// ---------------------------------------------------------------------------

/**
 * Interface for pluggable token storage adapters.
 * Implement this to persist tokens across page loads or in a server-side store.
 *
 * @example
 * ```ts
 * // Persist across tabs and browser restarts (browser only)
 * import { localStorageAdapter } from '@ledewire/browser'
 * const lw = init({ apiKey, storage: localStorageAdapter() })
 * ```
 *
 * @example
 * ```ts
 * // Persist within the current tab only — cleared on tab close (browser only)
 * import { sessionStorageAdapter } from '@ledewire/browser'
 * const lw = init({ apiKey, storage: sessionStorageAdapter() })
 * ```
 */
export interface TokenStorage {
  /** Retrieve stored token data, or null if none. */
  getTokens(): StoredTokens | null | Promise<StoredTokens | null>
  /** Persist token data. */
  setTokens(tokens: StoredTokens): void | Promise<void>
  /** Clear all stored token data (called on logout). */
  clearTokens(): void | Promise<void>
}

/** Internal representation of stored authentication tokens. */
export interface StoredTokens {
  accessToken: string
  refreshToken: string
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number
}

// ---------------------------------------------------------------------------
// SDK-level derived types
// ---------------------------------------------------------------------------

/**
 * Next step in a content checkout flow. Consumer-facing alias for
 * `CheckoutStateResponse['checkout_state']['next_required_action']`.
 *
 * **Single-use purchase model:** there is no terminal "you have access" state.
 * A completed purchase does not imply access — `has_purchased` means only "has ever
 * bought" — so `next_required_action` can still read `'purchase'` for content the
 * buyer already bought once. Buying again is how the buyer receives the content:
 * the delivery (`content_body` / `content_uri`) is returned directly in the
 * response to `POST /v1/purchases`, and nowhere else — not on `GET`/list, and not
 * via a since-withdrawn `'view_content'` state.
 */
export type CheckoutNextAction = 'authenticate' | 'fund_wallet' | 'purchase'

/**
 * Checkout state machine result for a specific content item, as returned by
 * `lw.checkout.state()`.
 *
 * This is a consumer-facing alias for {@link CheckoutStateResponse} — the two
 * types are identical. Prefer `CheckoutState` in application code; use
 * `CheckoutStateResponse` when you need to explicitly reference the OpenAPI
 * schema name.
 *
 * Note: `checkout_state.has_sufficient_funds` is `boolean | null` because the
 * API omits or nulls the field when the buyer is unauthenticated.
 */
export type CheckoutState = CheckoutStateResponse
