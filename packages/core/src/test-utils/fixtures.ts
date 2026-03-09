/**
 * Test fixtures for SDK test suites.
 * All fixtures return new objects to prevent cross-test mutation.
 * @module
 */
import type { components } from '../api.gen.js'

type AuthResponse = components['schemas']['AuthenticationResponse']
type MerchantAuthResponse = components['schemas']['MerchantAuthenticationResponse']
type MerchantUserSchema = components['schemas']['MerchantUser']
type ManageableStoreSchema = components['schemas']['ManageableStore']
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
 * Returns a valid merchant authentication response fixture.
 * Tokens expire 30 minutes from a fixed date far in the future.
 */
export function merchantTokenFixture(
  overrides?: Partial<MerchantAuthResponse>,
): MerchantAuthResponse {
  return {
    token_type: 'Bearer',
    access_token: 'test-merchant-access-token',
    refresh_token: 'test-merchant-refresh-token',
    expires_at: '2099-01-01T00:30:00Z',
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
    invited_at: '2099-01-01T00:00:00Z',
    accepted_at: '2099-01-01T00:01:00Z',
    email: 'owner@example.com',
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
