import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { ForbiddenError, LedewireError, NotFoundError } from '@ledewire/core'
import {
  companyInvitationFixture,
  companyMachineUserBuyerKeyCreateResponseFixture,
  companyMachineUserBuyerKeyFixture,
  companyMachineUserFixture,
  companyMachineUserMcpKeyCreateResponseFixture,
  companyMachineUserMcpKeyFixture,
  companyMemberFixture,
  companyMembershipFixture,
  companyPendingTopUpFixture,
  companyPurchaseFixture,
  companyPurchaseMemberFixture,
  companyWalletFixture,
  createTestServer,
  errorResponseFixture,
  http,
  HttpResponse,
  paginationMetaFixture,
  walletPaymentSessionFixture,
} from '@ledewire/core/test-utils'
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

function forbidden() {
  return HttpResponse.json(errorResponseFixture(403, 'Company admins only'), { status: 403 })
}

// ---------------------------------------------------------------------------
// company.membership
// ---------------------------------------------------------------------------

describe('company.membership', () => {
  it('get() returns the buyer’s own membership', async () => {
    const membership = companyMembershipFixture()
    server.use(http.get(`${BASE}/v1/company/membership`, () => HttpResponse.json(membership)))

    await expect(makeClient().company.membership.get()).resolves.toEqual(membership)
  })

  it('get() throws NotFoundError when the buyer belongs to no Company', async () => {
    server.use(
      http.get(`${BASE}/v1/company/membership`, () =>
        HttpResponse.json(errorResponseFixture(404, 'Not a member'), { status: 404 }),
      ),
    )

    await expect(makeClient().company.membership.get()).rejects.toThrow(NotFoundError)
  })

  it('leave() sends DELETE and resolves on 204', async () => {
    let called = false
    server.use(
      http.delete(`${BASE}/v1/company/membership`, () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(makeClient().company.membership.leave()).resolves.toBeUndefined()
    expect(called).toBe(true)
  })

  it('leave() surfaces the last-admin refusal as a 422 LedewireError', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/membership`, () =>
        HttpResponse.json(errorResponseFixture(422, 'The last admin cannot leave'), {
          status: 422,
        }),
      ),
    )

    const err = await makeClient()
      .company.membership.leave()
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(422)
  })
})

// ---------------------------------------------------------------------------
// company.invitations
// ---------------------------------------------------------------------------

describe('company.invitations', () => {
  it('list() returns the pending invitations envelope', async () => {
    const body = { data: [companyInvitationFixture()] }
    server.use(http.get(`${BASE}/v1/company/invitations`, () => HttpResponse.json(body)))

    await expect(makeClient().company.invitations.list()).resolves.toEqual(body)
  })

  it('create() posts the invitee and accepts an omitted role', async () => {
    const invitation = companyInvitationFixture()
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/company/invitations`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(invitation, { status: 201 })
      }),
    )

    const result = await makeClient().company.invitations.create({ email: 'analyst@example.com' })

    expect(captured).toEqual({ email: 'analyst@example.com' })
    expect(result).toEqual(invitation)
  })

  it('create() throws ForbiddenError for a non-admin', async () => {
    server.use(http.post(`${BASE}/v1/company/invitations`, forbidden))

    await expect(
      makeClient().company.invitations.create({ email: 'a@example.com', role: 'admin' }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('revoke() sends DELETE to the URL-encoded invitation id and resolves on 204', async () => {
    let called = false
    server.use(
      http.delete(`${BASE}/v1/company/invitations/invite%2Fid`, () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(makeClient().company.invitations.revoke('invite/id')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })

  it('revoke() surfaces an invitation that is no longer pending as a 409', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/invitations/invitation-id-1`, () =>
        HttpResponse.json(errorResponseFixture(409, 'Invitation is no longer pending'), {
          status: 409,
        }),
      ),
    )

    const err = await makeClient()
      .company.invitations.revoke('invitation-id-1')
      .catch((e: unknown) => e)
    expect((err as LedewireError).statusCode).toBe(409)
  })

  it('accept() posts the token and returns the new membership', async () => {
    const membership = companyMembershipFixture({ role: 'member' })
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/company/invitations/accept`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(membership, { status: 201 })
      }),
    )

    const result = await makeClient().company.invitations.accept({ token: 'invite-token' })

    expect(captured).toEqual({ token: 'invite-token' })
    expect(result).toEqual(membership)
  })

  it('accept() exposes the refusal reason on details', async () => {
    server.use(
      http.post(`${BASE}/v1/company/invitations/accept`, () =>
        HttpResponse.json(
          {
            ...errorResponseFixture(409, 'Already in a Company', 'invitation_not_accepted'),
            reason: 'already_in_company',
          },
          { status: 409 },
        ),
      ),
    )

    const err = await makeClient()
      .company.invitations.accept({ token: 'invite-token' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).type).toBe('invitation_not_accepted')
    expect((err as LedewireError).details).toEqual({ reason: 'already_in_company' })
  })

  it('accept() surfaces an expired invitation as a 410 LedewireError', async () => {
    server.use(
      http.post(`${BASE}/v1/company/invitations/accept`, () =>
        HttpResponse.json(errorResponseFixture(410, 'Invitation expired'), { status: 410 }),
      ),
    )

    const err = await makeClient()
      .company.invitations.accept({ token: 'stale' })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect((err as LedewireError).statusCode).toBe(410)
  })
})

// ---------------------------------------------------------------------------
// company.members
// ---------------------------------------------------------------------------

describe('company.members', () => {
  it('list() returns the members envelope', async () => {
    const body = {
      data: [companyMemberFixture(), companyMemberFixture({ kind: 'machine', email: null })],
    }
    server.use(http.get(`${BASE}/v1/company/members`, () => HttpResponse.json(body)))

    await expect(makeClient().company.members.list()).resolves.toEqual(body)
  })

  it('update() PATCHes the membership id with the cap', async () => {
    const member = companyMemberFixture({ daily_spend_limit_cents: 5000 })
    let captured: unknown
    server.use(
      http.patch(`${BASE}/v1/company/members/membership-id-2`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(member)
      }),
    )

    const result = await makeClient().company.members.update('membership-id-2', {
      daily_spend_limit_cents: 5000,
    })

    expect(captured).toEqual({ daily_spend_limit_cents: 5000 })
    expect(result.daily_spend_limit_cents).toBe(5000)
  })

  it('update() URL-encodes the membership id', async () => {
    let path = ''
    server.use(
      http.patch(`${BASE}/v1/company/members/:id`, ({ request }) => {
        path = new URL(request.url).pathname
        return HttpResponse.json(companyMemberFixture())
      }),
    )

    await makeClient().company.members.update('a/b', { role: 'admin' })

    expect(path).toBe('/v1/company/members/a%2Fb')
  })

  it('remove() sends DELETE to the membership id', async () => {
    let called = false
    server.use(
      http.delete(`${BASE}/v1/company/members/membership-id-2`, () => {
        called = true
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(makeClient().company.members.remove('membership-id-2')).resolves.toBeUndefined()
    expect(called).toBe(true)
  })

  it('list() throws ForbiddenError for a non-admin', async () => {
    server.use(http.get(`${BASE}/v1/company/members`, forbidden))

    await expect(makeClient().company.members.list()).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// company.machineUsers
// ---------------------------------------------------------------------------

describe('company.machineUsers', () => {
  it('list() returns the Machine users envelope', async () => {
    const body = { data: [companyMachineUserFixture()] }
    server.use(http.get(`${BASE}/v1/company/machine-users`, () => HttpResponse.json(body)))

    await expect(makeClient().company.machineUsers.list()).resolves.toEqual(body)
  })

  it('create() posts the name and description', async () => {
    const machineUser = companyMachineUserFixture({ description: 'Nightly research run' })
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/company/machine-users`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(machineUser, { status: 201 })
      }),
    )

    const result = await makeClient().company.machineUsers.create({
      name: 'research-agent',
      description: 'Nightly research run',
    })

    expect(captured).toEqual({ name: 'research-agent', description: 'Nightly research run' })
    expect(result).toEqual(machineUser)
  })

  it('update() PATCHes the Machine user with the new name and a cleared description', async () => {
    const renamed = companyMachineUserFixture({ name: 'nightly-agent' })
    let captured: unknown
    server.use(
      http.patch(`${BASE}/v1/company/machine-users/machine-user-id-1`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(renamed)
      }),
    )

    const result = await makeClient().company.machineUsers.update('machine-user-id-1', {
      name: 'nightly-agent',
      description: null,
    })

    expect(captured).toEqual({ name: 'nightly-agent', description: null })
    expect(result).toEqual(renamed)
  })

  it('update() surfaces a name taken by another Machine user as a 409', async () => {
    server.use(
      http.patch(`${BASE}/v1/company/machine-users/machine-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(409, 'Name already taken'), { status: 409 }),
      ),
    )

    const err = await makeClient()
      .company.machineUsers.update('machine-user-id-1', { name: 'taken' })
      .catch((e: unknown) => e)
    expect((err as LedewireError).statusCode).toBe(409)
  })

  it('deactivate() sends DELETE and returns the deactivated Machine user', async () => {
    const deactivated = companyMachineUserFixture({ deactivated_at: '2099-01-02T00:00:00Z' })
    server.use(
      http.delete(`${BASE}/v1/company/machine-users/machine-user-id-1`, () =>
        HttpResponse.json(deactivated),
      ),
    )

    const result = await makeClient().company.machineUsers.deactivate('machine-user-id-1')

    expect(result.deactivated_at).toBe('2099-01-02T00:00:00Z')
  })

  it('deactivate() surfaces an already-deactivated Machine user as a 409', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/machine-users/machine-user-id-1`, () =>
        HttpResponse.json(errorResponseFixture(409, 'Already deactivated'), { status: 409 }),
      ),
    )

    const err = await makeClient()
      .company.machineUsers.deactivate('machine-user-id-1')
      .catch((e: unknown) => e)
    expect((err as LedewireError).statusCode).toBe(409)
  })

  describe('buyerKeys', () => {
    const path = `${BASE}/v1/company/machine-users/machine-user-id-1/buyer-keys`

    it('list() returns the keys envelope', async () => {
      const body = { data: [companyMachineUserBuyerKeyFixture()] }
      server.use(http.get(path, () => HttpResponse.json(body)))

      await expect(
        makeClient().company.machineUsers.buyerKeys.list('machine-user-id-1'),
      ).resolves.toEqual(body)
    })

    it('create() posts the name and returns the one-time secret', async () => {
      const created = companyMachineUserBuyerKeyCreateResponseFixture()
      let captured: unknown
      server.use(
        http.post(path, async ({ request }) => {
          captured = await request.json()
          return HttpResponse.json(created, { status: 201 })
        }),
      )

      const result = await makeClient().company.machineUsers.buyerKeys.create('machine-user-id-1', {
        name: 'production',
      })

      expect(captured).toEqual({ name: 'production' })
      expect(result.secret).toHaveLength(64)
    })

    it('revoke() sends DELETE to the key under the Machine user', async () => {
      let called = false
      server.use(
        http.delete(`${path}/mu-buyer-key-id-1`, () => {
          called = true
          return new HttpResponse(null, { status: 204 })
        }),
      )

      await makeClient().company.machineUsers.buyerKeys.revoke(
        'machine-user-id-1',
        'mu-buyer-key-id-1',
      )
      expect(called).toBe(true)
    })
  })

  describe('mcpKeys', () => {
    const path = `${BASE}/v1/company/machine-users/machine-user-id-1/mcp-keys`

    it('list() returns the keys envelope', async () => {
      const body = { data: [companyMachineUserMcpKeyFixture()] }
      server.use(http.get(path, () => HttpResponse.json(body)))

      await expect(
        makeClient().company.machineUsers.mcpKeys.list('machine-user-id-1'),
      ).resolves.toEqual(body)
    })

    it('create() posts the label and scopes and returns the one-time secret', async () => {
      const created = companyMachineUserMcpKeyCreateResponseFixture()
      let captured: unknown
      server.use(
        http.post(path, async ({ request }) => {
          captured = await request.json()
          return HttpResponse.json(created, { status: 201 })
        }),
      )

      const result = await makeClient().company.machineUsers.mcpKeys.create('machine-user-id-1', {
        label: 'research-agent',
        scopes: ['mcp:search'],
      })

      expect(captured).toEqual({ label: 'research-agent', scopes: ['mcp:search'] })
      expect(result.secret).toBeTruthy()
    })

    it('revoke() sends DELETE to the key under the Machine user', async () => {
      let called = false
      server.use(
        http.delete(`${path}/mu-mcp-key-id-1`, () => {
          called = true
          return new HttpResponse(null, { status: 204 })
        }),
      )

      await makeClient().company.machineUsers.mcpKeys.revoke('machine-user-id-1', 'mu-mcp-key-id-1')
      expect(called).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// company.wallet
// ---------------------------------------------------------------------------

describe('company.wallet', () => {
  it('get() returns the Company wallet', async () => {
    const wallet = companyWalletFixture({ balance_cents: -500 })
    server.use(http.get(`${BASE}/v1/company/wallet`, () => HttpResponse.json(wallet)))

    await expect(makeClient().company.wallet.get()).resolves.toEqual(wallet)
  })

  it('get() throws ForbiddenError for a non-admin', async () => {
    server.use(http.get(`${BASE}/v1/company/wallet`, forbidden))

    await expect(makeClient().company.wallet.get()).rejects.toThrow(ForbiddenError)
  })

  it('createPaymentSession() posts to the Company wallet route, currency optional', async () => {
    const session = walletPaymentSessionFixture()
    let captured: unknown
    server.use(
      http.post(`${BASE}/v1/company/wallet/payment-session`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(session)
      }),
    )

    // Omitting `currency` must type-check: the server defaults it to usd.
    const result = await makeClient().company.wallet.createPaymentSession({ amount_cents: 50000 })

    expect(captured).toEqual({ amount_cents: 50000 })
    expect(result).toEqual(session)
  })

  it('listPendingTopUps() returns the pending top-ups envelope', async () => {
    const body = { data: [companyPendingTopUpFixture()] }
    server.use(http.get(`${BASE}/v1/company/wallet/pending-top-ups`, () => HttpResponse.json(body)))

    await expect(makeClient().company.wallet.listPendingTopUps()).resolves.toEqual(body)
  })
})

// ---------------------------------------------------------------------------
// company.purchases / company.spend
// ---------------------------------------------------------------------------

describe('company.purchases.list', () => {
  it('sends filters and pagination as query parameters', async () => {
    const body = {
      data: [companyPurchaseFixture({ kind: 'bulk_acquisition' })],
      pagination: paginationMetaFixture(),
    }
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${BASE}/v1/company/purchases`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(body)
      }),
    )

    const result = await makeClient().company.purchases.list({
      member: 'membership-id-2',
      from: '2026-09-01',
      to: '2026-09-30',
      kind: 'bulk_acquisition',
      page: 2,
      per_page: 50,
    })

    expect(Object.fromEntries(query ?? [])).toEqual({
      member: 'membership-id-2',
      from: '2026-09-01',
      to: '2026-09-30',
      kind: 'bulk_acquisition',
      page: '2',
      per_page: '50',
    })
    expect(result).toEqual(body)
  })

  it('sends no query string when called without params', async () => {
    let search = 'unset'
    server.use(
      http.get(`${BASE}/v1/company/purchases`, ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: [], pagination: paginationMetaFixture() })
      }),
    )

    await makeClient().company.purchases.list()

    expect(search).toBe('')
  })
})

describe('company.spend.list', () => {
  it('sends the range filters and returns spend per membership', async () => {
    const body = { data: [{ member: companyPurchaseMemberFixture(), spend_cents: 4200 }] }
    let query: URLSearchParams | undefined
    server.use(
      http.get(`${BASE}/v1/company/spend`, ({ request }) => {
        query = new URL(request.url).searchParams
        return HttpResponse.json(body)
      }),
    )

    const result = await makeClient().company.spend.list({ from: '2026-09-01' })

    expect(Object.fromEntries(query ?? [])).toEqual({ from: '2026-09-01' })
    expect(result.data[0]?.spend_cents).toBe(4200)
  })

  it('throws ForbiddenError for a non-admin', async () => {
    server.use(http.get(`${BASE}/v1/company/spend`, forbidden))

    await expect(makeClient().company.spend.list()).rejects.toThrow(ForbiddenError)
  })
})
