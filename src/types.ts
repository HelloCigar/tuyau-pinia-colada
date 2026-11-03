import type {
  DefineInfiniteQueryOptionsTagged,
  DefineQueryOptions,
  DefineQueryOptionsTagged,
  EntryKeyTagged,
  UseInfiniteQueryData,
  UseInfiniteQueryOptions,
  UseMutationOptions,
  UseQueryEntryFilter,
  _EmptyObject,
} from '@pinia/colada'
import type {
  BaseRequestOptions,
  ErrorOf,
  RawRequestArgs,
  ResponseOf,
  SchemaEndpoint,
} from '@tuyau/core/types'

import type { SkipToken } from './utils.ts'

/**
 * `query` and `infinite` are written into keys so that a regular query and an
 * infinite query of the same route never share a cache entry. `any` is used
 * for path keys, which match both.
 */
export type QueryType = 'any' | 'query' | 'infinite'

/**
 * `[routeSegments, { request?, type? }?]`
 */
export type TuyauKey =
  | readonly [string[]]
  | readonly [string[], { request?: any; type?: Exclude<QueryType, 'any'> }]

export type TuyauMutationKey = readonly [string[]]

/**
 * Ky options, plus `abortOnUnmount` to forward Pinia Colada's abort signal
 */
export interface TuyauRequestOptions extends BaseRequestOptions {
  abortOnUnmount?: boolean
}

export interface TuyauBaseOptions {
  tuyau?: TuyauRequestOptions
}

type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * A key filter for `queryCache.invalidateQueries()`, `cancelQueries()`, etc.
 */
export type TuyauQueryFilter = Simplify<UseQueryEntryFilter & { key: TuyauKey }>

/* ----------------------------------------------------------------------------
 * Queries
 * ------------------------------------------------------------------------- */

type ReservedQueryOptions = 'key' | 'query'

export type TuyauQueryOptionsIn<TData, TError, TDataInitial extends TData | undefined> = Omit<
  DefineQueryOptions<TData, TError, TDataInitial>,
  ReservedQueryOptions
> &
  TuyauBaseOptions

export interface TuyauQueryOptionsFn<E extends SchemaEndpoint> {
  <TDataInitial extends ResponseOf<E> | undefined = undefined>(
    input?: RawRequestArgs<E> | SkipToken,
    options?: TuyauQueryOptionsIn<ResponseOf<E>, ErrorOf<E>, TDataInitial>,
  ): DefineQueryOptionsTagged<ResponseOf<E>, ErrorOf<E>, TDataInitial>
}

export interface DecorateQuery<E extends SchemaEndpoint> {
  /**
   * Options for `useQuery()`. Wrap the call in a getter to keep it reactive:
   * `useQuery(() => api.users.show.queryOptions({ params: { id: id.value } }))`
   */
  queryOptions: TuyauQueryOptionsFn<E>
  /**
   * The exact key of a query, tagged with its data and error types so
   * `queryCache.getQueryData()` and `setQueryData()` are typed
   */
  queryKey: (input?: RawRequestArgs<E>) => TuyauKey & EntryKeyTagged<ResponseOf<E>, ErrorOf<E>>
  /**
   * A filter for one query of this route. Pass `exact: true` to skip children
   */
  queryFilter: (
    input?: RawRequestArgs<E>,
    filters?: Omit<UseQueryEntryFilter, 'key'>,
  ) => TuyauQueryFilter
}

/* ----------------------------------------------------------------------------
 * Infinite queries
 * ------------------------------------------------------------------------- */

type ReservedInfiniteOptions = 'key' | 'query'

export interface TuyauInfiniteBaseOptions {
  /**
   * Name of the query string parameter that receives the page param.
   * Must match a field of your backend validator.
   *
   * @default 'page'
   */
  pageParamKey?: string
}

export type TuyauInfiniteQueryOptionsIn<TData, TError, TPageParam> = Omit<
  UseInfiniteQueryOptions<TData, TError, TPageParam, undefined>,
  ReservedInfiniteOptions
> &
  TuyauBaseOptions &
  TuyauInfiniteBaseOptions

export interface TuyauInfiniteQueryOptionsFn<E extends SchemaEndpoint> {
  <TPageParam = number>(
    input: RawRequestArgs<E> | SkipToken | undefined,
    options: TuyauInfiniteQueryOptionsIn<ResponseOf<E>, ErrorOf<E>, TPageParam>,
  ): DefineInfiniteQueryOptionsTagged<ResponseOf<E>, ErrorOf<E>, TPageParam>
}

export interface DecorateInfiniteQuery<E extends SchemaEndpoint> {
  /**
   * Options for `useInfiniteQuery()`. The page param is written into
   * `query[pageParamKey]` of the request
   */
  infiniteQueryOptions: TuyauInfiniteQueryOptionsFn<E>
  infiniteQueryKey: <TPageParam = number>(
    input?: RawRequestArgs<E>,
  ) => TuyauKey &
    EntryKeyTagged<UseInfiniteQueryData<ResponseOf<E>, TPageParam>, ErrorOf<E>>
  infiniteQueryFilter: (
    input?: RawRequestArgs<E>,
    filters?: Omit<UseQueryEntryFilter, 'key'>,
  ) => TuyauQueryFilter
}

