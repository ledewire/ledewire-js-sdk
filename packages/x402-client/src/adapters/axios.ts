import type { AxiosError, AxiosInstance } from 'axios'
import type { PaymentSigner } from '../types.js'
import { throwLegacyPaymentError, throwPaymentRefusal } from '../payment-client.js'
import { parsePaymentRefusal } from '../parse.js'

/**
 * Adds a Ledewire x402 payment interceptor to an Axios instance.
 *
 * Intercepts `402 Payment Required` responses, builds a `PAYMENT-SIGNATURE`,
 * and retries the original request using the same Axios config. Returns the
 * same instance (mutated in-place) so calls can be chained.
 *
 * Requires `axios` to be installed as a peer dependency.
 *
 * Any `402` on the FIRST (unpaid) request that carries no `payment-required`
 * header passes through unchanged (rejects with the original Axios error) —
 * the API never refuses that first request (see ledewire/api#1066).
 *
 * **Security note — the spend-cap numbers on {@link SpendCapReachedError} are
 * untrusted.** This wrapper intercepts responses for arbitrary third-party
 * URLs, so a `daily_spend_cap_reached` refusal can come from *any* server
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
 * @throws {InsufficientFundsError} PAID request refused with `insufficient_funds`
 *   (spec form), or a legacy `422` (pre-api#1066).
 * @throws {AuthError} PAID request refused with `invalid_ledewire_wallet_payload_token`
 *   (spec form), or a legacy `401` (pre-api#1066).
 * @throws {ForbiddenError} PAID request refused with `invalid_ledewire_wallet_payload_role`
 *   (spec form), or a legacy `403` (pre-api#1066).
 * @throws {SpendCapReachedError} PAID request refused with `daily_spend_cap_reached`
 *   (spec form), or a legacy `402` spend-cap body (pre-api#1066) — retrying or
 *   funding the wallet cannot clear this, so there is nothing to re-challenge.
 * @throws {LedewireError} For other Ledewire API error responses; `err.type` carries
 *   the raw `errorReason` for an unrecognized spec-form refusal.
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
        // No challenge to answer, and nothing further to inspect: the API
        // only ever refuses the PAID request (below), never this first one —
        // see ledewire/api#1066. Reject with the original Axios error.
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
        const retryHeaders = axiosRetryError.response?.headers
        const errorData = axiosRetryError.response?.data as Record<string, unknown> | undefined

        // Spec form (x402 v2, api#1066): the PAID request's refusal is a
        // `payment-response` header carrying a SettleResponse with
        // `success: false`. The JSON error body (e.g. a DailySpendCapReachedError
        // body with cap_cents etc.) travels alongside it, in `errorData`.
        const paymentResponseHeader = retryHeaders?.['payment-response'] as string | undefined
        const refusal = parsePaymentRefusal(paymentResponseHeader ?? null)
        if (refusal) {
          throwPaymentRefusal(refusal, errorData)
        }

        // Legacy (pre-api#1066): no payment-response header — the refusal
        // lives directly in the response status/body. Remove once api#1066 ships.
        throwLegacyPaymentError(retryStatus, errorData)
      }
    },
  )

  return instance
}
