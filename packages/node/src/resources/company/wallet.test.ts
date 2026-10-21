import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError, ForbiddenError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  companyPendingTopUpFixture,
  companyWalletFixture,
  errorResponseFixture,
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

// ---------------------------------------------------------------------------
// company.wallet.get
// ---------------------------------------------------------------------------

describe('company.wallet.get', () => {
  it('GETs /v1/company/wallet and returns the Company wallet', async () => {
    const fixture = companyWalletFixture({ balance_cents: 12345, pending_top_up_cents: 5000 })
    server.use(http.get(`${BASE}/v1/company/wallet`, () => HttpResponse.json(fixture)))

    const result = await makeClient().company.wallet.get()

    expect(result).toEqual(fixture)
    expect(result.balance_cents).toBe(12345)
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.get(`${BASE}/v1/company/wallet`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(makeClient().company.wallet.get()).rejects.toThrow(ForbiddenError)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/company/wallet`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().company.wallet.get()).rejects.toThrow(AuthError)
  })
})

// ---------------------------------------------------------------------------
// company.wallet.listPendingTopUps
// ---------------------------------------------------------------------------

describe('company.wallet.listPendingTopUps', () => {
  it('GETs /v1/company/wallet/pending-top-ups and returns the envelope', async () => {
    const topUps = [companyPendingTopUpFixture()]
    server.use(
      http.get(`${BASE}/v1/company/wallet/pending-top-ups`, () =>
        HttpResponse.json({ data: topUps }),
      ),
    )

    const result = await makeClient().company.wallet.listPendingTopUps()

    expect(result.data).toEqual(topUps)
  })

  it('returns an empty envelope when nothing is pending', async () => {
    server.use(
      http.get(`${BASE}/v1/company/wallet/pending-top-ups`, () => HttpResponse.json({ data: [] })),
    )

    const result = await makeClient().company.wallet.listPendingTopUps()

    expect(result.data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// company.wallet.createPaymentSession
// ---------------------------------------------------------------------------

describe('company.wallet.createPaymentSession', () => {
  it('POSTs the amount and returns the payment session', async () => {
    const fixture = walletPaymentSessionFixture()
    let capturedBody: unknown
    let method: string | undefined
    server.use(
      http.post(`${BASE}/v1/company/wallet/payment-session`, async ({ request }) => {
        method = request.method
        capturedBody = await request.json()
        return HttpResponse.json(fixture)
      }),
    )

    const result = await makeClient().company.wallet.createPaymentSession({
      amount_cents: 5000,
      currency: 'usd',
    })

    expect(method).toBe('POST')
    expect(capturedBody).toEqual({ amount_cents: 5000, currency: 'usd' })
    expect(result).toEqual(fixture)
  })

  it('throws PurchaseError on 402 when the provider refuses the session', async () => {
    server.use(
      http.post(`${BASE}/v1/company/wallet/payment-session`, () =>
        HttpResponse.json(errorResponseFixture(4020, 'Payment refused'), { status: 402 }),
      ),
    )

    await expect(
      makeClient().company.wallet.createPaymentSession({ amount_cents: 5000 }),
    ).rejects.toThrow()
  })

  it('throws ForbiddenError when the caller is not a Company admin', async () => {
    server.use(
      http.post(`${BASE}/v1/company/wallet/payment-session`, () =>
        HttpResponse.json(errorResponseFixture(1003, 'Forbidden'), { status: 403 }),
      ),
    )

    await expect(
      makeClient().company.wallet.createPaymentSession({ amount_cents: 5000 }),
    ).rejects.toThrow(ForbiddenError)
  })
})
