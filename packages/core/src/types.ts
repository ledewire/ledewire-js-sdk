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

/** A user associated with a merchant store. */
export type MerchantUser = components['schemas']['MerchantUser']

/** Request body for inviting a user to a merchant store. */
export type MerchantInviteRequest = components['schemas']['MerchantInviteRequest']

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

/** Full content response returned by get/create/update operations. */
export type Content = components['schemas']['Content']

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

/** Purchase verification result. */
export type PurchaseVerifyResponse = components['schemas']['PurchaseVerifyResponse']

/** Sales summary statistics for a store. */
export type SalesSummaryResponse = components['schemas']['SalesSummaryResponse']

/** A single sale record for a merchant store. */
export type MerchantSaleResponse = components['schemas']['MerchantSaleResponse']

/** Buyer statistics item for a merchant store. */
export type BuyerStatisticsItem = components['schemas']['BuyerStatisticsItem']

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
