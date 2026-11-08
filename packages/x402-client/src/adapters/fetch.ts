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
 * Wraps a `fetch` function with automatic Ledewire x402 payment handling.
 *
 * On a `402 Payment Required` response with a `PAYMENT-REQUIRED` header,
 * builds a `PAYMENT-SIGNATURE` and retries the original request transparently.
 * All other responses — including any `402` on the FIRST (unpaid) request
 * that carries no `PAYMENT-REQUIRED` header — pass through unchanged; the API
 * never refuses that first request (see ledewire/api#1066).
 *
 * With a {@link LedewirePaymentClient}, only requests to the configured
 * Ledewire API origin are paid: a `402` from any other origin is returned to
 * the caller unpaid, with no login and no retry. A custom
 * {@link PaymentSigner} decides this through its optional `allowsPaymentTo`.
 *
 * **Security note — treat the spend-cap numbers on {@link SpendCapReachedError}
 * as informational.** They come from the response to the paid request, which
 * nothing here verifies independently (and a custom signer may pay other
 * origins). Never change a buyer's LedeWire spend cap based on the fields of
 * an error caught from this wrapper; confirm the real cap and spend first,
 * against the LedeWire API itself, via `user.spendCap.get()`.
 *
 * @example
 * ```ts
 * import { LedewirePaymentClient, wrapFetchWithPayment } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({ paymentKey, maxPriceCents: 500 })
 * const fetch = wrapFetchWithPayment(globalThis.fetch, client)
 *
 * const res = await fetch('https://api.ledewire.com/v1/x402/contents/<content-id>')
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
 */ export function wrapFetchWithPayment(
  fetchFn: typeof globalThis.fetch,
  client: PaymentSigner,
): typeof globalThis.fetch {
  return async function ledewireFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    const firstResponse = await fetchFn(input, init)

    if (firstResponse.status !== 402) {
      return firstResponse
    }

    const paymentRequiredHeader = firstResponse.headers.get('PAYMENT-REQUIRED')
    if (!paymentRequiredHeader) {
      // No challenge to answer, and nothing further to inspect: the API only
      // ever refuses the PAID request (below), never this first one — see
      // ledewire/api#1066. Pass the response through untouched.
      return firstResponse
    }

    if (
      client.allowsPaymentTo &&
      (!client.allowsPaymentTo(url) ||
        (firstResponse.redirected && !client.allowsPaymentTo(firstResponse.url)))
    ) {
      // Not the configured Ledewire API (as asked for, or as answered after a
      // redirect): never pay for it.
      return firstResponse
    }

    // Sign, send, and, only for a refusal the signer chooses to re-sign,
    // sign once more against the fresh challenge. A refused payment charges
    // nothing, so at most one of these attempts can settle.
    let challenge = paymentRequiredHeader
    let paidResponse: Response
    for (let attempt = 1; ; attempt++) {
      const paymentSignature = await client.buildPaymentSignature(challenge, url)

      const paidHeaders = new Headers(init?.headers)
      paidHeaders.set('PAYMENT-SIGNATURE', paymentSignature)

      // redirect: 'error' — PAYMENT-SIGNATURE is a custom header, which fetch
      // keeps on a redirect; never let the paid retry carry it elsewhere.
      paidResponse = await fetchFn(input, { ...init, headers: paidHeaders, redirect: 'error' })

      if (paidResponse.ok) {
        return paidResponse
      }

      const freshChallenge =
        paidResponse.status === 402 ? paidResponse.headers.get('PAYMENT-REQUIRED') : null
      const code = refusalCodeOf(freshChallenge)
      if (!code || !freshChallenge) break

      if (
        attempt < MAX_SIGNED_ATTEMPTS &&
        client.shouldResign?.(code) &&
        sameRecipientAndResource(paymentRequiredHeader, freshChallenge)
      ) {
        challenge = freshChallenge
        continue
      }
      const body: unknown = await paidResponse.json().catch(() => undefined)
      throw paymentRefusedError(code, body)
    }

    // Spec form (x402 v2, api#1066): the PAID request's refusal is a
    // `PAYMENT-RESPONSE` header carrying a SettleResponse with `success: false`.
    // The JSON error body (e.g. a DailySpendCapReachedError body with
    // cap_cents etc.) travels alongside it, read separately below.
    const refusal = parsePaymentRefusal(paidResponse.headers.get('PAYMENT-RESPONSE'))
    const body = await paidResponse.json().catch(() => undefined)

    if (refusal) {
      throwPaymentRefusal(refusal, body)
    }

    // Legacy (pre-api#1066): no PAYMENT-RESPONSE header — the refusal lives
    // directly in the response status/body. Remove once api#1066 ships.
    throwLegacyPaymentError(
      paidResponse.status,
      body,
      parseRetryAfter(paidResponse.headers.get('Retry-After')),
    )
  }
}
