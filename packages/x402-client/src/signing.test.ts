import { describe, it, expect } from 'vitest'
import {
  canonicalAuthorization,
  derivePublicKey,
  generatePaymentKey,
  importPaymentKey,
  paymentKeyProof,
  signAuthorization,
  verifyEd25519,
} from './signing.js'
import { base64urlDecode } from './encoding.js'
import type { LedewirePaymentAuthorization } from './types.js'

/*
 * TEST VECTOR, copied verbatim from the API's published scheme page,
 * `docs/public/x402/reference/ledewire-wallet-scheme.md` (Appendix, "Test vector")
 * in ledewire/api. The seed is the SHA-256 of `ledewire-wallet test vector seed`;
 * it is public and must never be used for anything but this check.
 */
const VECTOR = {
  seed: 'u2Twwe6WhB5kBeL4eZ6AuVifkL_6sy4f3X-yCNE0xv0',
  publicKey: 't0O_8BK68328z2AV2kJ8ySIj6Mqpv7yIYDz9gvYpAy0',
  proof: 'I1ZZlVynXLvtd-ciA7Jpjuluv9KZ5tnSJ7c1UbgZsohLWRMtgNqGdotTz19loYanaeQuaw2eBtnyDivIckzxBg',
  signature:
    '68rziXLF1ep5QlPe9Z_mTeS77sfmoF29Vz2ppHRKIZ6Xmd7LUC5OMzp5JMtmHFcr6pz5ZBkLhQkV4fjQZAdMCg',
  authorization: {
    from: '0b5c7a3e-4f1d-4e8a-9c2b-6d7e8f9a0b1c',
    to: 'store:f67c246e-206c-5d62-b113-c526c54fac76',
    value: '250',
    asset: 'USD',
    resource: 'https://api.ledewire.com/v1/x402/contents/fc9a202e-e5f1-51dd-922b-591d3206576c',
    validAfter: 1793000000,
    validBefore: 1793000300,
    nonce: '16be7f1fce7a44f84bfefdde9767cdc077a5dc329e663b3b33677df0c3b2cd37',
  } satisfies LedewirePaymentAuthorization,
  canonical:
    '{"asset":"USD","from":"0b5c7a3e-4f1d-4e8a-9c2b-6d7e8f9a0b1c","nonce":"16be7f1fce7a44f84bfefdde9767cdc077a5dc329e663b3b33677df0c3b2cd37","resource":"https://api.ledewire.com/v1/x402/contents/fc9a202e-e5f1-51dd-922b-591d3206576c","to":"store:f67c246e-206c-5d62-b113-c526c54fac76","validAfter":1793000000,"validBefore":1793000300,"value":"250"}',
}

const ascii = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s)

/** An authorization outside the type, to check that the domain is enforced at runtime. */
const loose = (value: Record<string, unknown>): LedewirePaymentAuthorization => {
  const widened: unknown = value
  return widened as LedewirePaymentAuthorization
}

describe('canonicalAuthorization', () => {
  it("produces the scheme page's published canonical bytes for the test vector", () => {
    expect(canonicalAuthorization(VECTOR.authorization)).toBe(VECTOR.canonical)
  })

  it('sorts keys whatever order they were written in', () => {
    const reversed = loose(Object.fromEntries(Object.entries(VECTOR.authorization).reverse()))
    expect(canonicalAuthorization(reversed)).toBe(VECTOR.canonical)
  })

  it('escapes " and \\ as RFC 8785 does', () => {
    const auth = { ...VECTOR.authorization, resource: 'a"b\\c' }
    expect(canonicalAuthorization(auth)).toContain('"resource":"a\\"b\\\\c"')
  })

  it.each([
    ['a non-ASCII string', { resource: 'https://example.com/café' }],
    ['a control character', { resource: 'a\nb' }],
    ['a non-integer number', { validAfter: 1.5 }],
    ['a negative integer', { validAfter: -1 }],
    ['an integer at 2^53', { validBefore: 2 ** 53 }],
    ['a number where a string belongs', { value: 250 }],
    ['a string where an integer belongs', { validAfter: '1793000000' }],
    ['a nested object', { asset: { code: 'USD' } }],
  ])('refuses an authorization holding %s', (_label, override) => {
    const auth = loose({ ...VECTOR.authorization, ...override })
    expect(() => canonicalAuthorization(auth)).toThrow(TypeError)
  })

  it('refuses a missing or an extra member', () => {
    const missing: Record<string, unknown> = { ...VECTOR.authorization }
    delete missing['nonce']
    expect(() => canonicalAuthorization(loose(missing))).toThrow(TypeError)
    const extra = { ...VECTOR.authorization, token: 'x' }
    expect(() => canonicalAuthorization(loose(extra))).toThrow(TypeError)
  })
})

describe('signAuthorization (test vector)', () => {
  it("derives the published public key from the vector's seed", async () => {
    expect(await derivePublicKey(VECTOR.seed)).toBe(VECTOR.publicKey)
  })

  it('signs the vector authorization to the published signature exactly', async () => {
    const key = await importPaymentKey(VECTOR.seed)
    expect(await signAuthorization(key, VECTOR.authorization)).toBe(VECTOR.signature)
  })

  it('signs the prefix plus the canonical bytes, nothing else', async () => {
    const publicKey = base64urlDecode(VECTOR.publicKey)
    const signature = base64urlDecode(VECTOR.signature)
    expect(
      await verifyEd25519(
        publicKey,
        signature,
        ascii(`ledewire-payment-authorization:${VECTOR.canonical}`),
      ),
    ).toBe(true)
    // The scheme page: changing a byte, leaving the prefix out, or signing the
    // unsorted keys must all fail to verify.
    expect(
      await verifyEd25519(
        publicKey,
        signature,
        ascii(`ledewire-payment-authorization:${VECTOR.canonical.replace('"250"', '"251"')}`),
      ),
    ).toBe(false)
    expect(await verifyEd25519(publicKey, signature, ascii(VECTOR.canonical))).toBe(false)
    expect(
      await verifyEd25519(
        publicKey,
        signature,
        ascii(`ledewire-payment-authorization:${JSON.stringify(VECTOR.authorization)}`),
      ),
    ).toBe(false)
  })

  it("produces the published registration proof for the vector's key", async () => {
    const key = await importPaymentKey(VECTOR.seed)
    expect(await paymentKeyProof(key, VECTOR.publicKey)).toBe(VECTOR.proof)
  })
})

describe('importPaymentKey', () => {
  it.each([
    ['too short', 'AAAA'],
    ['not base64url', 'u2Twwe6WhB5kBeL4eZ6AuVifkL/6sy4f3X+yCNE0xv0'],
    ['padded', 'u2Twwe6WhB5kBeL4eZ6AuVifkL_6sy4f3X-yCNE0xv0='],
  ])('refuses a private key that is %s, without echoing it', async (_label, value) => {
    const err = await importPaymentKey(value).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TypeError)
    expect((err as Error).message).not.toContain(value)
  })

  it('makes a key that cannot be exported', async () => {
    const key = await importPaymentKey(VECTOR.seed)
    expect(key.extractable).toBe(false)
  })
})

describe('generatePaymentKey', () => {
  it('generates a 32-byte private seed and its matching 32-byte public key', async () => {
    const { privateKey, publicKey } = await generatePaymentKey()
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await derivePublicKey(privateKey)).toBe(publicKey)
  })

  it('generates a different key every time', async () => {
    const a = await generatePaymentKey()
    const b = await generatePaymentKey()
    expect(a.privateKey).not.toBe(b.privateKey)
    expect(a.publicKey).not.toBe(b.publicKey)
  })
})
