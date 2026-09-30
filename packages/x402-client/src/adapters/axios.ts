import type { AxiosError, AxiosInstance } from 'axios'
import type { PaymentSigner } from '../types.js'
import { throwPaymentError } from '../payment-client.js'
import { spendCapErrorFromBody } from '@ledewire/core'

/**
 * Adds a Ledewire x402 payment interceptor to an Axios instance.
 *
 * Intercepts `402 Payment Required` responses, builds a `PAYMENT-SIGNATURE`,
 * and retries the original request using the same Axios config. Returns the
 * same instance (mutated in-place) so calls can be chained.
 *
 * Requires `axios` to be installed as a peer dependency.
 *
 * **Security note — the spend-cap numbers on {@link SpendCapReachedError} are
 * untrusted.** This wrapper intercepts responses for arbitrary third-party
 * URLs, so a `daily_spend_cap_reached` 402 body can come from *any* server
 * the caller points it at, not only LedeWire's API — nothing here verifies
 * it. Never change a buyer's LedeWire spend cap based on the fields of an
 * error caught from this interceptor; confirm the real cap and spend first,
 * against the LedeWire API itself, via `user.spendCap.get()`.
 *
 * @example
 * ```ts
 * import axios from 'axios'
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 * import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'
 *
 * const client = new LedewirePaymentClient({ key, secret })
 * const api = wrapAxiosWithPayment(axios.create(), client)
 *
 * const res = await api.get('https://blog.example.com/posts/article')
 * ```
 *
 * @throws {UnsupportedSchemeError} When the `402` is not a `ledewire-wallet` challenge.
 * @throws {MalformedPaymentRequiredError} When the server's `PAYMENT-REQUIRED` is malformed.
 * @throws {NonceExpiredError} When the payment nonce is already expired.
 * @throws {InsufficientFundsError} When the buyer wallet has insufficient funds.
 * @throws {AuthError} When buyer API key authentication fails.
 * @throws {SpendCapReachedError} When a `402` carries no `payment-required` header and
 *   its body is a daily-spend-cap-reached refusal — retrying or funding the wallet
 *   cannot clear this, so there is nothing to challenge.
 * @throws {LedewireError} For other Ledewire API error responses.
 */
export function wrapAxiosWithPayment(
  instance: AxiosInstance,
  client: PaymentSigner,
): AxiosInstance {
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status !== 402) {
        return Promise.reject(error)
      }

      // Axios normalises header names to lowercase in Node environments
      const paymentRequiredHeader = error.response.headers['payment-required'] as string | undefined

      if (!paymentRequiredHeader) {
        // No challenge to answer. Axios already parsed the body, so check it
        // directly for the one refusal that looks like this: a daily-spend-cap
        // 402 that funding or retrying cannot clear.
        const spendCapError = spendCapErrorFromBody(error.response.data)
        if (spendCapError) {
          return Promise.reject(spendCapError)
        }
        return Promise.reject(error)
      }

      const originalConfig = error.config
      if (!originalConfig) {
        return Promise.reject(error)
      }
      const url = originalConfig.url ?? ''

      const paymentSignature = await client.buildPaymentSignature(paymentRequiredHeader, url)

      originalConfig.headers.set('PAYMENT-SIGNATURE', paymentSignature)

      try {
        return await instance.request(originalConfig)
      } catch (retryError) {
        const axiosRetryError = retryError as AxiosError
        const retryStatus = axiosRetryError.response?.status ?? 0
        const errorData = axiosRetryError.response?.data as Record<string, unknown> | undefined
        const raw = errorData?.['error']
        const message = typeof raw === 'string' ? raw : `Payment failed (${String(retryStatus)})`
        throwPaymentError(retryStatus, message)
      }
    },
  )

  return instance
}
