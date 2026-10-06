/**
 * Buyer daily spend cap namespace.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { UserSpendCap, UserSpendCapUpdateRequest } from '@ledewire/core'

/**
 * Manage the authenticated buyer's daily spend cap.
 *
 * Every new buyer starts with a default cap, so `null` on {@link
 * UserSpendCapNamespace.update} is the only way to become uncapped — there is no
 * separate "remove the cap" call. While capped, `cap_cents` and `remaining_cents`
 * are numbers; once uncapped, both read back as `null` because there is no ceiling
 * to report or subtract from.
 *
 * The cap governs every wallet debit the buyer makes — MCP, REST, or the web
 * payment gate — over a rolling window bounded by `spend_window_timezone` (an IANA
 * zone, UTC by default) and reset at `resets_at`. `bulk_exempt` says whether this
 * buyer's bulk acquisitions are excluded from that spend, in which case
 * `spent_cents` / `remaining_cents` describe ordinary purchases only.
 *
 * **Exceeding the cap throws {@link SpendCapReachedError}** (HTTP 402) from
 * `client.purchases.create()` and the x402 content gate. Funding the wallet does not
 * clear it — the buyer must wait for the window to roll at `resets_at`, or the cap
 * must be raised or cleared here.
 *
 * Obtain via `client.user.spendCap` — do not construct directly.
 *
 * @example
 * ```ts
 * const cap = await client.user.spendCap.get()
 * if (cap.remaining_cents !== null && cap.remaining_cents < 500) {
 *   console.warn(`Only ${cap.remaining_cents}c left before the cap resets at ${cap.resets_at}`)
 * }
 *
 * // Raise the cap to $20/day
 * await client.user.spendCap.update({ daily_spend_limit_cents: 2000 })
 *
 * // Remove the cap entirely (become uncapped)
 * await client.user.spendCap.update({ daily_spend_limit_cents: null })
 * ```
 */
export class UserSpendCapNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns the authenticated buyer's spend cap, read against the current spend
   * window.
   *
   * For a buyer with an open Company membership this is the membership's cap —
   * read in the Company's timezone, counting only spend paid through the
   * membership, never uncapped, and always binding bulk acquisitions
   * (`bulk_exempt: false`). `company_name` names the Company; it is `null` for
   * anyone else.
   *
   * @returns The current spend cap, spend-to-date, and reset time.
   */
  async get(): Promise<UserSpendCap> {
    return this.http.get<UserSpendCap>('/v1/user/spend-cap')
  }

  /**
   * Sets or clears the authenticated buyer's daily spend cap.
   *
   * `daily_spend_limit_cents` is required and nullable: pass a number to set the
   * cap, or `null` to remove it (the only way to become uncapped). A cap set below
   * spend already made in the current window is accepted — it just leaves
   * `remaining_cents` at zero until the window rolls.
   *
   * @param body - The new cap in whole cents, or `null` to remove it.
   * @returns The updated spend cap.
   * @throws {ForbiddenError} When the buyer holds an open Company membership. A
   *   member's cap — an admin's own included — is set by a Company admin through
   *   `company.members.update()`.
   */
  async update(body: UserSpendCapUpdateRequest): Promise<UserSpendCap> {
    return this.http.patch<UserSpendCap>('/v1/user/spend-cap', body)
  }
}
