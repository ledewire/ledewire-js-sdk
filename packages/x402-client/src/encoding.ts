/*
 * Byte encodings for the `ledewire-wallet` scheme. Web-standard only (`atob`,
 * `btoa`, `TextEncoder`, `TextDecoder`), so they run in every runtime the
 * package targets.
 */

const BASE64URL = /^[A-Za-z0-9_-]*$/

/** Standard base64 of `bytes`, padded. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/** Decodes standard base64 to bytes. Throws on input `atob` refuses. */
function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Unpadded base64url of `bytes`, the scheme's encoding for every binary value. */
export function base64urlEncode(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Decodes unpadded base64url. Throws `TypeError` for padding or any character
 * outside the URL-safe alphabet, so a padded or standard-alphabet spelling is
 * refused rather than silently read.
 */
export function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!BASE64URL.test(value) || value.length % 4 === 1) {
    throw new TypeError('Not unpadded base64url')
  }
  return base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/'))
}

/** Base64 of the UTF-8 JSON of `value`: the encoding of the x402 HTTP headers. */
export function encodeJsonHeader(value: unknown): string {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(value)))
}

/**
 * Parses a base64 x402 header as UTF-8 JSON (a challenge's `resource.description`
 * may be any title). Throws on bad base64, bad UTF-8 or bad JSON.
 */
export function decodeJsonHeader(value: string): unknown {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(base64ToBytes(value.trim()))
  return JSON.parse(text) as unknown
}

/** Lowercase hex of `bytes`. */
export function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}
