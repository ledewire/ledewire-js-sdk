/**
 * Merchant namespace — groups auth and team management sub-namespaces.
 *
 * @module
 */
import type { HttpClient, TokenManager } from '@ledewire/core'
import { MerchantAuthNamespace } from './auth.js'
import { MerchantBuyersNamespace } from './buyers.js'
import { MerchantConfigNamespace } from './config.js'
import { MerchantSalesNamespace } from './sales.js'
import { MerchantUsersNamespace } from './users.js'

/**
 * Merchant store operations: authentication, team management, content,
 * sales, buyers, and store configuration.
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

  /**
   * Merchant sales reporting: summary statistics, per-title rollup, and sale detail.
   */
  readonly sales: MerchantSalesNamespace

  /**
   * Merchant buyer statistics: aggregated, anonymised buyer reporting.
   */
  readonly buyers: MerchantBuyersNamespace

  /**
   * Merchant store configuration: public settings such as OAuth client IDs.
   */
  readonly config: MerchantConfigNamespace

  /** @internal */
  constructor(http: HttpClient, tokenManager: TokenManager) {
    this.auth = new MerchantAuthNamespace(http, tokenManager)
    this.users = new MerchantUsersNamespace(http)
    this.sales = new MerchantSalesNamespace(http)
    this.buyers = new MerchantBuyersNamespace(http)
    this.config = new MerchantConfigNamespace(http)
  }
}
