import type { PaymentSigner } from '../types.js'
import { throwPaymentError } from '../payment-client.js'

/**
 * Wraps a `fetch` function with automatic Ledewire x402 payment handling.
 *
 * On a `402 Payment Required` response with a `PAYMENT-REQUIRED` header,
 * builds a `PAYMENT-SIGNATURE` and retries the original request transparently.
 * All other responses pass through unchanged.
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
