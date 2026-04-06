import { describe, it, expect, vi } from 'vitest'
import { createMockClient } from './testing.js'
import type { MockNodeClient } from './testing.js'

describe('createMockClient', () => {
  it('returns an object with all top-level namespaces', () => {
    const client = createMockClient(vi.fn)

    expect(client).toHaveProperty('auth')
    expect(client).toHaveProperty('merchant')
    expect(client).toHaveProperty('seller')
    expect(client).toHaveProperty('wallet')
    expect(client).toHaveProperty('purchases')
    expect(client).toHaveProperty('content')
    expect(client).toHaveProperty('checkout')
    expect(client).toHaveProperty('config')
    expect(client).toHaveProperty('user')
  })

  it('stubs config.getPublic', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.config.getPublic).toBe('function')
    expect(vi.isMockFunction(client.config.getPublic)).toBe(true)
  })

  it('stubs all buyer auth methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.auth.signup).toBe('function')
    expect(typeof client.auth.loginWithEmail).toBe('function')
    expect(typeof client.auth.loginWithGoogle).toBe('function')
    expect(typeof client.auth.loginWithApiKey).toBe('function')
    expect(typeof client.auth.loginWithBuyerApiKey).toBe('function')
  })

  it('stubs all merchant auth methods including convenience helpers', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.merchant.auth.loginWithEmail).toBe('function')
    expect(typeof client.merchant.auth.loginWithGoogle).toBe('function')
    expect(typeof client.merchant.auth.listStores).toBe('function')
    expect(typeof client.merchant.auth.loginWithEmailAndListStores).toBe('function')
    expect(typeof client.merchant.auth.loginWithGoogleAndListStores).toBe('function')
  })

  it('stubs all seller content methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.seller.content.list).toBe('function')
    expect(typeof client.seller.content.create).toBe('function')
    expect(typeof client.seller.content.search).toBe('function')
    expect(typeof client.seller.content.get).toBe('function')
    expect(typeof client.seller.content.update).toBe('function')
    expect(typeof client.seller.content.delete).toBe('function')
  })

  it('stubs all merchant sales methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.merchant.sales.summary).toBe('function')
    expect(typeof client.merchant.sales.list).toBe('function')
    expect(typeof client.merchant.sales.get).toBe('function')
  })

  it('stubs all merchant users methods including update', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.merchant.users.list).toBe('function')
    expect(typeof client.merchant.users.invite).toBe('function')
    expect(typeof client.merchant.users.update).toBe('function')
    expect(typeof client.merchant.users.remove).toBe('function')
  })

  it('stubs all merchant pricingRules methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.merchant.pricingRules.list).toBe('function')
    expect(typeof client.merchant.pricingRules.create).toBe('function')
    expect(typeof client.merchant.pricingRules.deactivate).toBe('function')
  })

  it('stubs all merchant domains methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.merchant.domains.list).toBe('function')
    expect(typeof client.merchant.domains.add).toBe('function')
    expect(typeof client.merchant.domains.remove).toBe('function')
  })

  it('stubs all user.apiKeys methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.user.apiKeys.list).toBe('function')
    expect(typeof client.user.apiKeys.create).toBe('function')
    expect(typeof client.user.apiKeys.revoke).toBe('function')
  })

  it('stubs all wallet methods', () => {
    const client = createMockClient(vi.fn)

    expect(typeof client.wallet.balance).toBe('function')
    expect(typeof client.wallet.transactions).toBe('function')
    expect(typeof client.wallet.createPaymentSession).toBe('function')
    expect(typeof client.wallet.getPaymentStatus).toBe('function')
  })

  it('each stub is a vi.fn() spy when vi.fn is passed', () => {
    const client = createMockClient(vi.fn)

    expect(vi.isMockFunction(client.merchant.sales.list)).toBe(true)
    expect(vi.isMockFunction(client.seller.content.create)).toBe(true)
    expect(vi.isMockFunction(client.auth.loginWithEmail)).toBe(true)
  })

  it('each namespace gets independent spy instances', () => {
    const client = createMockClient(vi.fn)

    expect(client.merchant.sales.list).not.toBe(client.seller.content.list)
  })

  it('spies track calls correctly', async () => {
    const client = createMockClient(vi.fn)
    vi.mocked(client.merchant.sales.list).mockResolvedValue({
      data: [],
      pagination: { total: 0, per_page: 25, current_page: 1, total_pages: 0 },
    })

    await client.merchant.sales.list('store-id')

    expect(client.merchant.sales.list).toHaveBeenCalledOnce()
    expect(client.merchant.sales.list).toHaveBeenCalledWith('store-id')
  })

  it('methods on the mock are reassignable (no readonly)', () => {
    const client = createMockClient(vi.fn)

    // Should NOT throw a TypeScript error — properties are mutable
    const newFn = vi.fn().mockResolvedValue([])
    client.merchant.sales.list = newFn

    expect(client.merchant.sales.list).toBe(newFn)
  })

  it('works without a fn argument (no-op stubs)', async () => {
    const client = createMockClient()

    // Should not throw — stubs resolve silently
    await expect(client.merchant.sales.list('store-id')).resolves.toBeUndefined()
  })

  it('MockNodeClient type is compatible with a typed variable', () => {
    // This is a compile-time check — if it compiles the type is correct
    const client: MockNodeClient = createMockClient(vi.fn)
    expect(client).toBeTruthy()
  })
})
