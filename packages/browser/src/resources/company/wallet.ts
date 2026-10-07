/**
 * Company wallet balance and funding.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type {
  CompanyPendingTopUpList,
  CompanyWallet,
  WalletPaymentSessionRequest,
  WalletPaymentSessionResponse,
} from '@ledewire/core'

/**
 * Read the Company wallet, fund it, and track top-ups that have not settled.
 * Company admins only.
 *
 * Members never see the Company balance and cannot fund the Company wallet; a
 * member who runs short is refused at purchase and must ask an admin. Even for
 * an admin, `wallet.balance()` reports no Company balance: {@link get} is the
 * only place it appears.
 *
 * Obtain via `client.company.wallet` — do not construct directly.
 *
 * @example
 * ```ts
 * const { balance_cents, held_cents, pending_top_up_cents } = await client.company.wallet.get()
 *
 * const session = await client.company.wallet.createPaymentSession({ amount_cents: 50000 })
 * // Confirm with session.client_secret in the payment widget, as for a personal top-up.
 *
 * const { data: pending } = await client.company.wallet.listPendingTopUps()
 * ```
 */
export class CompanyWalletNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Reads the Company wallet: the spendable `balance_cents` (money held by
   * in-flight Bulk acquisitions is already out of it, and it goes negative when
   * a reversed top-up takes the wallet below zero), `held_cents` committed to
   * Company-paid Bulk acquisitions still in progress, and
   * `pending_top_up_cents`, the total of {@link listPendingTopUps}.
   *
   * @returns The Company wallet.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {NotFoundError} When the caller belongs to no Company.
   */
  async get(): Promise<CompanyWallet> {
    return this.http.get<CompanyWallet>('/v1/company/wallet')
  }

  /**
   * Starts a Company wallet top-up, by card or ACH (`us_bank_account`). Confirm
   * it client-side with the returned `client_secret`, as for a personal top-up.
   *
   * The top-up is spendable only once it settles: a card usually settles at
   * once, an ACH debit after about four business days. Starting another top-up
   * never cancels an ACH debit already processing. Track it with
   * {@link listPendingTopUps}: a top-up drops off that list once it settles.
   * (`wallet.getPaymentStatus()` covers personal top-ups only and does not
   * find a Company session.)
   *
   * @param body - The amount to fund.
   * @returns Payment session details for the payment provider widget.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   * @throws {LedewireError} With `statusCode === 402` when the payment provider
   *   refused to create the session.
   */
  async createPaymentSession(
    body: WalletPaymentSessionRequest,
  ): Promise<WalletPaymentSessionResponse> {
    return this.http.post<WalletPaymentSessionResponse>('/v1/company/wallet/payment-session', body)
  }

  /**
   * Lists the Company's top-ups that are not yet spendable, newest first:
   * `pending` (a session not yet paid), `awaiting_verification` (a bank account
   * whose microdeposits are not yet confirmed, up to ten days), and
   * `processing` (an ACH debit under way).
   *
   * @returns The pending top-ups.
   * @throws {ForbiddenError} When the caller is not a Company admin.
   */
  async listPendingTopUps(): Promise<CompanyPendingTopUpList> {
    return this.http.get<CompanyPendingTopUpList>('/v1/company/wallet/pending-top-ups')
  }
}
