/**
 * Test fixtures for SDK test suites.
 * All fixtures return new objects to prevent cross-test mutation.
 * @module
 */
import type { components } from '../api.gen.js'

type AuthResponse = components['schemas']['AuthenticationResponse']
type MerchantAuthResponse = components['schemas']['MerchantAuthenticationResponse']
type MerchantLoginStoreSchema = components['schemas']['MerchantLoginStore']
type MerchantUserSchema = components['schemas']['MerchantUser']
type PaginationMetaSchema = components['schemas']['PaginationMeta']
type ManageableStoreSchema = components['schemas']['ManageableStore']
type ContentResponseSchema = components['schemas']['ContentResponse']
type ContentListItemSchema = components['schemas']['ContentListItem']
type ContentWithAccessSchema = components['schemas']['ContentWithAccessResponse']
type WalletBalanceSchema = components['schemas']['WalletBalanceResponse']
type WalletTransactionSchema = components['schemas']['WalletTransactionItem']
type WalletPaymentSessionSchema = components['schemas']['WalletPaymentSessionResponse']
type WalletPaymentStatusSchema = components['schemas']['WalletPaymentStatusResponse']
type PurchaseResponseSchema = components['schemas']['PurchaseResponse']
type ContentAccessInfoSchema = components['schemas']['ContentAccessInfo']
type CheckoutStateSchema = components['schemas']['CheckoutStateResponse']
type SalesSummarySchema = components['schemas']['SalesSummaryResponse']
type SalesStatisticsSchema = components['schemas']['SalesStatisticsItem']
type MerchantSaleSchema = components['schemas']['MerchantSaleResponse']
type BuyerStatisticsSchema = components['schemas']['BuyerStatisticsItem']
type PublicConfigSchema = components['schemas']['PublicConfigResponse']
type MerchantPricingRuleSchema = components['schemas']['MerchantPricingRule']
type MerchantDomainVerificationSchema = components['schemas']['MerchantDomainVerification']
type UserApiKeySchema = components['schemas']['UserApiKey']
type UserApiKeyCreateResponseSchema = components['schemas']['UserApiKeyCreateResponse']
type ErrorResponse = components['schemas']['ErrorResponse']
type UserSpendCapSchema = components['schemas']['UserSpendCap']
type McpApiKeySchema = components['schemas']['McpApiKey']
type McpApiKeyCreateResponseSchema = components['schemas']['McpApiKeyCreateResponse']
type PublicationSchema = components['schemas']['Publication']
type PublicationWorkListResponseSchema = components['schemas']['PublicationWorkListResponse']
type AcquisitionResponseSchema = components['schemas']['AcquisitionResponse']
type AcquisitionWorkSchema = components['schemas']['AcquisitionWork']
type CorpusResponseSchema = components['schemas']['CorpusResponse']
type CorpusManifestResponseSchema = components['schemas']['CorpusManifestResponse']
type SigningKeyHistoryResponseSchema = components['schemas']['SigningKeyHistoryResponse']
type X402BazaarDiscoveryResponseSchema = components['schemas']['X402BazaarDiscoveryResponse']
type DailySpendCapReachedErrorSchema = components['schemas']['DailySpendCapReachedError']
type CompanyMembershipSchema = components['schemas']['CompanyMembership']
type CompanyInvitationSchema = components['schemas']['CompanyInvitation']
type CompanyMemberSchema = components['schemas']['CompanyMember']
type CompanyMachineUserSchema = components['schemas']['CompanyMachineUser']
type CompanyMachineUserBuyerKeySchema = components['schemas']['CompanyMachineUserBuyerKey']
type CompanyMachineUserBuyerKeyCreateResponseSchema =
  components['schemas']['CompanyMachineUserBuyerKeyCreateResponse']
type CompanyMachineUserMcpKeySchema = components['schemas']['CompanyMachineUserMcpKey']
type CompanyMachineUserMcpKeyCreateResponseSchema =
  components['schemas']['CompanyMachineUserMcpKeyCreateResponse']
