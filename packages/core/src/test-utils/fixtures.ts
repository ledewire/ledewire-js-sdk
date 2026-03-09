/**
 * Test fixtures for SDK test suites.
 * All fixtures return new objects to prevent cross-test mutation.
 * @module
 */
import type { components } from '../api.gen.js'

type AuthResponse = components['schemas']['AuthenticationResponse']
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
export function errorResponseFixture(
  code: number,
  message: string,
): ErrorResponse {
  return { error: { code, message } }
}
