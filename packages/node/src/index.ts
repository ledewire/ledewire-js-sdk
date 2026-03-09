/**
 * @ledewire/node
 *
 * LedeWire SDK for Node.js environments.
 * Provides the complete API surface for building merchant stores,
 * managing content, authors, and reporting.
 *
 * @example
 * ```ts
 * import { createClient } from '@ledewire/node'
 *
 * // Full access with API key + secret (write operations)
 * const client = createClient({
 *   apiKey: process.env.LEDEWIRE_API_KEY,
 *   apiSecret: process.env.LEDEWIRE_API_SECRET,
 * })
 *
 * // View-only with API key only (read operations)
 * const viewClient = createClient({ apiKey: process.env.LEDEWIRE_API_KEY })
 *
 * // Merchant email/password auth
 * const client = createClient()
 * await client.merchant.auth.loginWithEmail({ email, password })
 * ```
 *
 * @see {@link https://docs.ledewire.org} for guides and examples
 * @packageDocumentation
 */

// Re-export core types and errors for consumers who only install @ledewire/node
export type {
  AuthenticationResponse,
  BuyerStatisticsItem,
  CheckoutNextAction,
  CheckoutState,
  CheckoutStateResponse,
  Content,
  ContentAccessInfo,
  ContentResponse,
  ContentWithAccessResponse,
  MerchantAuthenticationResponse,
  MerchantSaleResponse,
  NextRequiredAction,
  PurchaseCreateRequest,
  PurchaseResponse,
  SalesSummaryResponse,
  SalesStatisticsItem,
  StoreConfig,
  StoredTokens,
  TokenStorage,
  WalletBalanceResponse,
  WalletPaymentSessionRequest,
  WalletPaymentSessionResponse,
  WalletPaymentStatusResponse,
  WalletTransactionItem,
} from '@ledewire/core'
export {
  AuthError,
  ForbiddenError,
  LedewireError,
  MemoryTokenStorage,
  NotFoundError,
  PurchaseError,
  parseExpiresAt,
} from '@ledewire/core'

// Package exports (implementations added in build step 4)
export { createClient } from './client.js'
export type { NodeClientConfig } from './client.js'
