/**
 * Seller namespace — API key authenticated store operations.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { SellerBuyersNamespace } from './buyers.js'
import { SellerConfigNamespace } from './config.js'
import { SellerContentNamespace } from './content.js'
import { SellerSalesNamespace } from './sales.js'

/**
 * Seller operations for a merchant store (API key auth).
 *
 * Obtain via `client.seller` — do not construct directly.
 */
export class SellerNamespace {
  /** Content CRUD: list, create, search, get, update, delete. */
  readonly content: SellerContentNamespace

  /** Sales reporting: summary statistics and per-content sales data. */
  readonly sales: SellerSalesNamespace

  /** Buyer statistics: aggregated, anonymised buyer reporting. */
  readonly buyers: SellerBuyersNamespace

  /** Store configuration: public settings such as OAuth client IDs. */
  readonly config: SellerConfigNamespace

  /** @internal */
  constructor(http: HttpClient) {
    this.content = new SellerContentNamespace(http)
    this.sales = new SellerSalesNamespace(http)
    this.buyers = new SellerBuyersNamespace(http)
    this.config = new SellerConfigNamespace(http)
  }
}
