import type { PaymentSigner } from '../types.js'
import { throwLegacyPaymentError, throwPaymentRefusal } from '../payment-client.js'
import { parsePaymentRefusal } from '../parse.js'

/**
 * Wraps a `fetch` function with automatic Ledewire x402 payment handling.
 *
 * On a `402 Payment Required` response with a `PAYMENT-REQUIRED` header,
 * builds a `PAYMENT-SIGNATURE` and retries the original request transparently.
 * All other responses — including any `402` on the FIRST (unpaid) request
 * that carries no `PAYMENT-REQUIRED` header — pass through unchanged; the API
 * never refuses that first request (see ledewire/api#1066).
 *
 * **Security note — the spend-cap numbers on {@link SpendCapReachedError} are
 * untrusted.** This wrapper fetches arbitrary third-party URLs, so a
 * `daily_spend_cap_reached` refusal can come from *any* server the caller
 * points it at, not only LedeWire's API — nothing here verifies it. Never
 * change a buyer's LedeWire spend cap based on the fields of an error caught
 * from this wrapper; confirm the real cap and spend first, against the
 * LedeWire API itself, via `user.spendCap.get()`.
 *
 * @example
 * ```ts
 * import { LedewirePaymentClient, wrapFetchWithPayment } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({ key, secret })
 * const fetch = wrapFetchWithPayment(globalThis.fetch, client)
 *
 * const res = await fetch('https://blog.example.com/posts/article')
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
export function wrapFetchWithPayment(
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

    const paymentSignature = await client.buildPaymentSignature(paymentRequiredHeader, url)

    const paidHeaders = new Headers(init?.headers)
    paidHeaders.set('PAYMENT-SIGNATURE', paymentSignature)

    const paidResponse = await fetchFn(input, { ...init, headers: paidHeaders })

    if (paidResponse.ok) {
      return paidResponse
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
    throwLegacyPaymentError(paidResponse.status, body)
  } as typeof globalThis.fetch
}
