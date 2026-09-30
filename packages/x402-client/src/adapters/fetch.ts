import type { PaymentSigner } from '../types.js'
import { throwPaymentError } from '../payment-client.js'
import { spendCapErrorFromBody } from '@ledewire/core'

/**
 * Wraps a `fetch` function with automatic Ledewire x402 payment handling.
 *
 * On a `402 Payment Required` response with a `PAYMENT-REQUIRED` header,
 * builds a `PAYMENT-SIGNATURE` and retries the original request transparently.
 * All other responses pass through unchanged.
 *
 * **Security note — the spend-cap numbers on {@link SpendCapReachedError} are
 * untrusted.** This wrapper fetches arbitrary third-party URLs, so a
 * `daily_spend_cap_reached` 402 body can come from *any* server the caller
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
 * @throws {InsufficientFundsError} When the buyer wallet has insufficient funds.
 * @throws {AuthError} When buyer API key authentication fails.
 * @throws {SpendCapReachedError} When a `402` carries no `PAYMENT-REQUIRED` header and
 *   its body is a daily-spend-cap-reached refusal — retrying or funding the wallet
 *   cannot clear this, so there is nothing to challenge.
 * @throws {LedewireError} For other Ledewire API error responses.
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
      // No challenge to answer. Check for the one refusal that looks like this:
      // a daily-spend-cap 402 that funding or retrying cannot clear. Clone
      // first so an unmatched body is still readable by the caller.
      const body = await firstResponse
        .clone()
        .json()
        .catch(() => undefined)
      const spendCapError = spendCapErrorFromBody(body)
      if (spendCapError) {
        throw spendCapError
      }
      return firstResponse
    }

    const paymentSignature = await client.buildPaymentSignature(paymentRequiredHeader, url)

    const paidHeaders = new Headers(init?.headers)
    paidHeaders.set('PAYMENT-SIGNATURE', paymentSignature)

    const paidResponse = await fetchFn(input, { ...init, headers: paidHeaders })

    if (paidResponse.ok) {
      return paidResponse
    }

    const errorBody = await paidResponse.json().catch(() => ({}))
    const raw = (errorBody as Record<string, unknown>)['error']
    const message =
      typeof raw === 'string' ? raw : `Payment failed (${String(paidResponse.status)})`
    throwPaymentError(paidResponse.status, message)
  } as typeof globalThis.fetch
}
