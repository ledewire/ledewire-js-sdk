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

/** Request body for triggering DNS verification check. */
export interface MerchantDomainVerifyRequest {
  /**
   * Domain to verify. The `www.` prefix is stripped automatically by the server.
   * @example 'example.com'
   */
  domain: string
}

/** Response from triggering domain verification. */
export interface MerchantDomainVerifyResponse {
  /** Whether the verification job was enqueued. */
  queued: boolean
  /** The domain being verified. */
  domain: string
  /** Current status at time of enqueueing (not the final result). */
  status: 'pending' | 'verified' | 'failed'
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
 * // Trigger DNS verification check
 * await client.merchant.domains.verify(storeId, { domain: 'example.com' })
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

  /**
   * Triggers an asynchronous DNS TXT record verification check.
   *
   * Enqueues a background job to verify domain ownership by checking for the
   * expected DNS TXT record. Returns `202 Accepted` immediately — poll `list()`
   * to observe the `status` field transition from `pending` to `verified` or `failed`.
   *
   * This accepts the **domain string** rather than a record ID because the dashboard
   * UI is stateless and does not retain the UUID between "Add domain" and "Verify" steps.
   *
   * @param storeId - The merchant store ID.
   * @param body - The domain to verify.
   * @returns An object confirming the job was enqueued and the current status.
   *
   * @example
   * ```ts
   * const result = await client.merchant.domains.verify(storeId, { domain: 'example.com' })
   * console.log(`Verification job enqueued: ${result.queued}, status: ${result.status}`)
   * // Poll list() until status changes to 'verified'
   * ```
   */
  async verify(
    storeId: string,
    body: MerchantDomainVerifyRequest,
  ): Promise<MerchantDomainVerifyResponse> {
    return this.http.post<MerchantDomainVerifyResponse>(
      `/v1/merchant/${encodeURIComponent(storeId)}/domains/verify`,
      body,
    )
  }
}
