import type { HttpClient } from '@ledewire/core'
import type { MerchantSaleResponse, SalesSummaryResponse, SalesStatisticsItem } from '@ledewire/core'

/**
 * Merchant sales namespace — revenue summary, per-sale records, and sale detail.
 */
export class MerchantSalesNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns aggregated revenue and sales-count statistics for the store,
   * broken down by month.
   *
   * @param storeId - The merchant store ID.
   * @returns Sales summary with totals and monthly breakdowns.
   */
  async summary(storeId: string): Promise<SalesSummaryResponse> {
    return this.http.get<SalesSummaryResponse>(`/v1/merchant/${storeId}/sales/summary`)
  }

  /**
   * Returns all content purchase records for the store with per-title rollups.
   *
   * @param storeId - The merchant store ID.
   * @returns A list of sales statistics items, one per content title.
   */
  async list(storeId: string): Promise<SalesStatisticsItem[]> {
    return this.http.get<SalesStatisticsItem[]>(`/v1/merchant/${storeId}/sales`)
  }

  /**
   * Returns full detail for a single sale, including the platform fee breakdown.
   *
   * @param storeId - The merchant store ID.
   * @param id - The sale (purchase) ID.
   * @returns The sale detail with fee split.
   */
  async get(storeId: string, id: string): Promise<MerchantSaleResponse> {
    return this.http.get<MerchantSaleResponse>(`/v1/merchant/${storeId}/sales/${id}`)
  }
}
