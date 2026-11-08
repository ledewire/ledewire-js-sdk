/**
 * Type-level pins: each method's exported return type must be exactly what its
 * operation's success response declares in `ledewire.yml`. A divergence is a
 * compile error, so `pnpm typecheck` fails before any test runs.
 */
import { describe, it, expectTypeOf } from 'vitest'
import type {
  AuthPasswordResetBody,
  AuthPasswordResetRequestBody,
  AuthPasswordResetResponse,
  AuthTokenRefreshResponse,
  CheckoutStateResponse,
  CompanyMemberUpdateRequest,
  ContentWithAccessResponse,
  PublicationWork,
  PurchaseResponse,
  UserApiKey,
  UserApiKeyCreateRequest,
  UserSpendCapUpdateRequest,
  StoreAuthenticationResponse,
  WalletPaymentStatusResponse,
  X402JwksResponse,
  X402VerifyOriginResponse,
} from '@ledewire/core'
import type {
  OperationBody,
  OperationOk,
  OperationQuery,
  Returns,
  SpecSchema,
} from '@ledewire/core/test-utils'
import type { NodeClient } from './client.js'
import type {
  AcquisitionCreateRequest,
  AcquisitionWorksParams,
  BuyerContentSearchRequest,
  CompanyMachineUserUpdateRequest,
  CompanyMember,
  CompanyPurchasesParams,
  CompanyReportFilters,
  CompanySpendParams,
  Content,
  ContentSearchRequest,
  MerchantDomainAddRequest,
  MerchantDomainVerifyRequest,
  MerchantDomainVerifyResponse,
  MerchantPasswordResetBody,
  MerchantPasswordResetRequestBody,
  MerchantPasswordResetResponse,
  MerchantPricingRuleCreateRequest,
  MerchantUserUpdateRequest,
  PublicationListParams,
  PublicationWorksParams,
  StoreConfig,
  X402DiscoveryParams,
} from './index.js'

