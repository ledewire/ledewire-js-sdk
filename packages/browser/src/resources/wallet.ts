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
 * Obtain via `client.wallet` — do not construct directly.
 */
export class BrowserWalletNamespace {
  constructor(protected readonly http: HttpClient) {}

  /**
   * Returns the authenticated buyer's current wallet balance.
   *
   * @returns The current wallet balance in cents.
   */
  async balance(): Promise<WalletBalanceResponse> {
    return this.http.get<WalletBalanceResponse>('/v1/wallet/balance')
  }

  /**
   * Returns the authenticated buyer's wallet transaction history, newest first.
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
    return this.http.get<WalletPaymentStatusResponse>(`/v1/wallet/payment-status/${sessionId}`)
  }
}
