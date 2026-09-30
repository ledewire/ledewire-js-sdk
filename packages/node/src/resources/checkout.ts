import type { HttpClient } from '@ledewire/core'
import type { CheckoutStateResponse } from '@ledewire/core'

/**
 * Checkout namespace — buyer checkout state for a specific content item.
 *
 * @example
 * ```ts
 * const state = await client.checkout.state('content-id')
 * // state.checkout_state.next_required_action:
 * // 'authenticate' | 'fund_wallet' | 'purchase'
 * //
 * // Single-use model: a completed purchase does not imply access, so
 * // 'purchase' can still be the next action even when has_purchased is
 * // true. Buying delivers the content directly in the POST /v1/purchases
 * // response — there is no separate "view content" step.
 * ```
 */
export class CheckoutNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns the authenticated buyer's checkout readiness for a given piece of
   * content. Indicates whether the buyer needs to authenticate, fund their
   * wallet, or purchase before accessing the content.
   *
   * Works without authentication — returns anonymous checkout state when the
   * buyer is not logged in.
   *
   * @param contentId - The content item ID.
   * @returns The checkout state, including what action is required next.
   */
  async state(contentId: string): Promise<CheckoutStateResponse> {
    return this.http.get<CheckoutStateResponse>(
      `/v1/checkout/state/${encodeURIComponent(contentId)}`,
    )
  }
}