describe('return types match the spec operation responses', () => {
  it('content.getWithAccess', () => {
    type Op = OperationOk<'/v1/content/{id}/with-access', 'get'>
    expectTypeOf<Returns<NodeClient['content']['getWithAccess']>>().toEqualTypeOf<Op>()
    expectTypeOf<ContentWithAccessResponse>().toEqualTypeOf<Op>()
  })

  it('checkout.state', () => {
    type Op = OperationOk<'/v1/checkout/state/{content_id}', 'get'>
    expectTypeOf<Returns<NodeClient['checkout']['state']>>().toEqualTypeOf<Op>()
    expectTypeOf<CheckoutStateResponse>().toEqualTypeOf<Op>()
  })

  it('wallet.getPaymentStatus', () => {
    type Op = OperationOk<'/v1/wallet/payment-status/{session_id}', 'get'>
    expectTypeOf<Returns<NodeClient['wallet']['getPaymentStatus']>>().toEqualTypeOf<Op>()
    expectTypeOf<WalletPaymentStatusResponse>().toEqualTypeOf<Op>()
  })

  it('auth.signup answers 201', () => {
    expectTypeOf<Returns<NodeClient['auth']['signup']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/signup', 'post', 201>
    >()
  })

  it('auth password reset returns a flat message', () => {
    expectTypeOf<Returns<NodeClient['auth']['requestPasswordReset']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/password/reset-request', 'post'>
    >()
    expectTypeOf<Returns<NodeClient['auth']['resetPassword']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/password/reset', 'post'>
    >()
    expectTypeOf<Returns<NodeClient['merchant']['auth']['requestPasswordReset']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/merchant/password/reset-request', 'post'>
    >()
    expectTypeOf<Returns<NodeClient['merchant']['auth']['resetPassword']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/merchant/password/reset', 'post'>
    >()
  })

  it('auth.loginWithApiKey answers the store token shape with store_id', () => {
    type Op = OperationOk<'/v1/auth/login/api-key', 'post'>
    expectTypeOf<Returns<NodeClient['auth']['loginWithApiKey']>>().toEqualTypeOf<Op>()
    expectTypeOf<StoreAuthenticationResponse>().toEqualTypeOf<Op>()
    expectTypeOf<Op['store_id']>().toEqualTypeOf<string>()
  })

  it('token refresh answers any of the token responses', () => {
    expectTypeOf<AuthTokenRefreshResponse>().toEqualTypeOf<
      OperationOk<'/v1/auth/token/refresh', 'post'>
    >()
  })

  it('x402.verifyOrigin and x402.getJwks', () => {
    type Verify = OperationOk<'/v1/x402/verify-origin', 'get'>
    expectTypeOf<Returns<NodeClient['x402']['verifyOrigin']>>().toEqualTypeOf<Verify>()
    expectTypeOf<X402VerifyOriginResponse>().toEqualTypeOf<Verify>()
    type Jwks = OperationOk<'/.well-known/x402-jwks.json', 'get'>
    expectTypeOf<Returns<NodeClient['x402']['getJwks']>>().toEqualTypeOf<Jwks>()
    expectTypeOf<X402JwksResponse>().toEqualTypeOf<Jwks>()
  })

  it('company.members.update needs role or daily_spend_limit_cents', () => {
    expectTypeOf<{ role: 'admin' }>().toExtend<CompanyMemberUpdateRequest>()
    expectTypeOf<{ daily_spend_limit_cents: 500 }>().toExtend<CompanyMemberUpdateRequest>()
    expectTypeOf<{
      role: 'member'
      daily_spend_limit_cents: 500
    }>().toExtend<CompanyMemberUpdateRequest>()
    expectTypeOf<Record<string, never>>().not.toExtend<CompanyMemberUpdateRequest>()
    // A member is never uncapped, and `owner` is a store role, not a Company one.
    expectTypeOf<{ daily_spend_limit_cents: null }>().not.toExtend<CompanyMemberUpdateRequest>()
    expectTypeOf<{ role: 'owner' }>().not.toExtend<CompanyMemberUpdateRequest>()
  })

  it('merchant.sales.get names the buyer only by buyer_ref', () => {
    type Sale = Returns<NodeClient['merchant']['sales']['get']>
    expectTypeOf<Sale>().toEqualTypeOf<OperationOk<'/v1/merchant/{store_id}/sales/{id}', 'get'>>()
    expectTypeOf<Sale['buyer_ref']>().toEqualTypeOf<string>()
    expectTypeOf<Sale>().not.toHaveProperty('buyer_id')
    expectTypeOf<Sale>().not.toHaveProperty('buyer')
    expectTypeOf<Sale['fees']['store_net_cents']>().toEqualTypeOf<number | null>()
  })

  it('content.search takes the buyer search request, exported as ContentSearchRequest', () => {
    // limit defaults on the server, though the spec marks it required, so every field is optional.
    type Body = Partial<OperationBody<'/v1/content/search', 'post'>>
    expectTypeOf<ContentSearchRequest>().toEqualTypeOf<Body>()
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- pins the deprecated alias to its replacement
    expectTypeOf<BuyerContentSearchRequest>().toEqualTypeOf<ContentSearchRequest>()
    expectTypeOf<
      Parameters<NodeClient['content']['search']>[0]
    >().toEqualTypeOf<ContentSearchRequest>()
    expectTypeOf<ContentSearchRequest>().toHaveProperty('query')
    expectTypeOf<ContentSearchRequest>().not.toHaveProperty('title')
  })

  it('invitation lookup and accept', () => {
    expectTypeOf<Returns<NodeClient['auth']['getInviteInfo']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/invite-info/{token}', 'get'>
    >()
    expectTypeOf<Returns<NodeClient['merchant']['auth']['acceptInvitation']>>().toEqualTypeOf<
      OperationOk<'/v1/auth/merchant/accept-invitation', 'post'>
    >()
  })
})

/**
 * Exported request, response and parameter types that name an operation's inline
 * schema. Each is an alias of (or `Omit` over) the generated type, so a hand-typed
 * copy that drifts from `ledewire.yml` fails typecheck here.
 */
