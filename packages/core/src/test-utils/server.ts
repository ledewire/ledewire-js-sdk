/**
 * MSW (Mock Service Worker) test server utilities.
 *
 * Used in all SDK test suites to intercept HTTP requests at the network level,
 * providing realistic boundary testing without hitting the real API.
 *
 * @example
 * ```ts
 * import { http, HttpResponse } from 'msw'
 * import { createTestServer } from '@ledewire/core/test-utils'
 *
 * const server = createTestServer([
 *   http.post('https://api.ledewire.com/v1/auth/login/email', () =>
 *     HttpResponse.json(authTokenFixture()),
 *   ),
 * ])
 * ```
 *
 * @module
 */
import { setupServer } from 'msw/node'
import type { RequestHandler } from 'msw'

export { http, HttpResponse } from 'msw'

/**
 * Creates an MSW server with the given handlers, wired into the Vitest
 * lifecycle (beforeAll / afterEach / afterAll).
 *
 * Import this in your test file and add the lifecycle hooks:
 * ```ts
 * const server = createTestServer()
 *
 * beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
 * afterEach(() => server.resetHandlers())
 * afterAll(() => server.close())
 * ```
 *
 * @param handlers - Initial request handlers. Additional handlers can be
 *   added per-test with `server.use(...)`.
 */
export function createTestServer(...handlers: RequestHandler[]) {
  return setupServer(...handlers)
}
