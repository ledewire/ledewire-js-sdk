/**
 * Buyer Payment key management namespace.
 *
 * @module
 */
import type { HttpClient } from '@ledewire/core'
import type { PaymentKey, PaymentKeyCreateRequest } from '@ledewire/core'

/**
 * Register, list and revoke the authenticated Buyer's Payment keys.
 *
 * A Payment key is the public half of an Ed25519 key that signs x402 payments.
 * It signs payments only and is never a login credential. LedeWire never holds
 * the private half, so nothing secret is sent or returned: the SDK takes no
 * private key here. Signing payments with the key is `@ledewire/x402-client`'s job.
 *
 * **Rules the API enforces:**
 * - A Buyer holds at most 10 active Payment keys. Rotate by registering the
 *   replacement before revoking the old key.
 * - Only buyer tokens may call these routes; seller and merchant tokens get
 *   `403 Invalid Role` (`ForbiddenError`).
 * - A Machine user can't register or revoke its own keys. A Company admin does,
 *   through `client.company.machineUsers.paymentKeys`.
 *
 * Obtain via `client.user.paymentKeys` — do not construct directly.
 *
 * @example
 * ```ts
 * const key = await client.user.paymentKeys.create({ name: 'research-agent', public_key, proof })
 * const keys = await client.user.paymentKeys.list()
 * await client.user.paymentKeys.revoke(key.id)
 * ```
 */
export class UserPaymentKeysNamespace {
  /** @internal */
  constructor(private readonly http: HttpClient) {}

  /**
   * Lists the caller's active Payment keys, newest first. Revoked keys are not
   * listed. Not paginated: there are at most 10.
   *
   * @returns The active keys, as a plain array.
   * @throws {ForbiddenError} When the token is not a buyer token (`Invalid Role`).
   */
  async list(): Promise<PaymentKey[]> {
    return this.http.get<PaymentKey[]>('/v1/user/payment-keys')
  }

  /**
   * Registers a Payment key.
   *
   * - `public_key` is the 32 raw Ed25519 public-key bytes as unpadded base64url
   *   (43 characters).
   * - `proof` proves you hold the private half: an Ed25519 signature, made with
   *   that key, over the ASCII bytes `ledewire-payment-key:` followed by the
   *   `public_key` string exactly as sent, as unpadded base64url (86 characters).
   *   The API checks it and discards it.
   *
   * The example uses Node's `crypto`. In a browser, an Ed25519 key from
   * WebCrypto (`crypto.subtle.generateKey({ name: 'Ed25519' }, …)`) exported in
   * `'raw'` format gives the same 32 bytes, and `crypto.subtle.sign('Ed25519', …)`
   * the same signature.
   *
   * A Buyer holds at most 10 active keys, so to rotate, register the
   * replacement first and then revoke the old key.
   *
   * @param body - The key's name, `public_key` and `proof`.
   * @returns The registered key. It carries no secret.
   * @throws {ForbiddenError} When the caller is a Machine user
   *   (`Machine users cannot manage their own keys`; its Company's admins
   *   register its keys through `company.machineUsers.paymentKeys`), or the
   *   token is not a buyer token (`Invalid Role`).
   * @throws {LedewireError} With `statusCode === 422` when the proof does not
   *   verify, the key is malformed or already registered, or the caller already
   *   holds 10 active keys; with `statusCode === 400` when a field is blank.
   *
   * @example
   * ```ts
   * import { generateKeyPairSync, sign } from 'node:crypto'
   *
   * const { publicKey, privateKey } = generateKeyPairSync('ed25519')
   * // The raw 32 public-key bytes are the last 32 bytes of the SPKI DER encoding
   * const public_key = publicKey
   *   .export({ type: 'spki', format: 'der' })
   *   .subarray(-32)
   *   .toString('base64url')
   * const message = Buffer.from(`ledewire-payment-key:${public_key}`, 'ascii')
   * const proof = sign(null, message, privateKey).toString('base64url')
   *
   * const key = await client.user.paymentKeys.create({ name: 'research-agent', public_key, proof })
   * // Keep privateKey in your secrets manager: it signs payments, and LedeWire never sees it
   * ```
   */
  async create(body: PaymentKeyCreateRequest): Promise<PaymentKey> {
    return this.http.post<PaymentKey>('/v1/user/payment-keys', body)
  }

  /**
   * Revokes one of the caller's Payment keys. It stops settling payments at
   * once; a purchase it already paid for still names it.
   *
   * @param id - The Payment key id (`PaymentKey.id`).
   * @throws {NotFoundError} When the key is unknown, already revoked or
   *   another user's.
   * @throws {ForbiddenError} When the caller is a Machine user, or the token is
   *   not a buyer token (`Invalid Role`).
   */
  async revoke(id: string): Promise<void> {
    return this.http.delete(`/v1/user/payment-keys/${encodeURIComponent(id)}`)
  }
}
