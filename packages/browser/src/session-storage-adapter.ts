import type { TokenStorage } from '@ledewire/core'
import { webStorageAdapter } from './web-storage-adapter.js'

/**
 * A {@link TokenStorage} adapter that persists tokens in `sessionStorage`.
 *
 * Tokens survive page reloads within the same tab but are cleared when the
 * tab is closed or the session ends.  This prevents token leakage across
 * tabs and is a good default for sites where users do not expect persistent
 * sessions (e.g. embedded checkout widgets, kiosk-mode UIs).
 *
 * **Security note:** `sessionStorage` is accessible to any JavaScript on the
 * same origin and tab.  It is more isolated than `localStorage` (no
 * cross-tab sharing), but the default in-memory storage is still safer for
 * high-security use cases.
 *
 * @param key - The `sessionStorage` key used to store tokens.
 *   Defaults to `'lw:tokens'`. Override this if you have multiple
 *   LedeWire integrations on the same origin.
 *
 * @example
 * ```ts
 * import { init, sessionStorageAdapter } from '@ledewire/browser'
 *
 * const lw = init({
 *   apiKey: 'your_api_key',
 *   storage: sessionStorageAdapter(),
 * })
 * ```
 */
export function sessionStorageAdapter(key?: string): TokenStorage {
  return webStorageAdapter(sessionStorage, key)
}
