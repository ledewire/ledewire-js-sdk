import {
  AuthError,
  ForbiddenError,
  LedewireError,
  RateLimitError,
  parseRetryAfter,
} from '@ledewire/core'
import { loginWithBuyerApiKey } from './auth.js'
import { extractApiErrorMessage } from './errors.js'
import {
  derivePublicKey,
  generatePaymentKey,
  importPaymentKey,
  paymentKeyProof,
} from './signing.js'
import type { LedewirePaymentKey, LedewirePaymentKeyRecord } from './types.js'

const DEFAULT_API_BASE = 'https://api.ledewire.com'
const PAYMENT_KEYS_PATH = '/v1/user/payment-keys'

/**
 * The request body that registers a Payment key (`PaymentKeyCreateRequest`):
 * `POST /v1/user/payment-keys`, or, for a Company admin registering one for a
 * Machine user, `POST /v1/company/machine-users/{machine_user_id}/payment-keys`.
 */
export interface PaymentKeyCreateBody {
  /** A label for the key. */
  name: string
  /** The 32 raw Ed25519 public-key bytes, as unpadded base64url. */
  public_key: string
  /**
   * Proof of possession: unpadded base64url Ed25519 signature, by the key,
   * over `ledewire-payment-key:` followed by `public_key` exactly as sent.
   */
  proof: string
}

/** A Payment key's private half together with the body that registers it. */
export interface PaymentKeyRegistration {
  /** The 32-byte Ed25519 seed, unpadded base64url. Store it as a secret. */
  privateKey: string
  /** What to send to register the key. Holds nothing secret. */
  body: PaymentKeyCreateBody
}

/**
 * Builds the registration body for a Payment key: generates a new Ed25519 key
 * (or uses `privateKey`), and signs the proof of possession. Nothing is sent.
 *
 * Use it with any client that registers keys, e.g. a Company admin
 * registering a Machine user's key through `@ledewire/node`. To register your
 * own key in one step, use {@link registerPaymentKey}.
 *
 * @param name - A label for the key.
 * @param privateKey - An existing 32-byte seed, unpadded base64url. Omit to generate one.
 * @throws {TypeError} When `privateKey` is not unpadded base64url of 32 bytes.
 */
export async function createPaymentKeyRegistration(
  name: string,
  privateKey?: string,
): Promise<PaymentKeyRegistration> {
  const pair =
    privateKey === undefined
      ? await generatePaymentKey()
      : { privateKey, publicKey: await derivePublicKey(privateKey) }
  const proof = await paymentKeyProof(await importPaymentKey(pair.privateKey), pair.publicKey)
  return { privateKey: pair.privateKey, body: { name, public_key: pair.publicKey, proof } }
}

/** How {@link registerPaymentKey} authenticates: a buyer API key, or a buyer access token. */
export type PaymentKeyRegistrar = { key: string; secret: string } | { accessToken: string }

/**
 * Options for {@link registerPaymentKey}.
 */
export type RegisterPaymentKeyOptions = PaymentKeyRegistrar & {
  /** A label for the key. */
  name: string
  /** An existing 32-byte seed to register, unpadded base64url. Omit to generate a key. */
  privateKey?: string
  /**
   * The Ledewire API base URL. Defaults to `https://api.ledewire.com`. The
   * buyer-key login and the registration go only here.
   */
  apiBase?: string
  /** Custom `fetch`. Defaults to the global `fetch`. */
  fetch?: typeof globalThis.fetch
}

/** A Payment key just registered. */
export interface RegisteredPaymentKey {
  /**
   * The key as `LedewirePaymentClient` takes it: the registered `id` and the
   * private seed. Store `privateKey` as a secret; it is the only copy.
   */
  paymentKey: LedewirePaymentKey
  /** The key as the API recorded it (public half only). */
  record: LedewirePaymentKeyRecord
}

/**
 * Registers a Payment key for the signed-in Buyer: generates a new Ed25519
 * key (or uses `privateKey`), signs the proof of possession, and sends
 * `{ name, public_key, proof }` to `POST {apiBase}/v1/user/payment-keys`. The
 * private key is never sent.
 *
 * Authenticate with a buyer API key (`key` and `secret`, logged in at
 * `apiBase`) or a buyer `accessToken`. A Buyer holds at most 10 active
 * Payment keys. A Machine user cannot register its own: a Company admin
 * registers it (see {@link createPaymentKeyRegistration}) and gives the
 * software the key id and private key.
 *
 * @example
 * ```ts
 * import { registerPaymentKey, createLedewireFetch } from '@ledewire/x402-client'
 *
 * const { paymentKey } = await registerPaymentKey({ key, secret, name: 'research-agent' })
 * // Save paymentKey.id and paymentKey.privateKey somewhere secret, once.
 * const fetch = createLedewireFetch({ paymentKey, maxPriceCents: 500 })
 * ```
 *
 * @throws {AuthError} Invalid buyer key, secret or token (`401`).
 * @throws {ForbiddenError} Not a buyer, or a Machine user (`403`).
 * @throws {RateLimitError} Rate-limited (`429`), with `retryAfter`.
 * @throws {LedewireError} Any other refusal, e.g. `422` for a key already
 *   registered or a Buyer already holding 10.
 */
export async function registerPaymentKey(
  options: RegisterPaymentKeyOptions,
): Promise<RegisteredPaymentKey> {
  const apiBase = options.apiBase ?? DEFAULT_API_BASE
  const fetchFn = options.fetch ?? globalThis.fetch

  const registration = await createPaymentKeyRegistration(options.name, options.privateKey)

  const accessToken =
    'accessToken' in options
      ? options.accessToken
      : (await loginWithBuyerApiKey(options.key, options.secret, apiBase, fetchFn)).access_token

  const res = await fetchFn(`${apiBase}${PAYMENT_KEYS_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(registration.body),
    // The bearer token goes to the configured API and nowhere else.
    redirect: 'error',
  })

  const body: unknown = await res.json().catch(() => undefined)
  if (!res.ok) throw registrationError(res, body)

  const record = body as LedewirePaymentKeyRecord | undefined
  if (
    !record ||
    typeof record.id !== 'string' ||
    record.public_key !== registration.body.public_key
  ) {
    throw new LedewireError('Payment key registration returned an unexpected response', res.status)
  }
  return { paymentKey: { id: record.id, privateKey: registration.privateKey }, record }
}

function registrationError(res: Response, body: unknown): LedewireError {
  const message = extractApiErrorMessage(
    body,
    `Payment key registration failed (${String(res.status)})`,
  )
  if (res.status === 401) return new AuthError(message)
  if (res.status === 403) return new ForbiddenError(message)
  if (res.status === 429) {
    return new RateLimitError(
      message,
      undefined,
      undefined,
      undefined,
      parseRetryAfter(res.headers.get('Retry-After')),
    )
  }
  return new LedewireError(message, res.status)
}
