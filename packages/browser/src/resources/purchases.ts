import type { HttpClient } from '@ledewire/core'
import type { PurchaseCreateRequest, PurchaseResponse } from '@ledewire/core'

/**
 * Buyer purchases namespace — create and retrieve content purchases.
 *
 * Obtain via `lw.purchases` — do not construct directly.
 *
 * @example
 * ```ts
 * await lw.purchases.create({ content_id: 'content-id' })
 * const all = await lw.purchases.list()
 * ```
 */
export class BrowserPurchasesNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Completes a content purchase using the buyer's wallet balance.
   *
   * @param body - The content ID and expected price in cents.
   * @returns The completed purchase record.
   */
  async create(body: PurchaseCreateRequest): Promise<PurchaseResponse> {
    return this.http.post<PurchaseResponse>('/v1/purchases', body)
  }

  /**
   * Returns all purchases made by the authenticated buyer.
   *
   * @returns A list of purchase records, newest first.
   */
  async list(): Promise<PurchaseResponse[]> {
    return this.http.get<PurchaseResponse[]>('/v1/purchases')
  }

  /**
   * Returns a single purchase by ID.
   *
   * @param id - The purchase ID.
   * @returns The purchase record.
   */
  async get(id: string): Promise<PurchaseResponse> {
    return this.http.get<PurchaseResponse>(`/v1/purchases/${encodeURIComponent(id)}`)
  }
}
