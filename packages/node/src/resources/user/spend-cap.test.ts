import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import { spendCapFixture, errorResponseFixture } from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

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
  return createClient()
}

// ---------------------------------------------------------------------------
// user.spendCap.get
// ---------------------------------------------------------------------------

describe('user.spendCap.get', () => {
  it('returns the buyer spend cap', async () => {
    const fixture = spendCapFixture()
    server.use(http.get(`${BASE}/v1/user/spend-cap`, () => HttpResponse.json(fixture)))

    const result = await makeClient().user.spendCap.get()

    expect(result).toEqual(fixture)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/user/spend-cap`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().user.spendCap.get()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// user.spendCap.update
// ---------------------------------------------------------------------------

describe('user.spendCap.update', () => {
  it('sends the new cap and returns the updated spend cap', async () => {
    const fixture = spendCapFixture({ cap_cents: 2000, remaining_cents: 2000 })
    let capturedBody: unknown
    server.use(
      http.patch(`${BASE}/v1/user/spend-cap`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().user.spendCap.update({ daily_spend_limit_cents: 2000 })

    expect(result).toEqual(fixture)
    expect(capturedBody).toEqual({ daily_spend_limit_cents: 2000 })
  })

  it('refuses null at the type level: a buyer can change the cap but not remove it', async () => {
    server.use(
      http.patch(`${BASE}/v1/user/spend-cap`, () =>
        HttpResponse.json(errorResponseFixture(4001, 'Invalid spend cap'), { status: 422 }),
      ),
    )

    await expect(
      // @ts-expect-error null is not a cap; the API refuses it with 422
      makeClient().user.spendCap.update({ daily_spend_limit_cents: null }),
    ).rejects.toThrow('Invalid spend cap')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.patch(`${BASE}/v1/user/spend-cap`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().user.spendCap.update({ daily_spend_limit_cents: 1000 }),
    ).rejects.toThrow(AuthError)
  })

  it('throws on 422 for a negative or fractional cap', async () => {
    server.use(
      http.patch(`${BASE}/v1/user/spend-cap`, () =>
        HttpResponse.json(errorResponseFixture(4001, 'Invalid spend cap'), { status: 422 }),
      ),
    )

    await expect(
      makeClient().user.spendCap.update({ daily_spend_limit_cents: -100 }),
    ).rejects.toThrow()
  })
})
