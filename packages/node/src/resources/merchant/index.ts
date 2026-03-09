/**
 * Merchant namespace — groups auth and team management sub-namespaces.
 *
 * @module
 */
import type { HttpClient, TokenManager } from '@ledewire/core'
import { MerchantAuthNamespace } from './auth.js'
import { MerchantUsersNamespace } from './users.js'

/**
 * Merchant store operations: authentication, team management, content,
 * sales, and store configuration.
 *
 * Obtain via `client.merchant` — do not construct directly.
 */
export class MerchantNamespace {
  /**
   * Merchant authentication: email/password login, Google OAuth, store discovery.
   */
  readonly auth: MerchantAuthNamespace

  /**
   * Merchant store team management: list, invite, and remove members.
   */
  readonly users: MerchantUsersNamespace

  /** @internal */
  constructor(http: HttpClient, tokenManager: TokenManager) {
    this.auth = new MerchantAuthNamespace(http, tokenManager)
    this.users = new MerchantUsersNamespace(http)
  }
}