type CompanyPendingTopUpSchema = components['schemas']['CompanyPendingTopUp']
type CompanyPurchaseSchema = components['schemas']['CompanyPurchase']
type CompanyPurchaseMemberSchema = components['schemas']['CompanyPurchaseMember']

/**
 * Returns a valid authentication response fixture.
 * Tokens expire 30 minutes from a fixed date far in the future.
 */
export function authTokenFixture(overrides?: Partial<AuthResponse>): AuthResponse {
  return {
    token_type: 'Bearer',
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: '2099-01-01T00:30:00Z',
    ...overrides,
  }
}

/**
 * Returns an API error response fixture. Pass `type` to simulate a refusal that
 * carries a machine-readable `error.type` (see {@link ErrorType}).
 */
export function errorResponseFixture(
  code: number,
  message: string,
  type?: ErrorResponse['error']['type'],
): ErrorResponse {
  return { error: { code, message, ...(type !== undefined && { type }) } }
}

/**
 * Returns a valid merchant login store fixture.
 */
export function merchantLoginStoreFixture(
  overrides?: Partial<MerchantLoginStoreSchema>,
): MerchantLoginStoreSchema {
  return {
    id: 'store-id-1',
    name: 'Test Store',
    role: 'owner',
    ...overrides,
  }
}

/**
 * Returns a valid merchant authentication response fixture.
 * Tokens expire 30 minutes from a fixed date far in the future.
 * Includes a single store entry matching {@link merchantLoginStoreFixture}.
 */
export function merchantTokenFixture(
  overrides?: Partial<MerchantAuthResponse>,
): MerchantAuthResponse {
  return {
    token_type: 'Bearer',
    access_token: 'test-merchant-access-token',
    refresh_token: 'test-merchant-refresh-token',
    expires_at: '2099-01-01T00:30:00Z',
    stores: [merchantLoginStoreFixture()],
    ...overrides,
  }
}

/**
 * Returns a valid merchant user fixture.
 */
export function merchantUserFixture(overrides?: Partial<MerchantUserSchema>): MerchantUserSchema {
  return {
    id: 'store-user-id-1',
    user_id: 'user-id-1',
    store_id: 'store-id-1',
    role: 'owner',
    is_author: true,
    author_fee_bps: null,
    invited_at: '2099-01-01T00:00:00Z',
    accepted_at: '2099-01-01T00:01:00Z',
    email: 'owner@example.com',
    ...overrides,
  }
}

/**
 * Returns a valid pagination metadata fixture.
 */
export function paginationMetaFixture(
  overrides?: Partial<PaginationMetaSchema>,
): PaginationMetaSchema {
  return {
    total: 1,
    per_page: 25,
    current_page: 1,
    total_pages: 1,
    next_page: null,
    prev_page: null,
    ...overrides,
  }
}

/**
 * Returns a valid manageable store fixture.
 */
export function manageableStoreFixture(
  overrides?: Partial<ManageableStoreSchema>,
): ManageableStoreSchema {
  return {
    id: 'store-id-1',
    name: 'Test Store',
    store_key: 'test-store',
    role: 'owner',
    is_author: true,
    logo: null,
    ...overrides,
  }
}

/**
 * Returns a valid markdown content response fixture.
 */
export function contentResponseFixture(
  overrides?: Partial<ContentResponseSchema>,
): ContentResponseSchema {
  return {
    id: 'content-id-1',
    content_type: 'markdown',
    title: 'Test Article',
    content_body: btoa('# Test Article\nBody text.'),
    teaser: btoa('A short teaser.'),
    price_cents: 500,
    visibility: 'public',
    ...overrides,
  }
}

/**
 * Returns a valid external_ref content response fixture.
 */
export function externalRefContentResponseFixture(
  overrides?: Partial<ContentResponseSchema>,
): ContentResponseSchema {
  return {
    id: 'content-id-ext-1',
    content_type: 'external_ref',
    title: 'Intro to Machine Learning',
    content_body: null,
    content_uri: 'https://vimeo.com/987654321',
    external_identifier: 'vimeo:987654321',
    teaser: btoa('A beginner-friendly introduction to ML concepts.'),
    price_cents: 1500,
    visibility: 'public',
    ...overrides,
  }
}