describe('hand-named types alias the spec', () => {
  it('password reset bodies and responses', () => {
    expectTypeOf<AuthPasswordResetRequestBody>().toEqualTypeOf<
      OperationBody<'/v1/auth/password/reset-request', 'post'>
    >()
    expectTypeOf<AuthPasswordResetBody>().toEqualTypeOf<
      OperationBody<'/v1/auth/password/reset', 'post'>
    >()
    expectTypeOf<MerchantPasswordResetRequestBody>().toEqualTypeOf<
      OperationBody<'/v1/auth/merchant/password/reset-request', 'post'>
    >()
    expectTypeOf<MerchantPasswordResetBody>().toEqualTypeOf<
      OperationBody<'/v1/auth/merchant/password/reset', 'post'>
    >()
    expectTypeOf<MerchantPasswordResetResponse>().toEqualTypeOf<SpecSchema<'MessageResponse'>>()
    expectTypeOf<AuthPasswordResetResponse>().toEqualTypeOf<SpecSchema<'MessageResponse'>>()
  })

  it('merchant domains, pricing rules and users', () => {
    expectTypeOf<MerchantDomainAddRequest>().toEqualTypeOf<
      OperationBody<'/v1/merchant/{store_id}/domains', 'post'>
    >()
    expectTypeOf<MerchantDomainVerifyRequest>().toEqualTypeOf<
      OperationBody<'/v1/merchant/{store_id}/domains/verify', 'post'>
    >()
    expectTypeOf<MerchantDomainVerifyResponse>().toEqualTypeOf<
      OperationOk<'/v1/merchant/{store_id}/domains/verify', 'post', 202>
    >()
    expectTypeOf<MerchantPricingRuleCreateRequest>().toEqualTypeOf<
      OperationBody<'/v1/merchant/{store_id}/pricing_rules', 'post'>
    >()
    expectTypeOf<MerchantUserUpdateRequest>().toEqualTypeOf<
      OperationBody<'/v1/merchant/{store_id}/users/{id}', 'patch'>
    >()
  })

  it('merchant.config.get answers StoreConfig', () => {
    type Op = OperationOk<'/v1/merchant/{store_id}/config', 'get'>
    expectTypeOf<StoreConfig>().toEqualTypeOf<Op>()
    expectTypeOf<Returns<NodeClient['merchant']['config']['get']>>().toEqualTypeOf<Op>()
  })

  it('acquisitions', () => {
    expectTypeOf<AcquisitionCreateRequest>().toEqualTypeOf<
      OperationBody<'/v1/acquisitions', 'post'>
    >()
    // `limit` is the spec's alias for `per_page`; the SDK takes one name for it.
    expectTypeOf<AcquisitionWorksParams>().toEqualTypeOf<
      Omit<OperationQuery<'/v1/acquisitions/{acquisition_id}/works', 'get'>, 'limit'>
    >()
  })

  it('publications and x402 discovery', () => {
    expectTypeOf<PublicationWorksParams>().toEqualTypeOf<
      OperationQuery<'/v1/publications/{id}/works', 'get'>
    >()
    type List = OperationQuery<'/v1/publications', 'get'>
    // `topics` is sent as `topics[]`; `limit` is the spec's alias for `per_page`.
    expectTypeOf<PublicationListParams>().toEqualTypeOf<
      Omit<List, 'topics[]' | 'limit'> & { topics?: List['topics[]'] }
    >()
    expectTypeOf<X402DiscoveryParams>().toEqualTypeOf<
      OperationQuery<'/v1/x402/discovery/resources', 'get'>
    >()
  })

  it('company report params', () => {
    type Spend = OperationQuery<'/v1/company/spend', 'get'>
    expectTypeOf<CompanyReportFilters>().toEqualTypeOf<Spend>()
    expectTypeOf<CompanySpendParams>().toEqualTypeOf<Spend>()
    expectTypeOf<CompanyPurchasesParams>().toEqualTypeOf<
      Omit<OperationQuery<'/v1/company/purchases', 'get'>, 'limit'>
    >()
    expectTypeOf<CompanyPurchasesParams>().toExtend<CompanyReportFilters>()
  })

  it('Content keeps its union but takes its fields from the generated schema', () => {
    type Spec = SpecSchema<'Content'>
    expectTypeOf<Content>().toExtend<Spec>()
    expectTypeOf<Content['content_type']>().toEqualTypeOf<Spec['content_type']>()
    expectTypeOf<Content['title']>().toEqualTypeOf<Spec['title']>()
    expectTypeOf<Content['price_cents']>().toEqualTypeOf<Spec['price_cents']>()
    expectTypeOf<Content['visibility']>().toEqualTypeOf<Spec['visibility']>()
    expectTypeOf<Content['metadata']>().toEqualTypeOf<Spec['metadata']>()
  })

  it('member and Machine user updates take their fields from the generated schemas', () => {
    // The spec's "at least one of" `anyOf` branches now carry `properties`, but the
    // generator adds a branch with every field optional, so the generated types accept
    // an empty body the API refuses. The hand-written types keep "at least one" and
    // must stay assignable to the generated ones. If the generated types stop
    // accepting `{}`, the last two lines fail: alias the generated types then.
    expectTypeOf<CompanyMemberUpdateRequest>().toExtend<SpecSchema<'CompanyMemberRoleRequest'>>()
    expectTypeOf<CompanyMachineUserUpdateRequest>().toExtend<
      SpecSchema<'CompanyMachineUserUpdateRequest'>
    >()
    expectTypeOf<Record<string, never>>().toExtend<SpecSchema<'CompanyMemberRoleRequest'>>()
    expectTypeOf<Record<string, never>>().toExtend<SpecSchema<'CompanyMachineUserUpdateRequest'>>()

    expectTypeOf<NonNullable<CompanyMemberUpdateRequest['role']>>().toEqualTypeOf<
      CompanyMember['role']
    >()
    expectTypeOf<
      NonNullable<CompanyMemberUpdateRequest['daily_spend_limit_cents']>
    >().toEqualTypeOf<CompanyMember['daily_spend_limit_cents']>()
    type MachineUser = SpecSchema<'CompanyMachineUserRequest'>
    expectTypeOf<NonNullable<CompanyMachineUserUpdateRequest['name']>>().toEqualTypeOf<
      MachineUser['name']
    >()
    expectTypeOf<CompanyMachineUserUpdateRequest['description']>().toEqualTypeOf<
      MachineUser['description']
    >()
    expectTypeOf<{ name: 'Bot' }>().toExtend<CompanyMachineUserUpdateRequest>()
    expectTypeOf<{ description: null }>().toExtend<CompanyMachineUserUpdateRequest>()
    expectTypeOf<Record<string, never>>().not.toExtend<CompanyMachineUserUpdateRequest>()
    expectTypeOf<{ name: null }>().not.toExtend<CompanyMachineUserUpdateRequest>()
  })
})

