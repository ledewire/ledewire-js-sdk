import type { HttpClient } from '@ledewire/core'
import type { BuyerStatisticsItem } from '@ledewire/core'

/**
 * Merchant buyers namespace — aggregated, anonymised buyer statistics.
 */
export class MerchantBuyersNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns aggregated buyer statistics for the store.
   * Results are anonymised — buyer identities are not exposed.
   *
   * @param storeId - The merchant store ID.
   * @returns A list of buyer statistics items.
   */
  async list(storeId: string): Promise<BuyerStatisticsItem[]> {
    return this.http.get<BuyerStatisticsItem[]>(`/v1/merchant/${storeId}/buyers`)
  }
}
