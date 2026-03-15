/**
 * @ledewire/node/testing
 *
 * Test utilities for consumers of `@ledewire/node`.
 * Import from `@ledewire/node/testing` in your test files only.
 *
 * @example Vitest:
 * ```ts
 * import { createMockClient } from '@ledewire/node/testing'
 * import { vi } from 'vitest'
 *
 * const client = createMockClient(vi.fn)
 *
 * vi.mocked(client.merchant.sales.list).mockResolvedValue({
 *   data: [],
 *   pagination: { total: 0, per_page: 25, current_page: 1, total_pages: 0 },
 * })
 * vi.mocked(client.seller.content.create).mockResolvedValue(contentItem)
 *
 * // Pass to your route handler under test
 * const result = await myRouteHandler(client)
 * expect(client.merchant.sales.list).toHaveBeenCalledWith('store-id')
 * ```
 *
 * @example Jest:
 * ```ts
 * import { createMockClient } from '@ledewire/node/testing'
 *
 * const client = createMockClient(jest.fn)
 * jest.mocked(client.merchant.sales.list).mockResolvedValue({
 *   data: [],
 *   pagination: { total: 0, per_page: 25, current_page: 1, total_pages: 0 },
 * })
 * ```
 *
 * @module
 */
import type { NodeClient } from './client.js'

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Strip `readonly` from all properties at every depth. */
type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : T[K] extends object
      ? DeepMutable<T[K]>
      : T[K]
}

/**
 * A fully-typed mock of {@link NodeClient} with all `readonly` modifiers
 * removed so individual methods can be replaced with `vi.fn()` / `jest.fn()`
 * stubs. Internal `_http`, `_tokenManager`, and `_config` fields are excluded.
 *
 * Assign stubs to specific methods as needed:
 * ```ts
 * client.merchant.sales.list = vi.fn().mockResolvedValue([])
 * ```
 */
export type MockNodeClient = DeepMutable<Omit<NodeClient, '_http' | '_tokenManager' | '_config'>>

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// A minimal mock-function type compatible with both vi.fn() and jest.fn() output
type AnyFn = (...args: never[]) => unknown

/**
 * Creates a fully-typed mock {@link NodeClient} for use in unit tests.
 *
 * Pass your test framework's spy factory — `vi.fn` (Vitest) or `jest.fn` (Jest)
 * — to get stub functions with call tracking and return-value control.
 * If no factory is provided every method is a silent no-op.
 *
 * @param fn - A spy factory function. Pass `vi.fn` or `jest.fn`.
 * @returns A {@link MockNodeClient} with all methods pre-stubbed.
 *
 * @example
 * ```ts
 * import { createMockClient } from '@ledewire/node/testing'
 * import { vi } from 'vitest'
 *
 * const client = createMockClient(vi.fn)
 * vi.mocked(client.merchant.sales.list).mockResolvedValue([])
 * ```
 */
export function createMockClient(
  fn: () => AnyFn = () => () => Promise.resolve(undefined),
): MockNodeClient {
  const stub = () => fn()
  return {
    auth: {
      signup: stub(),
      loginWithEmail: stub(),
      loginWithGoogle: stub(),
      loginWithApiKey: stub(),
    },
    merchant: {
      auth: {
        loginWithEmail: stub(),
        loginWithGoogle: stub(),
        listStores: stub(),
        loginWithEmailAndListStores: stub(),
        loginWithGoogleAndListStores: stub(),
      },
      users: {
        list: stub(),
        invite: stub(),
        update: stub(),
        remove: stub(),
      },
      sales: {
        summary: stub(),
        list: stub(),
        get: stub(),
      },
      buyers: {
        list: stub(),
      },
      config: {
        get: stub(),
      },
    },
    seller: {
      content: {
        list: stub(),
        create: stub(),
        search: stub(),
        get: stub(),
        update: stub(),
        delete: stub(),
      },
    },
    wallet: {
      balance: stub(),
      transactions: stub(),
      createPaymentSession: stub(),
      getPaymentStatus: stub(),
    },
    purchases: {
      create: stub(),
      list: stub(),
      get: stub(),
    },
    content: {
      getWithAccess: stub(),
    },
    checkout: {
      state: stub(),
    },
  } as unknown as MockNodeClient
}
