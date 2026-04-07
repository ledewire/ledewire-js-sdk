import type { AxiosError, AxiosInstance } from 'axios'
import type { PaymentSigner } from '../types.js'
import { throwPaymentError } from '../payment-client.js'

/**
 * Adds a Ledewire x402 payment interceptor to an Axios instance.
 *
 * Intercepts `402 Payment Required` responses, builds a `PAYMENT-SIGNATURE`,
 * and retries the original request using the same Axios config. Returns the
 * same instance (mutated in-place) so calls can be chained.
 *
 * Requires `axios` to be installed as a peer dependency.
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
