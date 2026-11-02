/**
 * Test fixture: the `PAYMENT-REQUIRED` challenge exactly as the Ledewire API
 * builds it. Mirrors `X402::WalletService#issue_payment_required` in
 * ledewire/api `app/services/x402/wallet_service.rb` (staging), and the
 * shape asserted by `spec/requests/v1/x402/contents_spec.rb` and
 * `spec/services/x402/wallet_service_spec.rb`:
 *
 * - `resource.url` is `<base_url>/v1/x402/contents/<content.id>` — the only
 *   place the challenge carries the content id
 * - `accepts[0].extra` is `{ nonce, expiresAt }` (300-second TTL)
 * - `extensions` is always `{}` — no `ledewire-wallet` block
 *
 * If the API's shape drifts, update this file from that source, not from what
 * the client expects. Test-only: never exported from the package.
 */

import type { LedewirePaymentRequired } from './types.js'

/** A content UUID, as the API's `contents.id` column is a `uuid`. */
export const API_CONTENT_ID = '3f2c9a8e-1b7d-4e5a-9c61-0d8e2f4b7a13'

/** The API's fixed `NONCE_TTL` (`5.minutes`). */
export const API_NONCE_TTL_SECONDS = 300

/** Options for {@link apiChallenge}. */
export interface ApiChallengeOptions {
  /** The API's `request.base_url`. */
  baseUrl: string
  /** The content's id. Defaults to {@link API_CONTENT_ID}. */
  contentId?: string
  /** The single-use nonce. Defaults to a fixed UUID. */
  nonce?: string
  /** Unix seconds. Defaults to now + {@link API_NONCE_TTL_SECONDS}. */
  expiresAt?: number
  /** Price in cents, as the API's string. Defaults to `'500'`. */
  amount?: string
  /** Defaults to `{}`, as the API always sends. */
  extensions?: Record<string, unknown>
}

/** Builds the decoded challenge object the API sends for one content item. */
export function apiChallenge(options: ApiChallengeOptions): LedewirePaymentRequired {
  const contentId = options.contentId ?? API_CONTENT_ID
  return {
    x402Version: 2,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: {
      url: `${options.baseUrl}/v1/x402/contents/${contentId}`,
      description: 'Great Article',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'ledewire-wallet',
        network: 'ledewire:v1',
        amount: options.amount ?? '500',
        asset: 'USD',
        payTo: 'store:8a1e4c2f-6b3d-4f9a-a7e0-5c2d1b9f3e84',
        maxTimeoutSeconds: API_NONCE_TTL_SECONDS,
        extra: {
          nonce: options.nonce ?? 'b6f1d3a2-9e4c-4b7f-8a05-2c6e9d1f4a37',
          expiresAt: options.expiresAt ?? Math.floor(Date.now() / 1000) + API_NONCE_TTL_SECONDS,
        },
      },
    ],
    extensions: options.extensions ?? {},
  }
}

/** Base64-encodes a challenge as the API's `PAYMENT-REQUIRED` header value. */
export function encodeChallenge(challenge: unknown): string {
  return btoa(JSON.stringify(challenge))
}
