import type {
  LedewirePaymentRequired,
  LedewirePaymentRequirements,
  LedewireWalletExtension,
} from './types.js'
import { MalformedPaymentRequiredError, UnsupportedSchemeError } from './errors.js'

const SCHEME = 'ledewire-wallet'
const NETWORK = 'ledewire:v1'

/**
 * Decode and parse the raw `PAYMENT-REQUIRED` header value into a typed
 * `LedewirePaymentRequired` object.
 *
 * @throws {UnsupportedSchemeError} When no `ledewire-wallet` scheme entry exists.
 * @throws {MalformedPaymentRequiredError} When the extension block is absent or incomplete.
 */
export function parsePaymentRequired(headerValue: string): {
  paymentRequired: LedewirePaymentRequired
  accepted: LedewirePaymentRequirements
  extension: LedewireWalletExtension
} {
  let paymentRequired: LedewirePaymentRequired
  try {
    paymentRequired = JSON.parse(atob(headerValue)) as LedewirePaymentRequired
  } catch {
    throw new MalformedPaymentRequiredError('PAYMENT-REQUIRED header is not valid base64 JSON')
  }

  const accepted = paymentRequired.accepts.find((r) => r.scheme === SCHEME && r.network === NETWORK)
  if (!accepted) {
    throw new UnsupportedSchemeError(
      `No ${SCHEME}/${NETWORK} entry in PAYMENT-REQUIRED accepts array`,
    )
  }

  const raw = paymentRequired.extensions?.[SCHEME]
  if (!raw || typeof raw !== 'object') {
    throw new MalformedPaymentRequiredError(
      `extensions.${SCHEME} block is missing from PAYMENT-REQUIRED`,
    )
  }
  const ext = raw as Record<string, unknown>
  if (!ext['apiBase'] || !ext['authEndpoint'] || !ext['schemeVersion'] || !ext['contentId']) {
    throw new MalformedPaymentRequiredError(
      `extensions.${SCHEME} is missing required fields (apiBase, authEndpoint, schemeVersion, contentId)`,
    )
  }

  return {
    paymentRequired,
    accepted,
    extension: raw as LedewireWalletExtension,
  }
}

/**
 * Decode the `PAYMENT-RESPONSE` header returned on a successful `200`.
 * Returns `null` for free content where the header is omitted.
 */
export function parsePaymentResponse(headerValue: string | null): {
  accessToken?: string | null
} | null {
  if (!headerValue) return null
  try {
    return JSON.parse(atob(headerValue)) as { accessToken?: string | null }
  } catch {
    return null
  }
}
