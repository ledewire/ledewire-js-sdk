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
 * - `'markdown'` requires `content_body` (base64-encoded markdown).
 * - `'external_ref'` requires `content_uri` (the external resource URL) and
 *   optionally `external_identifier` (namespaced platform ID, e.g. `vimeo:123`).
 */
export type Content =
  | {
      /** @discriminator */
      content_type: 'markdown'
      /** Content title. */
      title: string
      /** Full article body in markdown, base64 encoded. */
      content_body: string
      /** Optional teaser, base64 encoded. */
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
      /** Optional teaser, base64 encoded. */
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
        reading_time?: string
        [key: string]: unknown
      }
    }

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

// ---------------------------------------------------------------------------
// SDK-internal types (not in the OpenAPI spec)
// ---------------------------------------------------------------------------

/**
 * Interface for pluggable token storage adapters.
 * Implement this to persist tokens across page loads or in a server-side store.
 *
 * @example
 * ```ts
 * // Built-in localStorage adapter (browser only)
 * import { localStorageAdapter } from '@ledewire/browser'
 * const client = createBrowserClient({ apiKey, storage: localStorageAdapter() })
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
 * Next step in a content checkout flow.
 * Extends `NextRequiredAction` with the terminal `view_content` state
 * (returned once the buyer has purchased and can view the content).
 */
export type CheckoutNextAction = 'authenticate' | 'fund_wallet' | 'purchase' | 'view_content'

/** Checkout state machine result for a specific content item. */
export interface CheckoutState {
  content_id: string
  checkout_state: {
    is_authenticated: boolean
    has_sufficient_funds: boolean
    has_purchased: boolean
    next_required_action: CheckoutNextAction
  }
}