/**
 * Returns a valid markdown ContentListItem fixture (list/search endpoints).
 */
export function contentListItemFixture(
  overrides?: Partial<ContentListItemSchema>,
): ContentListItemSchema {
  return {
    id: 'content-id-1',
    content_type: 'markdown',
    title: 'Test Article',
    teaser: btoa('A short teaser.'),
    price_cents: 500,
    visibility: 'public',
    created_at: '2099-01-01T00:00:00Z',
    content_uri: null,
    ...overrides,
  }
}

/**
 * Returns a valid external_ref ContentListItem fixture (list/search endpoints).
 * Includes `content_uri` — use directly as an `<a href>`.
 */
export function externalRefContentListItemFixture(
  overrides?: Partial<ContentListItemSchema>,
): ContentListItemSchema {
  return {
    id: 'content-id-ext-1',
    content_type: 'external_ref',
    title: 'Intro to Machine Learning',
    teaser: btoa('A beginner-friendly introduction to ML concepts.'),
    price_cents: 1500,
    visibility: 'public',
    created_at: '2099-01-01T00:00:00Z',
    content_uri: 'https://vimeo.com/987654321',
    external_identifier: 'vimeo:987654321',
    ...overrides,
  }
}

/**
 * Returns a content access info fixture (used within ContentWithAccessResponse).
 */
export function contentAccessInfoFixture(
  overrides?: Partial<ContentAccessInfoSchema>,
): ContentAccessInfoSchema {
  return {
    user_id: 'user-id-1',
    has_purchased: false,
    has_sufficient_funds: true,
    wallet_balance_cents: 1000,
    next_required_action: 'purchase',
    remaining_cents: null,
    company_name: null,
    ...overrides,
  }
}

/**
 * Returns a content-with-access response fixture.
 */
export function contentWithAccessFixture(
  overrides?: Partial<ContentWithAccessSchema>,
): ContentWithAccessSchema {
  return {
    ...contentResponseFixture(),
    access_info: contentAccessInfoFixture(),
    ...overrides,
  }
}

/**
 * Returns a wallet balance response fixture.
 */
export function walletBalanceFixture(
  overrides?: Partial<WalletBalanceSchema>,
): WalletBalanceSchema {
  return {
    balance_cents: 12500,
    spendable_cents: 12500,
    held_cents: 0,
    holds: [],
    remaining_cents: null,
    company_name: null,
    ...overrides,
  }
}

/**
 * Returns a wallet transaction item fixture.
 */
