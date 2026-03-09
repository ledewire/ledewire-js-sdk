/**
 * Seller namespace — API key authenticated store operations.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { SellerContentNamespace } from './content.js'

/**
 * Seller operations for a merchant store (API key auth).
 *
 * Obtain via `client.seller` — do not construct directly.
 */
export class SellerNamespace {
  /** Content CRUD: list, create, search, get, update, delete. */
  readonly content: SellerContentNamespace

  /** @internal */
  constructor(http: HttpClient) {
    this.content = new SellerContentNamespace(http)
  }
}
