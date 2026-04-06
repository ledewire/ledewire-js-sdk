/**
 * @ledewire/node/testing
 *
 * Test utilities for consumers of `@ledewire/node`.
 * Import from `@ledewire/node/testing` in your test files only.
 *
 * ## Vitest — per-method mock control (recommended)
 *
 * Wrap individual methods with `vi.mocked()` to access `.mockResolvedValue()`,
 * `.mock.calls`, etc. This is the lightest approach and works without any
 * top-level wrapper:
 *
 * ```ts
 * import { createMockClient } from '@ledewire/node/testing'
 * import { vi } from 'vitest'
 *
 * const client = createMockClient(vi.fn)
 *
 * // Narrow to a single method to control its return value / read call records:
 * vi.mocked(client.merchant.sales.list).mockResolvedValue({
 *   data: [],
 *   pagination: { total: 0, per_page: 25, current_page: 1, total_pages: 0 },
 * })
 * vi.mocked(client.seller.content.create).mockResolvedValue(contentItem)
 *
 * const result = await myRouteHandler(client)
 * expect(vi.mocked(client.merchant.sales.list).mock.calls).toHaveLength(1)
 * ```
 *
 * ## Vitest — whole-client deep mock (when you need full MockInstance types)
 *
 * Wrap the entire client with `vi.mocked(client, true)` (note the `true` flag
 * for deep mocking) to surface `MockInstance` methods on every nested function
 * without calling `vi.mocked()` on each one individually:
 *
 * ```ts
 * import { createMockClient } from '@ledewire/node/testing'
 * import { vi } from 'vitest'
 *
 * // vi.mocked(..., true) returns MaybeMockedDeep<MockNodeClient> — all methods
 * // are typed as Mock<...> and support .mockResolvedValue(), .mock.calls, etc.
 * const client = vi.mocked(createMockClient(vi.fn), true)
 *
 * client.merchant.sales.list.mockResolvedValue({ data: [], pagination: { ... } })
 * client.seller.content.create.mockResolvedValue(contentItem)
 * ```
 *
 * Without `vi.mocked(client, true)`, TypeScript sees methods as plain function
 * signatures and will report `Property 'mockResolvedValue' does not exist on
 * type '(...) => Promise<...>'`. The underlying stubs ARE vi.fn() instances at
 * runtime — the `vi.mocked()` call is purely a type-level cast.
 *
 * ## Jest
 *
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
 * stubs.
 *
 * Methods are typed as plain function signatures. To access `MockInstance`
 * methods (`.mockResolvedValue()`, `.mock.calls`, etc.) use one of:
 * - Per-method: `vi.mocked(client.some.method).mockResolvedValue(...)`
 * - Whole-client: `const client = vi.mocked(createMockClient(vi.fn), true)`
 */
export type MockNodeClient = DeepMutable<NodeClient>

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
 * @example Per-method control (Vitest)
 * ```ts
 * const client = createMockClient(vi.fn)
 * // Wrap individual methods to access MockInstance types:
 * vi.mocked(client.merchant.sales.list).mockResolvedValue({ data: [], pagination: { ... } })
 * expect(vi.mocked(client.merchant.sales.list).mock.calls).toHaveLength(1)
 * ```
 *
 * @example Whole-client deep mock (Vitest)
 * ```ts
 * // vi.mocked(..., true) casts all nested functions to Mock<...> at once:
 * const client = vi.mocked(createMockClient(vi.fn), true)
 * client.merchant.sales.list.mockResolvedValue({ data: [], pagination: { ... } })
 * ```
 */
export function createMockClient(
  fn: () => AnyFn = () => () => Promise.resolve(undefined),
): MockNodeClient {
  const stub = () => fn()
  // eslint-disable-next-line no-restricted-syntax -- intentional: plain object literal cast to MockNodeClient; the double-cast is the factory mechanism, not a type workaround.
  return {
    auth: {
      signup: stub(),
      loginWithEmail: stub(),
      loginWithGoogle: stub(),
      loginWithBuyerApiKey: stub(),
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
      pricingRules: {
        list: stub(),
        create: stub(),
        deactivate: stub(),
      },
      domains: {
        list: stub(),
        add: stub(),
        remove: stub(),
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
    user: {
      apiKeys: {
        list: stub(),
        create: stub(),
        revoke: stub(),
      },
    },
    config: {
      getPublic: stub(),
    },
  } as unknown as MockNodeClient
}
