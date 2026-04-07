import { AuthError, LedewireError } from '@ledewire/core'
import { LedewireAuthManager } from './auth.js'
import { InsufficientFundsError, NonceExpiredError } from './errors.js'
import { parsePaymentRequired } from './parse.js'
import type { LedewireFetchConfig, LedewirePaymentPayload } from './types.js'

/**
 * Maps an HTTP status code from a paid-request retry to a typed SDK error.
 * Always throws — useful as the final branch in a response handler.
 *
 * @param status - HTTP status of the failed retry response.
 * @param message - Error message extracted from the response body.
 * @throws {InsufficientFundsError} On `422`.
 * @throws {AuthError} On `401`.
 * @throws {LedewireError} For all other statuses.
 */
export function throwPaymentError(status: number, message: string): never {
  if (status === 422) throw new InsufficientFundsError(message)
  if (status === 401) throw new AuthError(message)
  throw new LedewireError(message, status)
}

/**
 * Core Ledewire x402 payment client. Holds buyer credentials, manages the
 * JWT lifecycle, and builds `PAYMENT-SIGNATURE` header values.
 *
 * Use this directly when integrating with HTTP clients other than `fetch`
 * (e.g. Axios, ky, got). For a drop-in `fetch` replacement use
 * {@link createLedewireFetch}; for an Axios instance use
 * {@link wrapAxiosWithPayment}.
 *
 * @example
 * ```ts
 * import { LedewirePaymentClient } from '@ledewire/x402-client'
 *
 * const client = new LedewirePaymentClient({ key, secret })
 *
 * // In a ky `beforeError` hook or any other HTTP client interceptor:
 * if (response.status === 402) {
 *   const sig = await client.buildPaymentSignature(
 *     response.headers.get('PAYMENT-REQUIRED'),
 *     request.url,
 *   )
 *   // retry with PAYMENT-SIGNATURE: sig
 * }
 * ```
 */
export class LedewirePaymentClient {
  /** @internal */
  readonly auth: LedewireAuthManager

  /**
   * @param config - Buyer credentials and optional overrides. The `fetch`
   *   field, when provided, is used only for authentication requests to the
   *   Ledewire API — not for fetching content.
   */
  constructor(config: LedewireFetchConfig) {
    this.auth = new LedewireAuthManager(
      config.key,
      config.secret,
      config.apiBase ?? 'https://api.ledewire.com',
      config.fetch,
    )
  }

  /**
   * Parses a raw `PAYMENT-REQUIRED` header value, authenticates with the
   * buyer API key, and returns the base64-encoded `PAYMENT-SIGNATURE` string
   * ready to set as a request header.
   *
   * A stable UUID is generated per call and included in the payload when the
   * server advertises `payment-identifier` support — enabling safe retries
   * without double-charging.
   *
   * @param paymentRequiredHeader - Raw value of the `PAYMENT-REQUIRED` response header.
   * @param url - Full URL of the resource being purchased.
   *
   * @throws {UnsupportedSchemeError} No `ledewire-wallet` entry in the `accepts` array.
   * @throws {MalformedPaymentRequiredError} Extension block is absent or malformed.
   * @throws {NonceExpiredError} Nonce `expiresAt` is in the past.
   * @throws {AuthError} Buyer API key credentials are invalid.
   */
  async buildPaymentSignature(paymentRequiredHeader: string, url: string): Promise<string> {
    const { paymentRequired, accepted, extension } = parsePaymentRequired(paymentRequiredHeader)

    if (Date.now() / 1000 > accepted.extra.expiresAt) {
      throw new NonceExpiredError()
    }

    if (extension.apiBase) {
      this.auth.apiBase = extension.apiBase
    }

    const token = await this.auth.getAccessToken()

    const supportsPaymentIdentifier = paymentRequired.extensions?.['payment-identifier'] != null

    const paymentPayload: LedewirePaymentPayload = {
      x402Version: 2,
      resource: { url },
      accepted,
      payload: { token, contentId: extension.contentId },
      ...(supportsPaymentIdentifier
        ? { extensions: { 'payment-identifier': crypto.randomUUID() } }
        : undefined),
    }

    return btoa(JSON.stringify(paymentPayload))
  }
}
