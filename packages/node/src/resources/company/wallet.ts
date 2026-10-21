/**
 * Company wallet namespace: balances, pending top-ups, and funding.
 *
 * @module
 */
import type {
  HttpClient,
  CompanyWallet,
  CompanyPendingTopUpList,
  CompanyWalletPaymentSessionRequest,
  WalletPaymentSessionResponse,
} from '@ledewire/core'

/**
 * The Company wallet, which pays for member purchases. Every call requires Company
 * admin rights. Members never see the balance; `get()` is the only place it appears.
 *
 * Top-ups are spendable only once they settle. A card usually settles at once, and
 * an ACH debit takes about four business days.
 *
 * Obtain via `client.company.wallet` — do not construct directly.
 *
 * @example
 * ```ts
 * const wallet = await client.company.wallet.get()
 * console.log(`Spendable: ${wallet.balance_cents} cents`)
 *
 * // Fund it by card or ACH, then confirm client-side with client_secret
 * const session = await client.company.wallet.createPaymentSession({ amount_cents: 10000 })
 * ```
 */
export class CompanyWalletNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Returns the Company wallet: spendable balance, held funds, pending top-ups, and
   * the Company name.
   *
   * @returns The Company wallet.
   */
  async get(): Promise<CompanyWallet> {
    return this.http.get<CompanyWallet>('/v1/company/wallet')
  }

  /**
   * Lists top-ups that are not yet spendable, newest first. `pending` is a session
   * not yet paid, `awaiting_verification` is a bank account awaiting microdeposit
   * confirmation, and `processing` is an ACH debit under way.
   *
   * @returns The pending top-up envelope (`{ data }`).
   */
  async listPendingTopUps(): Promise<CompanyPendingTopUpList> {
    return this.http.get<CompanyPendingTopUpList>('/v1/company/wallet/pending-top-ups')
  }

  /**
   * Starts a Company wallet top-up. Confirm the returned `client_secret` client-side,
   * as for a personal top-up. Starting another top-up never cancels an ACH debit that
   * is already processing.
   *
   * @param body - `amount_cents`, plus optional `currency` and `metadata`.
   * @returns The payment session to confirm client-side.
   *
   * @example
   * ```ts
   * const { client_secret, session_id } = await client.company.wallet.createPaymentSession({
   *   amount_cents: 5000,
   * })
   * ```
   */
  async createPaymentSession(
    body: CompanyWalletPaymentSessionRequest,
  ): Promise<WalletPaymentSessionResponse> {
    return this.http.post<WalletPaymentSessionResponse>('/v1/company/wallet/payment-session', body)
  }
}
