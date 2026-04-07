import type { HttpClient } from '@ledewire/core'
import type { BuyerStatisticsItem } from '@ledewire/core'

/**
 * Seller buyers namespace — aggregated, anonymised buyer statistics.
 *
 * Uses API key authentication. Provides anonymized purchase data to minimize
 * exposure of buyer identity information.
 *
 * @example
 * ```ts
 * const buyers = await client.seller.buyers.list()
 * console.log(`Total buyers: ${buyers.length}`)
 * ```
 */
export class SellerBuyersNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns aggregated buyer statistics for the store.
   * Results are anonymised — buyer identities are not exposed.
   *
   * @returns Array of anonymized buyer statistics.
   *
   * @example
   * ```ts
   * const buyers = await client.seller.buyers.list()
   * buyers.forEach(b => console.log(`${b.buyer_ref}: ${b.purchases_count} purchases`))
   * ```
   */
  async list(): Promise<BuyerStatisticsItem[]> {
    return this.http.get<BuyerStatisticsItem[]>('/v1/seller/buyers')
  }
}
