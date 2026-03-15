import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  merchantUserFixture,
  paginationMetaFixture,
  errorResponseFixture,
} from '@ledewire/core/test-utils'
import { createClient } from '../../client.js'

const BASE = 'https://api.ledewire.com'
const STORE_ID = 'store-id-1'

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
// merchant.users.list
// ---------------------------------------------------------------------------

describe('merchant.users.list', () => {
  it('returns a paginated list of store members', async () => {
    const members = [
      merchantUserFixture(),
      merchantUserFixture({ id: 'store-user-id-2', email: 'author@example.com', role: null }),
    ]
    const fixture = { data: members, pagination: paginationMetaFixture({ total: 2 }) }
    server.use(http.get(`${BASE}/v1/merchant/${STORE_ID}/users`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.users.list(STORE_ID)

    expect(result.data).toEqual(members)
    expect(result.pagination.total).toBe(2)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/users`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.users.list(STORE_ID)).rejects.toThrow(AuthError)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/users`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.users.list(STORE_ID)).rejects.toThrow(ForbiddenError)
  })

  it('forwards page and per_page as query params', async () => {
    let capturedUrl = ''
    const fixture = { data: [], pagination: paginationMetaFixture() }
    server.use(
      http.get(`${BASE}/v1/merchant/${STORE_ID}/users`, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json(fixture)
      }),
    )

    await makeClient().merchant.users.list(STORE_ID, { page: 2, per_page: 10 })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('per_page')).toBe('10')
  })
})

// ---------------------------------------------------------------------------
// merchant.users.invite
// ---------------------------------------------------------------------------

describe('merchant.users.invite', () => {
  it('returns a MerchantUser when the invited user already has an account', async () => {
    const fixture = merchantUserFixture({ email: 'existing@example.com', role: null })
    server.use(http.post(`${BASE}/v1/merchant/${STORE_ID}/users`, () => HttpResponse.json(fixture)))

    const result = await makeClient().merchant.users.invite(STORE_ID, {
      email: 'existing@example.com',
      is_author: true,
    })

    expect(result).toEqual(fixture)
  })

  it('returns a MerchantInviteResponse when the user does not yet have an account', async () => {
    const inviteFixture = {
      invitation_token: 'tok-abc123',
      email: 'new@example.com',
      role: null,
      is_author: true,
      expires_at: '2099-01-08T00:00:00Z',
    }
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/users`, () =>
        HttpResponse.json(inviteFixture, { status: 201 }),
      ),
    )

    const result = await makeClient().merchant.users.invite(STORE_ID, {
      email: 'new@example.com',
      is_author: true,
    })

    expect(result).toEqual(inviteFixture)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.post(`${BASE}/v1/merchant/${STORE_ID}/users`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().merchant.users.invite(STORE_ID, { email: 'x@x.com', is_author: true }),
    ).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// merchant.users.remove
// ---------------------------------------------------------------------------

describe('merchant.users.remove', () => {
  it('resolves without a value on 204', async () => {
    server.use(
      http.delete(
        `${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    )

    await expect(
      makeClient().merchant.users.remove(STORE_ID, 'store-user-id-1'),
    ).resolves.toBeUndefined()
  })

  it('throws ForbiddenError when owner tries to remove themselves', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Cannot remove yourself'), { status: 403 }),
      ),
    )

    await expect(makeClient().merchant.users.remove(STORE_ID, 'store-user-id-1')).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.delete(`${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().merchant.users.remove(STORE_ID, 'store-user-id-1')).rejects.toThrow(
      AuthError,
    )
  })
})

// ---------------------------------------------------------------------------
// merchant.users.update
// ---------------------------------------------------------------------------

describe('merchant.users.update', () => {
  it('sets a custom author_fee_bps override', async () => {
    const fixture = merchantUserFixture({ author_fee_bps: 1800 })
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.users.update(STORE_ID, 'store-user-id-1', {
      author_fee_bps: 1800,
    })

    expect(result.author_fee_bps).toBe(1800)
  })

  it('clears the author_fee_bps override when null is passed', async () => {
    const fixture = merchantUserFixture({ author_fee_bps: null })
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.users.update(STORE_ID, 'store-user-id-1', {
      author_fee_bps: null,
    })

    expect(result.author_fee_bps).toBeNull()
  })

  it('toggles is_author', async () => {
    const fixture = merchantUserFixture({ is_author: false })
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().merchant.users.update(STORE_ID, 'store-user-id-1', {
      is_author: false,
    })

    expect(result.is_author).toBe(false)
  })

  it('throws ForbiddenError on 403', async () => {
    server.use(
      http.patch(`${BASE}/v1/merchant/${STORE_ID}/users/store-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(1002, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().merchant.users.update(STORE_ID, 'store-user-id-1', { is_author: true }),
    ).rejects.toThrow(ForbiddenError)
  })
})
