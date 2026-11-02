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
 * // Full access with API key + secret (write operations). The client logs in
 * // with the key before its first authenticated request; no login call needed.
 * const client = createClient({
 *   apiKey: process.env.LEDEWIRE_API_KEY,
 *   apiSecret: process.env.LEDEWIRE_API_SECRET,
 * })
 * // To read the key's store_id, log in explicitly once (it is not repeated)
 * const { store_id } = await client.auth.loginWithApiKey({
 *   key: process.env.LEDEWIRE_API_KEY,
 *   secret: process.env.LEDEWIRE_API_SECRET,
 * })
 * const summary = await client.merchant.sales.summary(store_id)
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
  AuthTokenRefreshResponse,
  StoreAuthenticationResponse,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- still exported for 0.14.0 callers until a later breaking release
  BuyerContentSearchRequest,
  ContentSearchRequest,
  ContentSearchPublication,
  ContentSearchResponse,
  ContentSearchResult,
  ContentSearchResultWithPublication,
  PublicationListParams,
  TopicDirectoryEntry,
  TopicDirectoryResponse,
  TopicSlug,
  InvitationOutcome,
  InvitationRefusalReason,
  InviteInfoResponse,
  MerchantAcceptInvitationRequest,
  MerchantInvitationAcceptedResponse,
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
  PurchaseLicense,
  PurchasePublication,
  ContentSearchFiling,
  LicenseDocument,
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
  ErrorType,
  UserSpendCap,
  UserSpendCapUpdateRequest,
  McpApiKey,
  McpApiKeyCreateRequest,
  McpApiKeyCreateResponse,
  DailySpendCapReachedErrorBody,
  Publication,
  PublicationListResponse,
  PublicationWork,
  PublicationWorkListResponse,
  PublicationWorksParams,
  AcquisitionResponse,
  AcquisitionQuote,
  AcquisitionWork,
  AcquisitionWorksParams,
  PaginatedAcquisitionWorkList,
  CorpusResponse,
  CorpusManifestResponse,
  SigningKeyHistoryResponse,
  X402BazaarDiscoveryResponse,
  X402BazaarResource,
  X402DiscoveryParams,
  X402VerifyOriginParams,
  X402VerifyOriginResponse,
  X402JwksResponse,
  CompanyRole,
  CompanyMembership,
  CompanyInvitation,
  CompanyInvitationList,
  CompanyInvitationRequest,
  CompanyInvitationAcceptRequest,
  CompanyMember,
  CompanyMemberList,
  CompanyMemberUpdateRequest,
  CompanyMachineUser,
  CompanyMachineUserList,
  CompanyMachineUserCreateRequest,
  CompanyMachineUserUpdateRequest,
  CompanyMachineUserBuyerKey,
  CompanyMachineUserBuyerKeyList,
  CompanyMachineUserBuyerKeyCreateRequest,
  CompanyMachineUserBuyerKeyCreateResponse,
  CompanyMachineUserMcpKey,
  CompanyMachineUserMcpKeyList,
  CompanyMachineUserMcpKeyCreateRequest,
  CompanyMachineUserMcpKeyCreateResponse,
  CompanyPendingTopUp,
  CompanyPendingTopUpList,
  CompanyWallet,
  CompanyPurchase,
  CompanyPurchaseMember,
  CompanyPurchaseList,
  CompanySpendList,
  CompanyReportFilters,
  CompanyPurchasesParams,
  CompanySpendParams,
} from '@ledewire/core'
export {
  AuthError,
  ForbiddenError,
  LedewireError,
  MemoryTokenStorage,
  NotFoundError,
  PurchaseError,
  RateLimitError,
  SpendCapReachedError,
  parseExpiresAt,
} from '@ledewire/core'

// Namespace-specific request/response types
export type {
  AcquisitionCreateRequest,
  MerchantDomainAddRequest,
  MerchantDomainVerifyRequest,
  MerchantDomainVerifyResponse,
  MerchantPasswordResetRequestBody,
  MerchantPasswordResetBody,
  MerchantPasswordResetResponse,
  MerchantPricingRuleCreateRequest,
  MerchantUserUpdateRequest,
} from '@ledewire/core'
export type { MerchantContentSearchRequest } from './resources/merchant/content.js'
export type { CorpusDownloadResult } from './resources/acquisitions.js'

// Package exports (implementations added in build step 4)
export { createClient, createAgentClient } from './client.js'
export type { NodeClientConfig, AgentClientConfig, AgentClient } from './client.js'
export type { MerchantLoginResult } from './resources/merchant/auth.js'
