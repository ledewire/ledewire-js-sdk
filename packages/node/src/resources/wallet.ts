import type { HttpClient } from '@ledewire/core'
import type {
  WalletBalanceResponse,
  WalletPaymentSessionRequest,
  WalletPaymentSessionResponse,
  WalletPaymentStatusResponse,
  WalletTransactionItem,
} from '@ledewire/core'

/**
 * Buyer wallet namespace — balance, transactions, and payment session management.
 *
 * @example
 * ```ts
 * const { balance_cents } = await client.wallet.balance()
 * const session = await client.wallet.createPaymentSession({ amount_cents: 500 })
 * ```
 */
export class WalletNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns the authenticated buyer's current wallet balance.
   *
   * `balance_cents` and `spendable_cents` are always the same number —
   * `balance_cents` has always meant "what you can spend," and money committed to
   * a bulk acquisition is a hold, which moves it out of the wallet rather than
   * annotating it. `held_cents` is the total currently committed to active bulk
   * acquisitions and not yet spent or released, and `holds` lists one entry per
   * such acquisition (`acquisition_id`, `held_cents`, `authorized_at`) so a buyer
   * mid-acquisition can see why their balance is lower than their purchase
   * history explains.
   *
   * @returns The current wallet balance in cents, including held funds detail.
   */
  async balance(): Promise<WalletBalanceResponse> {
    return this.http.get<WalletBalanceResponse>('/v1/wallet/balance')
  }

  /**
   * Returns the authenticated buyer's wallet transaction history, newest first.
   *
   * `bulk_acquisition` and `bulk_hold` are each a single entry for a whole bulk
   * acquisition — its per-work purchases are deliberately not listed here,
   * because one acquisition can hold tens of thousands of them and they describe
   * one decision. A `bulk_hold` entry is an acquisition still holding funds (money
   * left the wallet but has not been spent); it becomes a `bulk_acquisition` entry
   * for the amount actually captured once the acquisition ends, and an
   * acquisition never produces both. Note that a bulk acquisition's per-work
   * purchases each carry a display `price_cents` that is **not summable** — bulk
   * prices at micro precision and rounds to cents once, on the acquisition total,
   * so `amount_cents` on the `bulk_acquisition` / `bulk_hold` entry is the figure
   * to read.
   *
   * @returns A list of completed wallet transaction entries.
   */
  async transactions(): Promise<WalletTransactionItem[]> {
    return this.http.get<WalletTransactionItem[]>('/v1/wallet/transactions')
  }

  /**
   * Creates a payment session for funding the buyer's wallet.
   *
   * @param body - The amount and currency to fund.
   * @returns Payment session details for use with the payment provider widget.
   */
  async createPaymentSession(
    body: WalletPaymentSessionRequest,
  ): Promise<WalletPaymentSessionResponse> {
    return this.http.post<WalletPaymentSessionResponse>('/v1/wallet/payment-session', body)
  }

  /**
   * Polls the status of a wallet funding payment session.
   *
   * @param sessionId - The session ID returned by `createPaymentSession`.
   * @returns The current payment status.
   */
  async getPaymentStatus(sessionId: string): Promise<WalletPaymentStatusResponse> {
    return this.http.get<WalletPaymentStatusResponse>(
      `/v1/wallet/payment-status/${encodeURIComponent(sessionId)}`,
    )
  }
}
