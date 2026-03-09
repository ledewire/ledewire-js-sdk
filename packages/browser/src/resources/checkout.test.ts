import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { errorResponseFixture, checkoutStateFixture } from '@ledewire/core/test-utils'
import { init } from '../client.js'

const BASE = 'https://api.ledewire.com'

const server = createTestServer()
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

function makeClient() {
  return init({ apiKey: 'test-api-key' })
}

describe('checkout.state', () => {
  it('returns the checkout state for a content item', async () => {
    const fixture = checkoutStateFixture()
    server.use(http.get(`${BASE}/v1/checkout/state/content-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeClient().checkout.state('content-id-1')

    expect(result).toEqual(fixture)
  })

  it('includes content metadata', async () => {
    const fixture = checkoutStateFixture()
    server.use(http.get(`${BASE}/v1/checkout/state/content-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeClient().checkout.state('content-id-1')

    expect(result.content_id).toBe('content-id-1')
    expect(result.content_title).toBe('Test Article')
    expect(result.price_cents).toBe(500)
  })

  it('reflects purchase-required state', async () => {
    const fixture = checkoutStateFixture({
      checkout_state: {
        is_authenticated: true,
        has_sufficient_funds: true,
        has_purchased: false,
        next_required_action: 'purchase',
      },
    })
    server.use(http.get(`${BASE}/v1/checkout/state/content-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeClient().checkout.state('content-id-1')

    expect(result.checkout_state.next_required_action).toBe('purchase')
  })

  it('reflects authenticate state for unauthenticated buyer', async () => {
    const fixture = checkoutStateFixture({
      checkout_state: {
        is_authenticated: false,
        has_sufficient_funds: null,
        has_purchased: false,
        next_required_action: 'authenticate',
      },
    })
    server.use(http.get(`${BASE}/v1/checkout/state/content-id-1`, () => HttpResponse.json(fixture)))

    const result = await makeClient().checkout.state('content-id-1')

    expect(result.checkout_state.is_authenticated).toBe(false)
    expect(result.checkout_state.next_required_action).toBe('authenticate')
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.get(`${BASE}/v1/checkout/state/missing`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not found'), { status: 404 }),
      ),
    )

    await expect(makeClient().checkout.state('missing')).rejects.toThrow(NotFoundError)
  })
})
