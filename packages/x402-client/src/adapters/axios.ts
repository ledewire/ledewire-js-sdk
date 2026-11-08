import type { AxiosError, AxiosInstance } from 'axios'
import type { PaymentSigner } from '../types.js'
import { parseRetryAfter } from '@ledewire/core'
import {
  paymentRefusedError,
  throwLegacyPaymentError,
  throwPaymentRefusal,
} from '../payment-client.js'
import { parsePaymentRefusal, refusalCodeOf, sameRecipientAndResource } from '../parse.js'

/** One signed payment, plus at most one re-signed one after a refusal. */
const MAX_SIGNED_ATTEMPTS = 2

/**
 * Adds a Ledewire x402 payment interceptor to an Axios instance.
 *
 * Intercepts `402 Payment Required` responses, builds a `PAYMENT-SIGNATURE`,
 * and retries the original request using the same Axios config. Returns the
 * same instance (mutated in-place) so calls can be chained.
 *
 * With a {@link LedewirePaymentClient}, only requests to the configured
 * Ledewire API origin are paid (the full URL is resolved with
 * `instance.getUri()`, so `baseURL` is honoured): a `402` from any other
 * origin rejects with the original Axios error, with no login and no retry.
 * A custom {@link PaymentSigner} decides this through its optional
 * `allowsPaymentTo`.
 *
 * Requires `axios` to be installed as a peer dependency. `maxRedirects: 0` is
 * enforced by Axios's Node adapter only; a browser's XHR follows redirects
 * regardless, so in browsers prefer {@link wrapFetchWithPayment}, whose paid
 * retry uses `redirect: 'error'`.
 *
 * Any `402` on the FIRST (unpaid) request that carries no `payment-required`
 * header passes through unchanged (rejects with the original Axios error) —
 * the API never refuses that first request (see ledewire/api#1066).
 *
 * **Security note — treat the spend-cap numbers on {@link SpendCapReachedError}
 * as informational.** They come from the response to the paid request, which
 * nothing here verifies independently (and a custom signer may pay other
 * origins). Never change a buyer's LedeWire spend cap based on the fields of
 * an error caught from this interceptor; confirm the real cap and spend
 * first, against the LedeWire API itself, via `user.spendCap.get()`.
 *
 * @example
 * ```ts
 * import axios from 'axios'
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 * import { wrapAxiosWithPayment } from '@ledewire/x402-client/axios'
 *
 * const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })
 * const api = wrapAxiosWithPayment(axios.create(), client)
 *
 * const res = await api.get('https://api.ledewire.com/v1/x402/contents/<content-id>')
 * ```
 *
 * @throws {UnsupportedSchemeError} When the `402` is not a `ledewire-wallet` challenge.
 * @throws {MalformedPaymentRequiredError} When the server's `PAYMENT-REQUIRED` is malformed.
 * @throws {PriceAboveMaximumError} When the price is above `maxPriceCents`, first or after
 *   an `amount_mismatch`; nothing more is signed.
 * @throws {PaymentRefusedError} When the API refuses the signed payment and it is not
 *   re-signed; `refusal` (and `type`) names the code.
 * @throws {InsufficientFundsError} PAID request refused with `422`, or a `PAYMENT-RESPONSE`
 *   `insufficient_funds` refusal.
 * @throws {SpendCapReachedError} PAID request answered with a `402` spend-cap body (no
 *   `PAYMENT-REQUIRED`) — retrying or funding the wallet cannot clear this.
 * @throws {RateLimitError} PAID request refused with `429`, with `retryAfter`.
 * @throws {LedewireError} For other Ledewire API error responses, e.g. `400 Malformed
 *   PAYMENT-SIGNATURE header`.
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
      // The paid retry runs back through this interceptor. If it is challenged
      // again, hand the 402 to the caller rather than pay a second time:
      // every attempt would be a separate payment.
      if (originalConfig.headers.has('PAYMENT-SIGNATURE')) {
        return Promise.reject(error)
      }
      // Resolve baseURL + url (+ params) to the absolute URL actually requested.
      const url = instance.getUri(originalConfig)

      if (client.allowsPaymentTo && !client.allowsPaymentTo(url)) {
        // Not the configured Ledewire API: never pay or authenticate for it.
        return Promise.reject(error)
      }

      // Sign, send, and, only for a refusal the signer chooses to re-sign,
      // sign once more against the fresh challenge. A refused payment charges
      // nothing, so at most one of these attempts can settle. The paid
      // request re-enters this interceptor, which hands its 402 straight back
      // (it carries PAYMENT-SIGNATURE) so the decision is made only here.
      let challenge = paymentRequiredHeader
      for (let attempt = 1; ; attempt++) {
        const paymentSignature = await client.buildPaymentSignature(challenge, url)
        originalConfig.headers.set('PAYMENT-SIGNATURE', paymentSignature)

        try {
          // maxRedirects: 0 — never let the paid retry carry PAYMENT-SIGNATURE
          // to another location.
          return await instance.request({ ...originalConfig, maxRedirects: 0 })
        } catch (retryError) {
          const axiosRetryError = retryError as AxiosError
          const retryStatus = axiosRetryError.response?.status ?? 0
          const retryHeaders = axiosRetryError.response?.headers
          const errorData = axiosRetryError.response?.data as Record<string, unknown> | undefined

          const freshChallenge =
            retryStatus === 402
              ? (retryHeaders?.['payment-required'] as string | undefined)
              : undefined
          const code = refusalCodeOf(freshChallenge)
          if (code && freshChallenge) {
            if (
              attempt < MAX_SIGNED_ATTEMPTS &&
              client.shouldResign?.(code) &&
              sameRecipientAndResource(paymentRequiredHeader, freshChallenge)
            ) {
              challenge = freshChallenge
              continue
            }
            throw paymentRefusedError(code, errorData)
          }

          // Spec form (x402 v2, api#1066): a `payment-response` header carrying
          // a SettleResponse with `success: false`. The JSON error body (e.g. a
          // DailySpendCapReachedError body with cap_cents etc.) is `errorData`.
          const paymentResponseHeader = retryHeaders?.['payment-response'] as string | undefined
          const refusal = parsePaymentRefusal(paymentResponseHeader ?? null)
          if (refusal) {
            throwPaymentRefusal(refusal, errorData)
          }

          // Legacy (pre-api#1066): no payment-response header — the refusal
          // lives directly in the response status/body.
          const retryAfterHeader = retryHeaders?.['retry-after'] as string | undefined
          throwLegacyPaymentError(retryStatus, errorData, parseRetryAfter(retryAfterHeader))
        }
      }
    },
  )

  return instance
}
