/*
 * Ed25519 signing for the `ledewire-wallet` scheme, on WebCrypto
 * (`crypto.subtle`), which every runtime the package targets provides: Node.js
 * 20+, Deno, Cloudflare Workers, Bun and current browsers. No dependency.
 *
 * Source of truth: the API's scheme page,
 * `docs/public/x402/reference/ledewire-wallet-scheme.md`.
 */
import { base64urlDecode, base64urlEncode } from './encoding.js'
import type { LedewirePaymentAuthorization } from './types.js'

const ED25519 = { name: 'Ed25519' } as const

/**
 * A WebCrypto key. Named from `crypto.subtle` because the package compiles
 * without the DOM lib, which is where the global `CryptoKey` type lives.
 */
export type SigningKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>

/** Prepended to the canonical bytes of every Payment authorization before signing. */
export const AUTHORIZATION_PREFIX = 'ledewire-payment-authorization:'
/** Prepended to the `public_key` string to make a registration proof. */
export const PROOF_PREFIX = 'ledewire-payment-key:'

/** The PKCS #8 DER header of an Ed25519 private key; the 32-byte seed follows it. */
const PKCS8_ED25519_PREFIX = Uint8Array.of(
  0x30,
  0x2e,
  0x02,
  0x01,
  0x00,
  0x30,
  0x05,
  0x06,
  0x03,
  0x2b,
  0x65,
  0x70,
  0x04,
  0x22,
  0x04,
  0x20,
)

/** The members of an authorization, in the order they are checked. */
const AUTHORIZATION_KEYS = {
  from: 'string',
  to: 'string',
  value: 'string',
  asset: 'string',
  resource: 'string',
  validAfter: 'integer',
  validBefore: 'integer',
  nonce: 'string',
} as const

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

/**
 * The RFC 8785 (JCS) serialization of `authorization`, over the domain the
 * scheme allows: exactly its eight members, every string printable ASCII,
 * every number an integer in `[0, 2^53)`. Over that domain JCS is the object
 * with its keys sorted by code point, as compact JSON.
 *
 * @throws {TypeError} When `authorization` is outside that domain. The API
 *   would refuse it as malformed, so it is never signed.
 */
export function canonicalAuthorization(authorization: LedewirePaymentAuthorization): string {
  const record: Readonly<Record<string, unknown>> = { ...authorization }
  const keys = Object.keys(record)
  const expected = Object.keys(AUTHORIZATION_KEYS)
  if (keys.length !== expected.length || !expected.every((k) => Object.hasOwn(record, k))) {
    throw new TypeError(`A Payment authorization has exactly the members ${expected.join(', ')}`)
  }
  for (const [key, kind] of Object.entries(AUTHORIZATION_KEYS)) {
    const value = record[key]
    const ok =
      kind === 'string'
        ? typeof value === 'string' && PRINTABLE_ASCII.test(value)
        : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    if (!ok) {
      throw new TypeError(
        kind === 'string'
          ? `Payment authorization ${key} must be a printable ASCII string`
          : `Payment authorization ${key} must be an integer in [0, 2^53)`,
      )
    }
  }
  const sorted = [...keys].sort()
  // JSON.stringify of a printable ASCII string escapes exactly `"` and `\`, and
  // of a safe integer writes plain decimal: both what RFC 8785 produces.
  return `{${sorted.map((k) => `${JSON.stringify(k)}:${JSON.stringify(record[k])}`).join(',')}}`
}

/** The exact bytes a Payment authorization's signature covers. */
export function signedAuthorizationBytes(
  authorization: LedewirePaymentAuthorization,
): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(AUTHORIZATION_PREFIX + canonicalAuthorization(authorization))
}

/** Decodes a private key string to its 32-byte seed. Never echoes the value. */
function seedBytes(privateKey: string): Uint8Array<ArrayBuffer> {
  let seed: Uint8Array<ArrayBuffer>
  try {
    seed = base64urlDecode(privateKey)
  } catch {
    throw new TypeError('Payment key privateKey must be unpadded base64url')
  }
  if (seed.length !== 32) {
    throw new TypeError('Payment key privateKey must decode to the 32-byte Ed25519 seed')
  }
  return seed
}

