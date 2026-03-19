/**
 * @ledewire/browser
 *
 * LedeWire SDK for browser environments.
 * Enables buyer authentication, content checkout, wallet funding,
 * and purchases — embeddable with a single `<script>` tag.
 *
 * **CDN usage (no build step required):**
 * ```html
 * <script src="https://cdn.jsdelivr.net/npm/@ledewire/browser@1/dist/ledewire.min.js"></script>
 * <script>
 *   const lw = Ledewire.init({ apiKey: 'your_api_key' })
 *   const state = await lw.checkout.state('content-id')
 *   // state.checkout_state.next_required_action:
 *   //   'authenticate' | 'fund_wallet' | 'purchase' | 'view_content'
 * </script>
 * ```
 *
 * **npm / bundler usage:**
 * ```ts
 * import { init } from '@ledewire/browser'
 * const lw = init({ apiKey: 'your_api_key' })
 * ```
 *
 * @see {@link https://docs.ledewire.org} for guides and examples
 * @packageDocumentation
 */

// Re-export core types and errors
export type {
  AuthenticationResponse,
  PublicConfigResponse,
  CheckoutNextAction,
  CheckoutState,
  CheckoutStateResponse,
  ContentAccessInfo,
  ContentWithAccessResponse,
  NextRequiredAction,
  PurchaseCreateRequest,
  PurchaseResponse,
  StoredTokens,
  TokenStorage,
  WalletBalanceResponse,
  WalletPaymentSessionRequest,
  WalletPaymentSessionResponse,
  WalletPaymentStatusResponse,
  WalletTransactionItem,
} from '@ledewire/core'
export {
  AuthError,
  ForbiddenError,
  LedewireError,
  MemoryTokenStorage,
  NotFoundError,
  PurchaseError,
  parseExpiresAt,
} from '@ledewire/core'

// Package exports (implementations added in build step 5)
export { init } from './client.js'
export type { BrowserClientConfig } from './client.js'
export { localStorageAdapter } from './local-storage-adapter.js'
export type { SellerContentSearchRequest } from './resources/seller/content.js'
export type {
  AuthPasswordResetBody,
  AuthPasswordResetRequestBody,
  AuthPasswordResetResponse,
} from '@ledewire/core'
