/**
 * Merchant pricing rules namespace — x402 URL-based content gating.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { MerchantPricingRule } from '@ledewire/core'

/** Request body for creating a pricing rule. */
export interface MerchantPricingRuleCreateRequest {
  /**
   * Glob URL pattern to gate. Must begin with `http://` or `https://`.
   * Supports `*` (single segment) and `**` (cross-separator) wildcards.
   *
   * @remarks
   * **Use `https://` patterns.** An `http://` pattern means the merchant's page
   * loads without TLS — browsers flag it as "Not Secure" and the buyer's session
   * is visible in plaintext. The Ledewire payment API itself always uses HTTPS,
   * but the merchant page context matters for user trust.
   *
   * @example 'https://example.com/articles/*'
   */
  url_pattern: string
  /**
   * Price in cents charged for access to matching URLs.
   *
   * @remarks
   * Setting `price_cents` to `0` makes all matching URLs freely accessible —
   * the x402 server short-circuits directly to `200` without a payment round-trip.
   * Verify the intended price before creating a rule.
   *
   * @minimum 0
   */
  price_cents: number
}

/**
 * Merchant pricing rules namespace — create and manage x402 URL-based pricing rules.
 *
 * A pricing rule maps a glob URL pattern to a price in cents. When a buyer
 * requests a matching URL via the x402 protocol the rule is used to gate access.
 * The domain in `url_pattern` must be verified first via `client.merchant.domains`.
 *
 * Obtain via `client.merchant.pricingRules` — do not construct directly.
 *
 * @example
 * ```ts
 * // List all active rules for a store
 * const rules = await client.merchant.pricingRules.list(storeId)
 *
 * // Create a rule that charges $1.50 for any article page
 * const rule = await client.merchant.pricingRules.create(storeId, {
 *   url_pattern: 'https://example.com/articles/*',
 *   price_cents: 150,
 * })
 *
 * // Deactivate a rule (soft-delete — audit trail is preserved)
 * const deactivated = await client.merchant.pricingRules.deactivate(storeId, rule.id)
 * ```
 */
export class MerchantPricingRulesNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns all active pricing rules for the store, ordered by creation date descending.
   *
   * @param storeId - The merchant store ID.
   * @returns Array of active pricing rules.
   */
  async list(storeId: string): Promise<MerchantPricingRule[]> {
    return this.http.get<MerchantPricingRule[]>(
      `/v1/merchant/${encodeURIComponent(storeId)}/pricing_rules`,
    )
  }

  /**
   * Creates a new active pricing rule for the store.
   *
   * The domain in `url_pattern` must have a verified domain record for this store
   * before a rule can be created (see `client.merchant.domains.add`).
   *
   * @param storeId - The merchant store ID.
   * @param body - The pricing rule to create.
   * @returns The created pricing rule.
   *
   * @example
   * ```ts
   * const rule = await client.merchant.pricingRules.create(storeId, {
   *   url_pattern: 'https://example.com/articles/*',
   *   price_cents: 150,
   * })
   * ```
   */
  async create(
    storeId: string,
    body: MerchantPricingRuleCreateRequest,
  ): Promise<MerchantPricingRule> {
    return this.http.post<MerchantPricingRule>(
      `/v1/merchant/${encodeURIComponent(storeId)}/pricing_rules`,
      body,
    )
  }

  /**
   * Deactivates (soft-deletes) a pricing rule by ID.
   *
   * The rule is immediately excluded from URL matching. Existing content records
   * that reference the rule ID in metadata are not affected — they retain their
   * price at time of creation.
   *
   * @param storeId - The merchant store ID.
   * @param id - UUID of the pricing rule to deactivate.
   * @returns The updated rule with `active: false`.
   */
  async deactivate(storeId: string, id: string): Promise<MerchantPricingRule> {
    return this.http.delete<MerchantPricingRule>(
      `/v1/merchant/${encodeURIComponent(storeId)}/pricing_rules/${encodeURIComponent(id)}`,
    )
  }
}