/* ----------------------------------------------------------------------------
 * Mutations
 * ------------------------------------------------------------------------- */

type ReservedMutationOptions = 'key' | 'mutation'

export type TuyauMutationOptionsIn<
  TData,
  TVars,
  TError,
  TContext extends Record<any, any>,
> = Omit<UseMutationOptions<TData, TVars, TError, TContext>, ReservedMutationOptions> &
  TuyauBaseOptions

export type TuyauMutationOptionsOut<
  TData,
  TVars,
  TError,
  TContext extends Record<any, any>,
> = UseMutationOptions<TData, TVars, TError, TContext> & { key: TuyauMutationKey }

/**
 * Mutation variables. Optional when the route needs no params, query or body
 */
type MutationVars<E extends SchemaEndpoint> = {} extends RawRequestArgs<E>
  ? RawRequestArgs<E> | void
  : RawRequestArgs<E>

export interface TuyauMutationOptionsFn<E extends SchemaEndpoint> {
  <TContext extends Record<any, any> = _EmptyObject>(
    options?: TuyauMutationOptionsIn<ResponseOf<E>, MutationVars<E>, ErrorOf<E>, TContext>,
  ): TuyauMutationOptionsOut<ResponseOf<E>, MutationVars<E>, ErrorOf<E>, TContext>
}

export interface DecorateMutation<E extends SchemaEndpoint> {
  /**
   * Options for `useMutation()`. Call `mutate({ params, query, body })`
   */
  mutationOptions: TuyauMutationOptionsFn<E>
  mutationKey: () => TuyauMutationKey
}

/* ----------------------------------------------------------------------------
 * Tree
 * ------------------------------------------------------------------------- */

export interface DecorateRouterKeyable {
  /**
   * Key matching every query under this node, e.g. `api.users.pathKey()`
   * matches `users.index`, `users.show`, and their infinite variants
   */
  pathKey: () => TuyauKey
  pathFilter: (filters?: Omit<UseQueryEntryFilter, 'key'>) => TuyauQueryFilter
}

type EndpointKeys = 'methods' | 'pattern' | 'types'

type IsQueryMethod<E extends SchemaEndpoint> = E['methods'][number] extends 'GET' | 'HEAD'
  ? true
  : false

export type EndpointNode<E extends SchemaEndpoint> = (IsQueryMethod<E> extends true
  ? DecorateQuery<E> & DecorateInfiniteQuery<E>
  : DecorateMutation<E>) &
  DecorateRouterKeyable

export type TransformToPiniaColada<T> = {
  [K in keyof T]: T[K] extends SchemaEndpoint
    ? EndpointNode<T[K]> & TransformToPiniaColada<Omit<T[K], EndpointKeys>>
    : TransformToPiniaColada<T[K]>
} & DecorateRouterKeyable

/* ----------------------------------------------------------------------------
 * Inference helpers
 * ------------------------------------------------------------------------- */

type MutationOut<N> = N extends { mutationOptions: (...args: any[]) => infer O } ? O : never
type QueryOut<N> = N extends { queryOptions: (...args: any[]) => infer O } ? O : never
type IsNever<T> = [T] extends [never] ? true : false

/**
 * Response type of a route node, e.g. `InferData<typeof api.users.show>`
 */
export type InferData<N> =
  IsNever<QueryOut<N>> extends false
    ? QueryOut<N> extends DefineQueryOptionsTagged<infer D, any, any>
      ? D
      : never
    : MutationOut<N> extends { mutation: (...args: any[]) => Promise<infer D> }
      ? D
      : never

/**
 * `TuyauError` type of a route node, typed from its error responses
 */
export type InferError<N> =
  IsNever<QueryOut<N>> extends false
    ? QueryOut<N> extends DefineQueryOptionsTagged<any, infer Err, any>
      ? Err
      : never
    : MutationOut<N> extends { onError?: (error: infer Err, ...args: any[]) => any }
      ? Err
      : never

/**
 * Request input (`params`, `query`, `body`) of a route node. For mutations,
 * this is what `mutate()` takes
 */
export type InferInput<N> = N extends { queryKey: (input?: infer I) => any }
  ? I
  : MutationOut<N> extends { mutation: (vars: infer V, ...args: any[]) => any }
    ? V
    : never

/**
 * Request body of a route node, e.g. `InferBody<typeof api.users.store>`.
 * Handy to type a form's state. `never` when the route takes no body
 */
export type InferBody<N> = BodyOf<Exclude<InferInput<N>, void | undefined>>

type BodyOf<I> = 'body' extends keyof I
  ? I extends { body?: infer B }
    ? Exclude<B, undefined>
    : never
  : never
