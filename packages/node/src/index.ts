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
 * // Merchant email/password auth — logs in and returns stores in one call
 * const client = createClient()
 * const { stores } = await client.merchant.auth.loginWithEmailAndListStores({ email, password })
 * const storeId = stores[0].id
 * ```
 *
 * @see {@link https://docs.ledewire.org} for guides and examples
 * @packageDocumentation
 */

// Re-export core types and errors for consumers who only install @ledewire/node
export type {
  AuthenticationResponse,
  PublicConfigResponse,
  BuyerStatisticsItem,
  CheckoutNextAction,
  CheckoutState,
  CheckoutStateResponse,
  Content,
  ContentAccessInfo,
  ContentListItem,
  ContentResponse,
  ContentWithAccessResponse,
  ManageableStore,
  MerchantAuthenticationResponse,
  MerchantLoginStore,
  MerchantSaleResponse,
  MerchantUser,
  NextRequiredAction,
  PaginatedBuyersList,
  PaginatedContentList,
  PaginatedSalesList,
  PaginatedUsersList,
  PaginationMeta,
  PaginationParams,
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
  AuthLoginBuyerApiKeyRequest,
  UserApiKey,
  UserApiKeyCreateRequest,
  UserApiKeyCreateResponse,
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

// Namespace-specific request/response types
export type { MerchantUserUpdateRequest } from './resources/merchant/users.js'
export type {
  MerchantDomainAddRequest,
  MerchantDomainVerifyRequest,
  MerchantDomainVerifyResponse,
} from './resources/merchant/domains.js'
export type { MerchantContentSearchRequest } from './resources/merchant/content.js'
export type { ContentSearchRequest } from './resources/seller/content.js'

// Package exports (implementations added in build step 4)
export { createClient, createAgentClient } from './client.js'
export type { NodeClientConfig, AgentClientConfig, AgentClient } from './client.js'
export type { MerchantLoginResult } from './resources/merchant/auth.js'
export type {
  MerchantPasswordResetRequestBody,
  MerchantPasswordResetBody,
  MerchantPasswordResetResponse,
} from './resources/merchant/auth.js'
