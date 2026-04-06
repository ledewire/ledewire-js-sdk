import { AuthError, LedewireError } from '@ledewire/core'
import { LedewireAuthManager } from './auth.js'
import {
  MalformedPaymentRequiredError,
  NonceExpiredError,
  InsufficientFundsError,
  UnsupportedSchemeError,
} from './errors.js'
import { parsePaymentRequired } from './parse.js'
import type { LedewireFetchConfig, LedewirePaymentPayload } from './types.js'

/**
 * Creates a `fetch`-compatible function that automatically handles x402
 * `ledewire-wallet` payment challenges.
 *
 * When a `402 Payment Required` response is received with a `ledewire-wallet`
 * scheme, the wrapper:
 * 1. Authenticates with the buyer API key to obtain a JWT (cached, auto-refreshed).
 * 2. Constructs and base64-encodes a `PAYMENT-SIGNATURE` header.
 * 3. Retries the original request with the payment attached.
 *
 * The calling code sees only the final `200` response — the payment round-trip
 * is fully transparent.
 *
 * @example
 * ```ts
 * import { createLedewireFetch } from '@ledewire/x402-client'
 *
 * const fetch = createLedewireFetch({ key: 'bktst_...', secret: '...' })
 *
 * const res = await fetch('https://blog.example.com/posts/article')
 * const content = await res.json()
 * ```
 *
 * @throws {UnsupportedSchemeError} When the `402` is not a `ledewire-wallet` challenge.
 * @throws {MalformedPaymentRequiredError} When the server's `PAYMENT-REQUIRED` is malformed.
 * @throws {NonceExpiredError} When the payment nonce is already expired.
 * @throws {InsufficientFundsError} When the buyer wallet has insufficient funds.
 * @throws {AuthError} When buyer API key authentication fails.
 * @throws {LedewireError} For other API error responses (400, 401, 403, 404, 429).
 */
export function createLedewireFetch(config: LedewireFetchConfig): typeof globalThis.fetch {
  const fetchFn = config.fetch ?? globalThis.fetch
  const auth = new LedewireAuthManager(
    config.key,
    config.secret,
    config.apiBase ?? 'https://api.ledewire.com',
    fetchFn,
  )

  return async function ledewireFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    // First attempt — no payment header
    const firstResponse = await fetchFn(input, init)

    if (firstResponse.status !== 402) {
      return firstResponse
    }

    const paymentRequiredHeader = firstResponse.headers.get('PAYMENT-REQUIRED')
    if (!paymentRequiredHeader) {
      // 402 without PAYMENT-REQUIRED header — not an x402 challenge
      return firstResponse
    }

    // Parse and validate the PAYMENT-REQUIRED header
    const { accepted, extension } = parsePaymentRequired(paymentRequiredHeader)

    // Validate nonce has not expired (expiresAt is Unix seconds)
    if (Date.now() / 1000 > accepted.extra.expiresAt) {
      throw new NonceExpiredError()
    }

    // Allow the server-provided apiBase to override the configured one
    if (extension.apiBase) {
      auth.apiBase = extension.apiBase
    }

    // Obtain a valid buyer JWT
    const token = await auth.getAccessToken()

    // Build the PaymentPayload
    const paymentPayload: LedewirePaymentPayload = {
      x402Version: 2,
      resource: { url },
      accepted,
      payload: {
        token,
        contentId: extension.contentId,
      },
    }

    const paymentSignature = btoa(JSON.stringify(paymentPayload))

    // Retry with PAYMENT-SIGNATURE
    const paidHeaders = new Headers(init?.headers)
    paidHeaders.set('PAYMENT-SIGNATURE', paymentSignature)

    const paidResponse = await fetchFn(input, { ...init, headers: paidHeaders })

    if (paidResponse.ok) {
      return paidResponse
    }

    // Map payment-specific errors to typed SDK errors
    const errorBody = await paidResponse.json().catch(() => ({}))
    const rawMessage = (errorBody as Record<string, unknown>)['error']
    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : `Payment failed (${String(paidResponse.status)})`

    if (paidResponse.status === 422) {
      throw new InsufficientFundsError(message)
    }
    if (paidResponse.status === 401) {
      throw new AuthError(message)
    }
    throw new LedewireError(message, paidResponse.status)
  } as typeof globalThis.fetch
}

export {
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  NonceExpiredError,
  InsufficientFundsError,
}
