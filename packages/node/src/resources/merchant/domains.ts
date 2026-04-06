/**
 * Merchant domains namespace — x402 domain verification for URL-based content gating.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { MerchantDomainVerification } from '@ledewire/core'

/** Request body for adding a domain for verification. */
export interface MerchantDomainAddRequest {
  /**
   * Domain to verify. The `www.` prefix is stripped automatically by the server.
   * @example 'example.com'
   */
  domain: string
}

/**
 * Merchant domains namespace — manage verified domains required by x402 pricing rules.
 *
 * Before a pricing rule can gate URLs on a domain, the store owner must prove
 * ownership by publishing a DNS TXT record. This namespace provides the full
 * lifecycle: add a domain (get the TXT record details), list current records,
 * and remove a domain.
 *
 * Obtain via `client.merchant.domains` — do not construct directly.
 *
 * @example
 * ```ts
 * // Add a domain — returns the TXT record to publish in DNS
 * const record = await client.merchant.domains.add(storeId, { domain: 'example.com' })
 * console.log(`Add TXT record: ${record.txt_record_name} → ${record.txt_record_value}`)
 *
 * // List all domain verification records for the store
 * const domains = await client.merchant.domains.list(storeId)
 *
 * // Remove a domain (also silences any pricing rules on that domain)
 * await client.merchant.domains.remove(storeId, record.id)
 * ```
 */
export class MerchantDomainsNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns all domain verification records for the store,
   * ordered by creation date descending.
   *
   * Each record includes the DNS TXT `txt_record_name` and `txt_record_value`
   * the store owner must publish to complete verification.
   *
   * @param storeId - The merchant store ID.
   * @returns Array of domain verification records.
   */
  async list(storeId: string): Promise<MerchantDomainVerification[]> {
    return this.http.get<MerchantDomainVerification[]>(
      `/v1/merchant/${encodeURIComponent(storeId)}/domains`,
    )
  }

  /**
   * Adds a domain for verification.
   *
   * Creates a new domain verification record in `pending` status and returns
   * the DNS TXT record details the store owner must publish. Verification is
   * checked asynchronously by the platform — poll `list()` until `status`
   * transitions to `verified`.
   *
   * The `www.` prefix is stripped automatically — adding `www.example.com`
   * stores `example.com`.
   *
   * @param storeId - The merchant store ID.
   * @param body - The domain to add.
   * @returns The created domain verification record with DNS TXT record instructions.
   *
   * @example
   * ```ts
   * const record = await client.merchant.domains.add(storeId, { domain: 'example.com' })
   * // Publish: record.txt_record_name TXT record.txt_record_value
   * ```
   */
  async add(storeId: string, body: MerchantDomainAddRequest): Promise<MerchantDomainVerification> {
    return this.http.post<MerchantDomainVerification>(
      `/v1/merchant/${encodeURIComponent(storeId)}/domains`,
      body,
    )
  }

  /**
   * Removes a domain verification record.
   *
   * Hard-deletes the record. Any pricing rules whose `url_pattern` host matches
   * this domain will stop firing at match time (the platform re-checks domain
   * verification status on each request).
   *
   * @param storeId - The merchant store ID.
   * @param id - UUID of the domain verification record to remove.
   */
  async remove(storeId: string, id: string): Promise<void> {
    return this.http.delete(
      `/v1/merchant/${encodeURIComponent(storeId)}/domains/${encodeURIComponent(id)}`,
    )
  }
}