/**
 * Checks synchronously that `privateKey` is unpadded base64url of a 32-byte
 * seed, so a misconfigured key fails at construction, not at first payment.
 *
 * @throws {TypeError} Otherwise. The message never contains the value.
 */
export function assertPrivateKey(privateKey: string): void {
  if (typeof privateKey !== 'string') throw new TypeError('Payment key privateKey must be a string')
  seedBytes(privateKey).fill(0)
}

/** Wraps a seed in PKCS #8, the format WebCrypto imports, and zeroes the seed copy. */
function pkcs8(seed: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const der = new Uint8Array(PKCS8_ED25519_PREFIX.length + seed.length)
  der.set(PKCS8_ED25519_PREFIX)
  der.set(seed, PKCS8_ED25519_PREFIX.length)
  seed.fill(0)
  return der
}

/**
 * Imports a Payment key's private half, the base64url 32-byte Ed25519 seed, as
 * a non-extractable WebCrypto signing key.
 *
 * @throws {TypeError} When `privateKey` is not unpadded base64url of 32 bytes.
 *   The message never contains the value.
 */
export async function importPaymentKey(privateKey: string): Promise<SigningKey> {
  const der = pkcs8(seedBytes(privateKey))
  try {
    return await crypto.subtle.importKey('pkcs8', der, ED25519, false, ['sign'])
  } finally {
    der.fill(0)
  }
}

/**
 * The base64url public key of a Payment key's private half.
 *
 * @throws {TypeError} When `privateKey` is not unpadded base64url of 32 bytes.
 */
export async function derivePublicKey(privateKey: string): Promise<string> {
  const der = pkcs8(seedBytes(privateKey))
  try {
    const key = await crypto.subtle.importKey('pkcs8', der, ED25519, true, ['sign'])
    const jwk = await crypto.subtle.exportKey('jwk', key)
    if (typeof jwk.x !== 'string') throw new TypeError('Could not derive the public key')
    return jwk.x
  } finally {
    der.fill(0)
  }
}

/**
 * Generates a new Ed25519 Payment key pair. `privateKey` is the base64url
 * 32-byte seed: store it as a secret, it is the only copy. `publicKey` is the
 * base64url 32 raw public-key bytes, what registration sends.
 */
export async function generatePaymentKey(): Promise<{ privateKey: string; publicKey: string }> {
  const pair = await crypto.subtle.generateKey(ED25519, true, ['sign', 'verify'])
  if (!('privateKey' in pair)) throw new TypeError('Could not generate a Payment key')
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  if (typeof jwk.d !== 'string' || typeof jwk.x !== 'string') {
    throw new TypeError('Could not export the generated Payment key')
  }
  return { privateKey: jwk.d, publicKey: jwk.x }
}

async function sign(key: SigningKey, bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return base64urlEncode(new Uint8Array(await crypto.subtle.sign(ED25519, key, bytes)))
}

/** Signs a Payment authorization: base64url Ed25519 over the prefix and its canonical bytes. */
export async function signAuthorization(
  key: SigningKey,
  authorization: LedewirePaymentAuthorization,
): Promise<string> {
  return sign(key, signedAuthorizationBytes(authorization))
}

/**
 * The registration proof of possession: base64url Ed25519, by `key`, over
 * `ledewire-payment-key:` followed by `publicKey` exactly as it will be sent.
 */
export async function paymentKeyProof(key: SigningKey, publicKey: string): Promise<string> {
  return sign(key, new TextEncoder().encode(PROOF_PREFIX + publicKey))
}

/** Verifies an Ed25519 signature over `message` with raw 32-byte `publicKey`. */
export async function verifyEd25519(
  publicKey: Uint8Array<ArrayBuffer>,
  signature: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', publicKey, ED25519, false, ['verify'])
  return crypto.subtle.verify(ED25519, key, signature, message)
}
