import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createLedewireFetch } from './client.js'
import {
  InsufficientFundsError,
  UnsupportedSchemeError,
  MalformedPaymentRequiredError,
  PaymentRefusedError,
} from './errors.js'
import { LedewireError } from '@ledewire/core'
import { encodeJsonHeader } from './encoding.js'
import {
  API_BASE,
  CONTENT_ID,
  ORIGIN_URL,
  PAYMENT_KEY,
  PAYMENT_REQUIRED_HEADER,
  THIRD_PARTY_URL,
  challenge,
  decodeSignature,
  refusalBody,
  refusalChallenge,
  signatureVerifies,
} from './x402.test-helpers.js'

const CONTENT_RESPONSE = {
  id: CONTENT_ID,
  title: 'Great Article',
  content_type: 'markdown',
  price_cents: 250,
  teaser: '',
  visibility: 'public',
}

const SETTLEMENT = encodeJsonHeader({
  success: true,
  transaction: 'purchase-uuid',
  network: 'ledewire:v1',
  payer: 'buyer-uuid',
  accessToken: 'settlement-jwt',
})

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

/** Answers ORIGIN_URL with `first` unpaid and `paid()` when a PAYMENT-SIGNATURE arrives. */
function serve(paid: () => Response, first: string = PAYMENT_REQUIRED_HEADER): string[] {
  const signatures: string[] = []
  server.use(
    http.get(ORIGIN_URL, ({ request }) => {
      const sig = request.headers.get('PAYMENT-SIGNATURE')
      if (!sig) {
        return new HttpResponse(null, { status: 402, headers: { 'PAYMENT-REQUIRED': first } })
      }
      signatures.push(sig)
      return paid()
    }),
  )
  return signatures
}

const config = { paymentKey: PAYMENT_KEY, apiBase: API_BASE }

describe('createLedewireFetch', () => {
  it('passes through non-402 responses unchanged', async () => {
    server.use(http.get(ORIGIN_URL, () => HttpResponse.json({ ok: true })))
    const res = await createLedewireFetch(config)(ORIGIN_URL)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
  })

  it('pays the challenge with a signed authorization end to end and returns the 200', async () => {
    const signatures = serve(() =>
      HttpResponse.json(CONTENT_RESPONSE, { headers: { 'PAYMENT-RESPONSE': SETTLEMENT } }),
    )
    const res = await createLedewireFetch({ ...config, fetch: globalThis.fetch })(ORIGIN_URL)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual(CONTENT_RESPONSE)
    expect(res.headers.get('PAYMENT-RESPONSE')).toBe(SETTLEMENT)
    expect(signatures).toHaveLength(1)
    const payment = decodeSignature(signatures[0]!)
    expect(payment.payload.authorization.from).toBe(PAYMENT_KEY.id)
    expect(await signatureVerifies(payment)).toBe(true)
  })

  it('throws UnsupportedSchemeError for a non-ledewire 402', async () => {
    serve(() => HttpResponse.json({}), challenge({ scheme: 'exact', network: 'eip155:8453' }))
    await expect(createLedewireFetch(config)(ORIGIN_URL)).rejects.toBeInstanceOf(
      UnsupportedSchemeError,
    )
  })

  it('throws MalformedPaymentRequiredError for a challenge missing payTo', async () => {
    serve(() => HttpResponse.json({}), challenge({ payTo: undefined }))
    await expect(createLedewireFetch(config)(ORIGIN_URL)).rejects.toBeInstanceOf(
      MalformedPaymentRequiredError,
    )
  })

  it('throws PaymentRefusedError when the API refuses the payment', async () => {
    serve(() =>
      HttpResponse.json(refusalBody('unknown_payment_key'), {
        status: 402,
        headers: { 'PAYMENT-REQUIRED': refusalChallenge('unknown_payment_key') },
      }),
    )
    const err = await createLedewireFetch(config)(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PaymentRefusedError)
    expect(err).toMatchObject({ refusal: 'unknown_payment_key' })
  })

  it('throws InsufficientFundsError on a 422 payment response', async () => {
    serve(() =>
      HttpResponse.json({ error: { code: 422, message: 'Insufficient funds' } }, { status: 422 }),
    )
    await expect(createLedewireFetch(config)(ORIGIN_URL)).rejects.toBeInstanceOf(
      InsufficientFundsError,
    )
  })

  it('throws LedewireError on other payment failures', async () => {
    serve(() =>
      HttpResponse.json(
        { error: { code: 400, message: 'Malformed PAYMENT-SIGNATURE header' } },
        {
          status: 400,
        },
      ),
    )
    const err = await createLedewireFetch(config)(ORIGIN_URL).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(LedewireError)
    expect(err).toMatchObject({ statusCode: 400, message: 'Malformed PAYMENT-SIGNATURE header' })
  })

  it('returns 402 directly when no PAYMENT-REQUIRED header is present', async () => {
    server.use(http.get(ORIGIN_URL, () => new HttpResponse(null, { status: 402 })))
    const res = await createLedewireFetch(config)(ORIGIN_URL)
    expect(res.status).toBe(402)
  })

  it('returns a 402 from another origin unpaid', async () => {
    const signatures: (string | null)[] = []
    server.use(
      http.get(THIRD_PARTY_URL, ({ request }) => {
        signatures.push(request.headers.get('PAYMENT-SIGNATURE'))
        return new HttpResponse(null, {
          status: 402,
          headers: { 'PAYMENT-REQUIRED': PAYMENT_REQUIRED_HEADER },
        })
      }),
    )
    const res = await createLedewireFetch(config)(THIRD_PARTY_URL)
    expect(res.status).toBe(402)
    expect(signatures).toEqual([null])
  })

  it('refuses a misconfigured Payment key when created, not at the first payment', () => {
    expect(() =>
      createLedewireFetch({ paymentKey: { id: PAYMENT_KEY.id, privateKey: 'nope' } }),
    ).toThrow(TypeError)
  })
})
