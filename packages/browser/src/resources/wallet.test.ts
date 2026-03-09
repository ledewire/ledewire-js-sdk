import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { AuthError } from '@ledewire/core'
import { createTestServer, http, HttpResponse } from '@ledewire/core/test-utils'
import {
  errorResponseFixture,
  walletBalanceFixture,
  walletTransactionFixture,
  walletPaymentSessionFixture,
  walletPaymentStatusFixture,
} from '@ledewire/core/test-utils'
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

describe('wallet.balance', () => {
  it('returns the current wallet balance', async () => {
    const fixture = walletBalanceFixture()
    server.use(http.get(`${BASE}/v1/wallet/balance`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.balance()

    expect(result).toEqual(fixture)
    expect(result.balance_cents).toBe(12500)
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/wallet/balance`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().wallet.balance()).rejects.toThrow(AuthError)
  })
})

describe('wallet.transactions', () => {
  it('returns a list of transactions', async () => {
    const fixture = [walletTransactionFixture(), walletTransactionFixture({ id: 'txn-id-2' })]
    server.use(http.get(`${BASE}/v1/wallet/transactions`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.transactions()

    expect(result).toEqual(fixture)
    expect(result).toHaveLength(2)
  })

  it('returns an empty list when no transactions', async () => {
    server.use(http.get(`${BASE}/v1/wallet/transactions`, () => HttpResponse.json([])))

    expect(await makeClient().wallet.transactions()).toEqual([])
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/wallet/transactions`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().wallet.transactions()).rejects.toThrow(AuthError)
  })
})

describe('wallet.createPaymentSession', () => {
  it('returns the payment session details', async () => {
    const fixture = walletPaymentSessionFixture()
    server.use(http.post(`${BASE}/v1/wallet/payment-session`, () => HttpResponse.json(fixture)))

    const result = await makeClient().wallet.createPaymentSession({
      amount_cents: 5000,
      currency: 'usd',
    })

    expect(result).toEqual(fixture)
    expect(result.session_id).toBe('pi_test_session')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.post(`${BASE}/v1/wallet/payment-session`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(
      makeClient().wallet.createPaymentSession({ amount_cents: 5000, currency: 'usd' }),
    ).rejects.toThrow(AuthError)
  })
})

describe('wallet.getPaymentStatus', () => {
  it('returns the payment status', async () => {
    const fixture = walletPaymentStatusFixture()
    server.use(
      http.get(`${BASE}/v1/wallet/payment-status/pi_test_session`, () =>
        HttpResponse.json(fixture),
      ),
    )

    const result = await makeClient().wallet.getPaymentStatus('pi_test_session')

    expect(result.status).toBe('completed')
    expect(result.balance_cents).toBe(12500)
  })

  it('returns pending status for in-flight payment', async () => {
    const fixture = walletPaymentStatusFixture({ status: 'pending', balance_cents: 0 })
    server.use(
      http.get(`${BASE}/v1/wallet/payment-status/pi_pending`, () => HttpResponse.json(fixture)),
    )

    const result = await makeClient().wallet.getPaymentStatus('pi_pending')

    expect(result.status).toBe('pending')
  })

  it('throws AuthError on 401', async () => {
    server.use(
      http.get(`${BASE}/v1/wallet/payment-status/pi_bad`, () =>
        HttpResponse.json(errorResponseFixture(1001, 'Unauthorized'), { status: 401 }),
      ),
    )

    await expect(makeClient().wallet.getPaymentStatus('pi_bad')).rejects.toThrow(AuthError)
  })
})