describe('API 4c5f4a56 sync', () => {
  it('the spend cap takes a number and never null', () => {
    expectTypeOf<UserSpendCapUpdateRequest['daily_spend_limit_cents']>().toEqualTypeOf<number>()
    expectTypeOf<UserSpendCapUpdateRequest>().toEqualTypeOf<
      OperationBody<'/v1/user/spend-cap', 'patch'>
    >()
  })

  it('a purchase names the Payment key that paid for it, or null', () => {
    expectTypeOf<PurchaseResponse['payment_key_id']>().toEqualTypeOf<string | null>()
  })

  it('a publication work carries its labels', () => {
    type Work = SpecSchema<'PublicationWork'>
    expectTypeOf<PublicationWork>().toEqualTypeOf<Work>()
    expectTypeOf<PublicationWork['page_kind']>().toEqualTypeOf<
      'article' | 'section_index' | 'homepage' | 'media' | 'utility' | 'unclassified'
    >()
    expectTypeOf<PublicationWork['page_kind_basis']>().toEqualTypeOf<'observed' | 'rule' | null>()
    expectTypeOf<PublicationWork['topics_basis']>().toEqualTypeOf<'rule' | 'inherited'>()
    expectTypeOf<PublicationWork['topics']>().toEqualTypeOf<SpecSchema<'TopicSlug'>[]>()
    expectTypeOf<NonNullable<PublicationWorksParams['page_kind']>>().toEqualTypeOf<
      PublicationWork['page_kind']
    >()
  })

  it('a Buyer key has no spending limit', () => {
    expectTypeOf<
      'spending_limit_cents' extends keyof UserApiKey ? true : false
    >().toEqualTypeOf<false>()
    expectTypeOf<
      'spending_limit_cents' extends keyof UserApiKeyCreateRequest ? true : false
    >().toEqualTypeOf<false>()
  })
})
