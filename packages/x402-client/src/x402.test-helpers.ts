/*
 * Shared fixtures for the x402-client tests. Every key here is generated fresh
 * when the tests load; the only fixed key anywhere in the tests is the scheme
 * page's published test vector, in `signing.test.ts`.
 */
import { decodeJsonHeader, encodeJsonHeader, base64urlDecode } from './encoding.js'
import { generatePaymentKey, signedAuthorizationBytes, verifyEd25519 } from './signing.js'
import type {
  LedewirePaymentKey,
  LedewirePaymentPayload,
  LedewirePaymentRequired,
  LedewireRefusalCode,
} from './types.js'

export const API_BASE = 'http://api.test'
export const CONTENT_ID = 'content-uuid-1'
/** A paid resource on the configured Ledewire API origin. */
export const ORIGIN_URL = `${API_BASE}/v1/x402/contents/${CONTENT_ID}`
/** A resource on some other origin: a real client never pays for it. */
export const THIRD_PARTY_URL = 'https://blog.example.com/posts/article'
export const PAY_TO = 'store:f67c246e-206c-5d62-b113-c526c54fac76'

const generated = await generatePaymentKey()

/** An ephemeral Payment key, as the client is configured with it. */
export const PAYMENT_KEY: LedewirePaymentKey = {
  id: '0b5c7a3e-4f1d-4e8a-9c2b-6d7e8f9a0b1c',
  privateKey: generated.privateKey,
}
/** The public half of {@link PAYMENT_KEY}. */
export const PUBLIC_KEY = generated.publicKey

/** A decoded challenge, with the given fields of its `accepts[0]` and top level overridden. */
export function challengeObject(
  accepts: Record<string, unknown> = {},
  top: Record<string, unknown> = {},
): LedewirePaymentRequired {
  const value: unknown = {
    x402Version: 2,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: { url: ORIGIN_URL, description: 'An article', mimeType: 'application/json' },
    accepts: [
      {
        scheme: 'ledewire-wallet',
        network: 'ledewire:v1',
        amount: '250',
        asset: 'USD',
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {},
        ...accepts,
      },
    ],
    extensions: {},
    ...top,
  }
  return value as LedewirePaymentRequired
}

/** A base64 `PAYMENT-REQUIRED` header, shaped as the spec's `X402PaymentRequired`. */
export function challenge(
  accepts: Record<string, unknown> = {},
  top: Record<string, unknown> = {},
): string {
  return encodeJsonHeader(challengeObject(accepts, top))
}

/** The challenge with no payment sent. */
export const PAYMENT_REQUIRED_HEADER = challenge()

/** A refused payment's fresh challenge, naming `code`. */
export function refusalChallenge(
  code: LedewireRefusalCode,
  accepts: Record<string, unknown> = {},
): string {
  return challenge(accepts, { error: code })
}

/** A refused payment's `402` body, whose `error.type` repeats the code. */
export function refusalBody(code: LedewireRefusalCode): {
  error: { code: number; message: string; type: string }
} {
  return { error: { code: 402, message: `Refused: ${code}`, type: code } }
}

/** Decodes a `PAYMENT-SIGNATURE` header. */
export function decodeSignature(header: string): LedewirePaymentPayload {
  const decoded: unknown = decodeJsonHeader(header)
  return decoded as LedewirePaymentPayload
}

/** Whether a decoded payment's signature verifies against `publicKey` over the signed bytes. */
export async function signatureVerifies(
  payment: LedewirePaymentPayload,
  publicKey: string = PUBLIC_KEY,
): Promise<boolean> {
  return verifyEd25519(
    base64urlDecode(publicKey),
    base64urlDecode(payment.payload.signature),
    signedAuthorizationBytes(payment.payload.authorization),
  )
}
