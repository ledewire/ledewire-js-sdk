import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError, NotFoundError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { merchantPricingRuleFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-id-1'
const RULE_ID = 'rule-id-1'

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
  return createClient()
}

// ---------------------------------------------------------------------------
// merchant.pricingRules.list
// ---------------------------------------------------------------------------

describe('merchant.pricingRules.list', () => {
  it('returns an array of active pricing rules', async () => {
    const rules = [
      merchantPricingRuleFixture(),
      merchantPricingRuleFixture({ id: 'rule-id-2', url_pattern: 'https://example.com/posts/*' }),
    ]
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, () => HttpResponse.json(rules)),
    )

    const result = await makeClient().merchant.pricingRules.list(STORE_ID)

    expect(result).toEqual(rules)
    expect(result).toHaveLength(2)
  })

  it('returns an empty array when no rules exist', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, () => HttpResponse.json([])),
    )

    const result = await makeClient().merchant.pricingRules.list(STORE_ID)

    expect(result).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.pricingRules.list(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.pricingRules.list(STORE_ID)).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// merchant.pricingRules.create
// ---------------------------------------------------------------------------

describe('merchant.pricingRules.create', () => {
  it('creates and returns a new pricing rule', async () => {
    const fixture = merchantPricingRuleFixture()
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().merchant.pricingRules.create(STORE_ID, {
      url_pattern: 'https://example.com/articles/*',
      price_cents: 150,
    })

    expect(result).toEqual(fixture)
    expect(capturedBody).toEqual({
      url_pattern: 'https://example.com/articles/*',
      price_cents: 150,
    })
  })

  it('throws ForbiddenError on 403 (non-owner)', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().merchant.pricingRules.create(STORE_ID, {
        url_pattern: 'https://example.com/articles/*',
        price_cents: 150,
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('throws on 422 when domain is not verified', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules`, () =>
        HttpResponse.json(errorResponseFixture(4221, 'Domain not verified'), { status: 422 }),
      ),
    )

    await expect(
      makeClient().merchant.pricingRules.create(STORE_ID, {
        url_pattern: 'https://unverified.com/articles/*',
        price_cents: 150,
      }),
    ).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// merchant.pricingRules.deactivate
// ---------------------------------------------------------------------------

describe('merchant.pricingRules.deactivate', () => {
  it('returns the rule with active: false', async () => {
    const fixture = merchantPricingRuleFixture({ active: false })
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules/${RULE_ID}`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.pricingRules.deactivate(STORE_ID, RULE_ID)

    expect(result.active).toBe(false)
    expect(result.id).toBe(RULE_ID)
  })

  it('throws NotFoundError on 404', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules/${RULE_ID}`, () =>
        HttpResponse.json(errorResponseFixture(1004, 'Not Found'), { status: 404 }),
      ),
    )

    await expect(makeClient().merchant.pricingRules.deactivate(STORE_ID, RULE_ID)).rejects.toThrow(
      NotFoundError,
    )
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/pricing_rules/${RULE_ID}`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.pricingRules.deactivate(STORE_ID, RULE_ID)).rejects.toThrow(
      ForbiddenError,
    )
  })
})
