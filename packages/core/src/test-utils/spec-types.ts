/**
 * Type helpers for pinning SDK return types to the operations in `ledewire.yml`.
 *
 * `types.ts` aliases component schemas, while `api.gen.ts` types each operation
 * from whatever its response declares (a `$ref` or an inline schema). The two
 * can disagree when the spec defines a component and an operation inlines a
 * different shape. Tests compare against {@link OperationOk} to catch that.
 */
import type { components, paths } from '../api.gen.js'

/**
 * The `application/json` body of an operation's success response (`200` unless
 * another status is named). `never` when the operation does not declare one, so
 * a pin against a missing response fails rather than passing vacuously.
 *
 * @example
 * ```ts
 * type State = OperationOk<'/v1/checkout/state/{content_id}', 'get'>
 * type Signup = OperationOk<'/v1/auth/signup', 'post', 201>
 * ```
 */
export type OperationOk<
  P extends keyof paths,
  M extends 'get' | 'post' | 'put' | 'patch' | 'delete',
  S extends number = 200,
> = paths[P][M] extends {
  responses: Record<S, { content: { 'application/json': infer Body } }>
}
  ? Body
  : never

/**
 * The `application/json` request body an operation declares. `never` when it
 * declares none, so a pin against a missing body fails rather than passing vacuously.
 *
 * @example
 * ```ts
 * type Search = OperationBody<'/v1/content/search', 'post'>
 * ```
 */
export type OperationBody<
  P extends keyof paths,
  M extends 'get' | 'post' | 'put' | 'patch' | 'delete',
> = paths[P][M] extends {
  requestBody: { content: { 'application/json': infer Body } }
}
  ? Body
  : never

/**
 * The query parameters an operation declares. `never` when it declares none, so a
 * pin against a missing query fails rather than passing vacuously.
 *
 * @example
 * ```ts
 * type Discovery = OperationQuery<'/v1/x402/discovery/resources', 'get'>
 * ```
 */
export type OperationQuery<
  P extends keyof paths,
  M extends 'get' | 'post' | 'put' | 'patch' | 'delete',
> = paths[P][M] extends { parameters: { query?: infer Query } }
  ? [NonNullable<Query>] extends [never]
    ? never
    : NonNullable<Query>
  : never

/** The resolved value of an async method's returned promise. */
export type Returns<F> = F extends (...args: never[]) => Promise<infer R> ? R : never

/**
 * A component schema from `ledewire.yml` by name, for pinning a hand-named SDK
 * type to the schema it aliases.
 *
 * @example
 * ```ts
 * expectTypeOf<LedewireSettlementResponse>().toEqualTypeOf<SpecSchema<'SettlementResponse'>>()
 * ```
 */
export type SpecSchema<N extends keyof components['schemas']> = components['schemas'][N]
