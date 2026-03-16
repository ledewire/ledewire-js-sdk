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
type ErrorResponse = components['schemas']['ErrorResponse']

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
 * Returns an API error response fixture.
 */
export function errorResponseFixture(code: number, message: string): ErrorResponse {
  return { error: { code, message } }
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
    store_id: 'store-id-1',
    store_name: 'Test Store',
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
