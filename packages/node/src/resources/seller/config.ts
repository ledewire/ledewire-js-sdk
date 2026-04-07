import type { HttpClient } from '@ledewire/core'
import type { StoreConfig } from '@ledewire/core'

/**
 * Seller store configuration namespace.
 *
 * Uses API key authentication.
 *
 * @example
 * ```ts
 * const config = await client.seller.config.get()
 * // config.google_client_id — used for Google Sign-In on the storefront
 * ```
 */
export class SellerConfigNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns the store's public configuration.
   *
   * @returns The store configuration object.
   */
  async get(): Promise<StoreConfig> {
    return this.http.get<StoreConfig>('/v1/seller/config')
  }
}