export function walletTransactionFixture(
  overrides?: Partial<WalletTransactionSchema>,
): WalletTransactionSchema {
  return {
    id: 'txn-id-1',
    type: 'credit',
    reason: 'wallet_funding',
    amount_cents: 5000,
    balance_after_cents: 12500,
    status: 'completed',
    reference_id: 'ref-id-1',
    description: 'Wallet top-up',
    occurred_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a wallet payment session response fixture.
 */
export function walletPaymentSessionFixture(
  overrides?: Partial<WalletPaymentSessionSchema>,
): WalletPaymentSessionSchema {
  return {
    client_secret: 'pi_test_secret',
    session_id: 'pi_test_session',
    public_key: 'pk_test_pubkey',
    ...overrides,
  }
}

/**
 * Returns a wallet payment status response fixture.
 */
export function walletPaymentStatusFixture(
  overrides?: Partial<WalletPaymentStatusSchema>,
): WalletPaymentStatusSchema {
  return {
    status: 'completed',
    updated_at: '2099-01-01T00:01:00Z',
    balance_cents: 12500,
    ...overrides,
  }
}

/**
 * Returns a purchase response fixture.
 */
export function purchaseResponseFixture(
  overrides?: Partial<PurchaseResponseSchema>,
): PurchaseResponseSchema {
  return {
    id: 'purchase-id-1',
    content_id: 'content-id-1',
    content: { id: 'content-id-1', content_type: 'markdown', title: 'Test Article' },
    buyer_id: 'user-id-1',
    buyer: { id: 'user-id-1', name: 'Test Buyer' },
    seller_id: 'seller-id-1',
    seller: { id: 'seller-id-1', name: 'Test Seller' },
    amount_cents: 500,
    timestamp: '2099-01-01T00:00:00Z',
    status: 'completed',
    ...overrides,
  }
}

/**
 * Returns a checkout state response fixture.
 */
export function checkoutStateFixture(
  overrides?: Partial<CheckoutStateSchema>,
): CheckoutStateSchema {
  return {
    content_id: 'content-id-1',
    content_title: 'Test Article',
    price_cents: 500,
    checkout_state: {
      is_authenticated: true,
      has_sufficient_funds: true,
      has_purchased: false,
      next_required_action: 'purchase',
    },
    ...overrides,
  }
}
/**
 * Returns a sales summary response fixture.
 */
export function salesSummaryFixture(overrides?: Partial<SalesSummarySchema>): SalesSummarySchema {
  return {
    total_revenue_cents: 15000,
    total_sales: 3,
    monthly_revenue_cents: { '2099': { '1': 15000 } },
    monthly_sales: { '2099': { '1': 3 } },
    ...overrides,
  }
}

/**
 * Returns a sales statistics item fixture (per-title rollup).
 */
export function salesStatisticsItemFixture(
  overrides?: Partial<SalesStatisticsSchema>,
): SalesStatisticsSchema {
  return {
    content_id: 'content-id-1',
    title: 'Test Article',
    total_sales: 3,
    total_revenue_cents: 1500,
    ...overrides,
  }
}

/**
 * Returns a merchant sale detail fixture (includes fee breakdown).
 */
export function merchantSaleFixture(overrides?: Partial<MerchantSaleSchema>): MerchantSaleSchema {
  return {
    id: 'sale-id-1',
    content_id: 'content-id-1',
    content: { id: 'content-id-1', content_type: 'markdown', title: 'Test Article' },
    buyer_id: 'user-id-1',
    buyer: { id: 'user-id-1', name: 'Test Buyer' },
    seller_id: 'seller-id-1',
    seller: { id: 'seller-id-1', name: 'Test Seller' },
    amount_cents: 500,
    fees: { platform_fee_cents: 50, store_net_cents: 450, author_net_cents: 0 },
    status: 'completed',
    timestamp: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a buyer statistics item fixture.
 */
export function buyerStatisticsItemFixture(
  overrides?: Partial<BuyerStatisticsSchema>,
): BuyerStatisticsSchema {
  return {
    buyer_ref: 'buyer-ref-1',
    purchases_count: 2,
    total_spent_cents: 1000,
    first_purchase_at: '2099-01-01T00:00:00Z',
    last_purchase_at: '2099-01-02T00:00:00Z',
    buyer_status: 'repeat',
    ...overrides,
  }
}

/**
 * Returns a public platform configuration fixture.
 */
export function publicConfigFixture(overrides?: Partial<PublicConfigSchema>): PublicConfigSchema {
  return {
    google_client_id: 'google-client-id-test',
    ...overrides,
  }
}

/**
 * Returns a merchant pricing rule fixture (x402 URL gating).
 */
export function merchantPricingRuleFixture(
  overrides?: Partial<MerchantPricingRuleSchema>,
): MerchantPricingRuleSchema {
  return {
    id: 'rule-id-1',
    store_id: 'store-id-1',
    url_pattern: 'https://example.com/articles/*',
    price_cents: 150,
    active: true,
    created_at: '2099-01-01T00:00:00Z',
    updated_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a merchant domain verification fixture (x402 domain management).
 */
export function merchantDomainVerificationFixture(
  overrides?: Partial<MerchantDomainVerificationSchema>,
): MerchantDomainVerificationSchema {
  return {
    id: 'domain-id-1',
    store_id: 'store-id-1',
    domain: 'example.com',
    status: 'pending',
    txt_record_name: '_ledewire-verify.example.com',
    txt_record_value: 'ledewire-verify=abc123',
    verified_at: null,
    checked_at: null,
    created_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a buyer API key fixture (secret is never present after creation).
 */
export function userApiKeyFixture(overrides?: Partial<UserApiKeySchema>): UserApiKeySchema {
  return {
    id: 'key-id-1',
    name: 'My Agent Key',
    key: 'bktst_abc123',
    last_used_at: null,
    spending_limit_cents: null,
    created_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a buyer API key create response fixture.
 * The `secret` is shown once only — store immediately.
 */
export function userApiKeyCreateResponseFixture(
  overrides?: Partial<UserApiKeyCreateResponseSchema>,
): UserApiKeyCreateResponseSchema {
  return {
    id: 'key-id-1',
    key: 'bktst_abc123',
    secret: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    ...overrides,
  }
}

/**
 * Returns a buyer daily spend cap fixture.
 */
export function spendCapFixture(overrides?: Partial<UserSpendCapSchema>): UserSpendCapSchema {
  return {
    cap_cents: 5000,
    spend_window_timezone: 'UTC',
    spent_cents: 1500,
    remaining_cents: 3500,
    resets_at: '2099-01-02T00:00:00Z',
    bulk_exempt: false,
    company_name: null,
    ...overrides,
  }
}

/**
 * Returns an MCP API key fixture (secret is never present after creation).
 */
export function mcpApiKeyFixture(overrides?: Partial<McpApiKeySchema>): McpApiKeySchema {
  return {
    id: 'mcp-key-id-1',
    label: 'My Agent Key',
    key: 'mcpk_abc123',
    can_search: true,
    can_purchase: false,
    store_id: null,
    can_manage_content: false,
    can_read_analytics: false,
    last_used_at: null,
    created_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns an MCP API key create response fixture.
 * The `secret` is shown once only — store immediately.
 */
export function mcpApiKeyCreateResponseFixture(
  overrides?: Partial<McpApiKeyCreateResponseSchema>,
): McpApiKeyCreateResponseSchema {
  return {
    id: 'mcp-key-id-1',
    key: 'mcpk_abc123',
    secret: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    label: 'My Agent Key',
    can_search: true,
    can_purchase: false,
    store_id: null,
    can_manage_content: false,
    can_read_analytics: false,
    ...overrides,
  }
}

/**
 * Returns a bulk-licensing publication fixture.
 */
export function publicationFixture(overrides?: Partial<PublicationSchema>): PublicationSchema {
  return {
    id: 'pub-id-1',
    name: 'Test Publication',
    domains: ['example.com'],
    bulk_licensable: true,
    coverage_horizon: null,
    ...overrides,
  }
}

/**
 * Returns a page of a publication's works, as returned by
 * `GET /v1/publications/{id}/works`.
 */
export function publicationWorkListFixture(
  overrides?: Partial<PublicationWorkListResponseSchema>,
): PublicationWorkListResponseSchema {
  return {
    publication_id: 'pub-id-1',
    domain: 'example.com',
    date_filter: 'not_requested',
    works: [{ url: 'https://example.com/articles/1', last_mod: '2099-01-01T00:00:00Z' }],
    next_cursor: null,
    ...overrides,
  }
}

/**
 * Returns a bulk acquisition fixture.
 */
export function acquisitionFixture(
  overrides?: Partial<AcquisitionResponseSchema>,
): AcquisitionResponseSchema {
  return {
    id: 'acq-id-1',
    status: 'quoted',
    quote_state: 'ready',
    publication_count: 1,
    submitted_work_count: 2,
    work_count: 2,
    quote: {
      state: 'ready',
      firm_micros: 2_000_000,
      estimated_micros: 0,
      maximum_chargeable_total_cents: 200,
      quoted_at: '2099-01-01T00:00:00Z',
      expires_at: '2099-01-02T00:00:00Z',
      exclusions_acknowledged_at: null,
    },
    exclusions: [],
    delivery: {
      purchased: 0,
      delivered: 0,
      undelivered: 0,
      outstanding: 2,
    },
    created_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a per-work disposition fixture for a bulk acquisition.
 */
export function acquisitionWorkFixture(
  overrides?: Partial<AcquisitionWorkSchema>,
): AcquisitionWorkSchema {
  return {
    position: 1,
    submitted_url: 'https://example.com/articles/1',
    canonical_url: 'https://example.com/articles/1',
    line_state: 'firm',
    exclusion_reason: null,
    price_micros: 1_000_000,
    purchased: true,
    delivery_state: 'delivered',
    failure_reason: null,
    attempts: 1,
    ...overrides,
  }
}

/**
 * Returns a bulk acquisition corpus status fixture.
 */
export function corpusFixture(overrides?: Partial<CorpusResponseSchema>): CorpusResponseSchema {
  return {
    state: 'ready',
    format: 'tar_gz',
    byte_size: 1024,
    expires_at: '2099-01-31T00:00:00Z',
    failure_reason: null,
    download_url: '/v1/acquisitions/acq-id-1/corpus/download',
    ...overrides,
  }
}

/**
 * Returns a signed corpus manifest fixture.
 */
export function corpusManifestFixture(
  overrides?: Partial<CorpusManifestResponseSchema>,
): CorpusManifestResponseSchema {
  return {
    manifest: { works: [] },
    signature: 'base64url-signature',
    digest: 'deadbeef',
    signing_kid: 'kid-1',
    key_history_head_digest: 'head-digest-1',
    signed_at: '2099-01-01T00:00:00Z',
    key_history_url: 'https://api.ledewire.com/.well-known/ledewire-signing-keys.json',
    ...overrides,
  }
}

/**
 * Returns a signing-key history fixture (`.well-known/ledewire-signing-keys.json`).
 */
export function signingKeyHistoryFixture(
  overrides?: Partial<SigningKeyHistoryResponseSchema>,
): SigningKeyHistoryResponseSchema {
  return {
    schema_version: 1,
    entries: [
      {
        kind: 'activate',
        kid: 'kid-1',
        sequence: 0,
        public_key: 'base64url-public-key',
        valid_from: '2099-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  }
}

/**
 * Returns an x402 Bazaar discovery response fixture.
 */
export function x402BazaarDiscoveryFixture(
  overrides?: Partial<X402BazaarDiscoveryResponseSchema>,
): X402BazaarDiscoveryResponseSchema {
  return {
    total: 1,
    resources: [
      {
        resource: 'https://api.ledewire.com/v1/x402/contents/content-id-1',
        type: 'http',
        x402Version: 2,
        accepts: [{ scheme: 'ledewire-wallet', network: 'ledewire:v1' }],
        lastUpdated: 1_735_689_600,
        metadata: {
          title: 'Test Article',
          teaser: 'A short teaser.',
          store_name: 'Test Store',
          category: 'markdown',
        },
      },
    ],
    ...overrides,
  }
}

/**
 * Returns a daily-spend-cap-reached error body fixture, as returned with HTTP `402`
 * by `POST /v1/purchases`, `GET /v1/x402/contents/{id}`, and acquisition
 * authorization.
 */
export function spendCapReachedErrorFixture(
  overrides?: Partial<DailySpendCapReachedErrorSchema>,
): DailySpendCapReachedErrorSchema {
  return {
    error: {
      code: 402,
      message: 'Daily spend cap reached.',
      type: 'daily_spend_cap_reached',
    },
    cap_cents: 5000,
    spent_cents: 5000,
    remaining_cents: 0,
    resets_at: '2099-01-02T00:00:00Z',
    bulk_exempt: false,
    message: 'Daily spend cap reached.',
    ...overrides,
  }
}

/**
 * Returns the authenticated buyer's own Company membership fixture.
 */
export function companyMembershipFixture(
  overrides?: Partial<CompanyMembershipSchema>,
): CompanyMembershipSchema {
  return {
    id: 'membership-id-1',
    company_id: 'company-id-1',
    company_name: 'Acme Research',
    role: 'admin',
    joined_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a pending Company invitation fixture.
 */
export function companyInvitationFixture(
  overrides?: Partial<CompanyInvitationSchema>,
): CompanyInvitationSchema {
  return {
    id: 'invitation-id-1',
    company_id: 'company-id-1',
    company_name: 'Acme Research',
    email: 'analyst@example.com',
    role: 'member',
    invited_at: '2099-01-01T00:00:00Z',
    expires_at: '2099-01-08T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a Company member fixture, as a Company admin sees it.
 */
export function companyMemberFixture(
  overrides?: Partial<CompanyMemberSchema>,
): CompanyMemberSchema {
  return {
    id: 'membership-id-2',
    user_id: 'user-id-2',
    name: 'Analyst',
    email: 'analyst@example.com',
    kind: 'human',
    role: 'member',
    joined_at: '2099-01-01T00:00:00Z',
    daily_spend_limit_cents: 1000,
    ...overrides,
  }
}

/**
 * Returns a Company Machine user fixture.
 */
export function companyMachineUserFixture(
  overrides?: Partial<CompanyMachineUserSchema>,
): CompanyMachineUserSchema {
  return {
    id: 'machine-user-id-1',
    user_id: 'user-id-3',
    name: 'research-agent',
    description: null,
    created_by_user_id: 'user-id-1',
    created_at: '2099-01-01T00:00:00Z',
    deactivated_at: null,
    ...overrides,
  }
}

/**
 * Returns a Machine user's Buyer key fixture (secret is never present after creation).
 */
export function companyMachineUserBuyerKeyFixture(
  overrides?: Partial<CompanyMachineUserBuyerKeySchema>,
): CompanyMachineUserBuyerKeySchema {
  return {
    id: 'mu-buyer-key-id-1',
    name: 'production',
    key: 'bktst_mu123',
    created_by_user_id: 'user-id-1',
    last_used_at: null,
    created_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a Machine user's Buyer key create response fixture, with its one-time secret.
 */
export function companyMachineUserBuyerKeyCreateResponseFixture(
  overrides?: Partial<CompanyMachineUserBuyerKeyCreateResponseSchema>,
): CompanyMachineUserBuyerKeyCreateResponseSchema {
  return {
    ...companyMachineUserBuyerKeyFixture(),
    secret: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    ...overrides,
  }
}

/**
 * Returns a Machine user's MCP API key fixture (secret is never present after creation).
 */
export function companyMachineUserMcpKeyFixture(
  overrides?: Partial<CompanyMachineUserMcpKeySchema>,
): CompanyMachineUserMcpKeySchema {
  return {
    id: 'mu-mcp-key-id-1',
    label: 'research-agent',
    key: 'mcpk_mu123',
    scopes: ['mcp:search', 'mcp:purchase'],
    created_by_user_id: 'user-id-1',
    expires_at: null,
    last_used_at: null,
    created_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Returns a Machine user's MCP API key create response fixture, with its one-time secret.
 */
export function companyMachineUserMcpKeyCreateResponseFixture(
  overrides?: Partial<CompanyMachineUserMcpKeyCreateResponseSchema>,
): CompanyMachineUserMcpKeyCreateResponseSchema {
  return {
    ...companyMachineUserMcpKeyFixture(),
    secret: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    ...overrides,
  }
}

/**
 * Returns a pending Company wallet top-up fixture.
 */
export function companyPendingTopUpFixture(
  overrides?: Partial<CompanyPendingTopUpSchema>,
): CompanyPendingTopUpSchema {
  return {
    id: 'top-up-id-1',
    session_id: 'cs_test_123',
    amount_cents: 50000,
    status: 'processing',
    initiated_by_user_id: 'user-id-1',
    created_at: '2099-01-01T00:00:00Z',
    expected_debit_date: '2099-01-07',
    ...overrides,
  }
}

/**
 * Returns the membership a Company purchase or spend row is attributed to.
 */
export function companyPurchaseMemberFixture(
  overrides?: Partial<CompanyPurchaseMemberSchema>,
): CompanyPurchaseMemberSchema {
  return {
    id: 'membership-id-2',
    user_id: 'user-id-2',
    name: 'Analyst',
    kind: 'human',
    left_at: null,
    ...overrides,
  }
}

/**
 * Returns a Company purchase fixture, attributed to the member who bought it.
 */
export function companyPurchaseFixture(
  overrides?: Partial<CompanyPurchaseSchema>,
): CompanyPurchaseSchema {
  return {
    kind: 'purchase',
    id: 'purchase-id-1',
    member: companyPurchaseMemberFixture(),
    status: 'completed',
    amount_cents: 150,
    occurred_at: '2099-01-01T00:00:00Z',
    ...overrides,
  }
}
