/**
 * Browser seller namespace — API-key-authenticated read operations.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import { BrowserSellerContentNamespace } from './content.js'

/**
 * Seller operations accessible with a view-permission API key token.
 *
 * Obtain via `lw.seller` — do not construct directly.
 *
 * @example
 * ```ts
 * const lw = Ledewire.init({ apiKey: 'your_api_key' })
 * await lw.auth.loginWithApiKey({ key: 'your_api_key' })
 * const items = await lw.seller.content.list()
 * ```
 */
export class BrowserSellerNamespace {
  /** Seller content: list, search, and get by API key. */
  readonly content: BrowserSellerContentNamespace

  /** @internal */
  constructor(http: HttpClient) {
    this.content = new BrowserSellerContentNamespace(http)
  }
}
