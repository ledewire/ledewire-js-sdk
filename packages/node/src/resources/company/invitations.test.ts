import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  companyInvitationFixture,
  companyMembershipFixture,
  errorResponseFixture,
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

// ---------------------------------------------------------------------------
// company.invitations.list
// ---------------------------------------------------------------------------

describe('company.invitations.list', () => {
  it('GETs /v1/company/invitations and returns the invitation envelope', async () => {
    const invitations = [companyInvitationFixture()]
    server.use(
      http.get(`${BASE}/v1/company/invitations`, () => HttpResponse.json({ data: invitations })),
    )

    const result = await makeClient().company.invitations.list()

    expect(result.data).toEqual(invitations)
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/invitations`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.invitations.list()).rejects.toThrow(ForbiddenError)
  })
})

// ---------------------------------------------------------------------------
// company.invitations.create
// ---------------------------------------------------------------------------

describe('company.invitations.create', () => {
  it('POSTs the email and role, and returns the pending invitation', async () => {
    const fixture = companyInvitationFixture({ role: 'admin' })
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/company/invitations`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().company.invitations.create({
      email: 'invitee@example.com',
      role: 'admin',
    })

    expect(capturedBody).toEqual({ email: 'invitee@example.com', role: 'admin' })
    expect(result).toEqual(fixture)
  })

  it('sends only the email when role is omitted', async () => {
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/company/invitations`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(companyInvitationFixture(), { status: 201 })
      }),
    )

    await makeClient().company.invitations.create({ email: 'invitee@example.com' })

    expect(capturedBody).toEqual({ email: 'invitee@example.com' })
  })

  it('throws on 409 when an invitation to the address is already pending', async () => {
    server.use(
      http.post(`${BASE}/v1/company/invitations`, () =>
        HttpResponse.json(errorResponseFixture(4090, 'Conflict'), { status: 409 }),
      ),
    )

    await expect(
      makeClient().company.invitations.create({ email: 'invitee@example.com' }),
    ).rejects.toThrow()
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/company/invitations`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().company.invitations.create({ email: 'invitee@example.com' }),
    ).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// company.invitations.revoke
// ---------------------------------------------------------------------------

describe('company.invitations.revoke', () => {
  it('DELETEs the invitation and resolves on 204', async () => {
    let method: string | undefined
    server.use(
      http.delete(`${BASE}/v1/company/invitations/invitation-id-1`, ({ request }) => {
        method = request.method
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(
      makeClient().company.invitations.revoke('invitation-id-1'),
    ).resolves.toBeUndefined()
    expect(method).toBe('DELETE')
  })

  it('encodes the id in the URL', async () => {
    let capturedUrl: string | undefined
    server.use(
      http.delete(`${BASE}/v1/company/invitations/:id`, ({ request }) => {
        capturedUrl = request.url
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await makeClient().company.invitations.revoke('id with space')

    expect(capturedUrl).toBe(`${BASE}/v1/company/invitations/id%20with%20space`)
  })

  it('throws on 409 when the invitation is no longer pending', async () => {
    server.use(
      http.delete(`${BASE}/v1/company/invitations/invitation-id-1`, () =>
        HttpResponse.json(errorResponseFixture(4090, 'Not pending'), { status: 409 }),
      ),
    )

    await expect(makeClient().company.invitations.revoke('invitation-id-1')).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// company.invitations.accept
// ---------------------------------------------------------------------------

describe('company.invitations.accept', () => {
  it('POSTs the token and returns the new membership', async () => {
    const fixture = companyMembershipFixture({ role: 'admin' })
    let capturedBody: unknown
    server.use(
      http.post(`${BASE}/v1/company/invitations/accept`, async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json(fixture, { status: 201 })
      }),
    )

    const result = await makeClient().company.invitations.accept({ token: 'emailed-token' })

    expect(capturedBody).toEqual({ token: 'emailed-token' })
    expect(result).toEqual(fixture)
  })

  it('throws on 410 when the invitation has expired or was withdrawn', async () => {
    server.use(
      http.post(`${BASE}/v1/company/invitations/accept`, () =>
        HttpResponse.json(errorResponseFixture(4100, 'Gone'), { status: 410 }),
      ),
    )

    await expect(makeClient().company.invitations.accept({ token: 'old' })).rejects.toThrow()
  })
})
