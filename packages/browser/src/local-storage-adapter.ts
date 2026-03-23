import type { TokenStorage } from '@ledewire/core'
import { webStorageAdapter } from './web-storage-adapter.js'

/**
 * A {@link TokenStorage} adapter that persists tokens in `localStorage`.
 *
 * Tokens survive page reloads and browser restarts, which is convenient
 * for sites where users expect persistent sessions.
 *
 * **Security note:** `localStorage` is accessible to any JavaScript on the
 * same origin. Only use this adapter on sites you fully control and trust.
 * The default in-memory storage is safer for high-security use cases.
 *
 * @param key - The `localStorage` key used to store tokens.
 *   Defaults to `'lw:tokens'`. Override this if you have multiple
 *   LedeWire integrations on the same origin.
 *
 * @example
 * ```ts
 * import { init, localStorageAdapter } from '@ledewire/browser'
 *
 * const lw = init({
 *   apiKey: 'your_api_key',
 *   storage: localStorageAdapter(),
 * })
 * ```
 */
export function localStorageAdapter(key?: string): TokenStorage {
  return webStorageAdapter(localStorage, key)
}
