import type { HttpClient } from '@ledewire/core'
import type { StoreConfig } from '@ledewire/core'

/**
 * Merchant store configuration namespace.
 *
 * @example
 * ```ts
 * const config = await client.merchant.config.get(storeId)
 * // config.google_client_id — used for Google Sign-In on the storefront
 * ```
 */
export class MerchantConfigNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns the store's public configuration.
   *
   * @param storeId - The merchant store ID.
   * @returns The store configuration object.
   */
  async get(storeId: string): Promise<StoreConfig> {
    return this.http.get<StoreConfig>(`/v1/merchant/${storeId}/config`)
  }
}
