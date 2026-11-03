import { Tuyau } from '@tuyau/core/client';
import { SchemaEndpoint, RawRequestArgs, BaseRequestOptions, ResponseOf, ErrorOf, TuyauRegistry, InferTree, AdonisEndpoint, InferRoutes } from '@tuyau/core/types';
import { UseInfiniteQueryOptions, DefineInfiniteQueryOptionsTagged, EntryKeyTagged, UseInfiniteQueryData, UseQueryEntryFilter, _EmptyObject, UseMutationOptions, DefineQueryOptions, DefineQueryOptionsTagged } from '@pinia/colada';

/**
 * Marker passed instead of request input to disable a query.
 * Translates to `enabled: false` in Pinia Colada, which has no
 * `skipToken` of its own.
 *
 * @example
 * useQuery(() => api.users.show.queryOptions(id.value ? { params: { id: id.value } } : skipToken))
 */
declare const skipToken: unique symbol;
type SkipToken = typeof skipToken;
/**
 * `['users', 'getProfile']` -> `'users.get_profile'`
 */
declare function segmentsToRouteName(segments: string[]): string;
/**
 * Builds a query key. The shape is the same as `@tuyau/vue-query`:
 *
 *   [['users', 'show'], { request: { params: { id: 1 } }, type: 'query' }]
 *
 * Pinia Colada matches keys partially (arrays by index, objects by their
 * own properties), so `[['users']]` matches every query under `users`.
 *
 * For infinite queries, `cursor` and `direction` are stripped from the
 * request so every page shares one cache entry.
 */
declare function buildKey(opts: {
    segments: string[];
    request?: unknown;
    type: QueryType;
}): TuyauKey;

/**
 * `query` and `infinite` are written into keys so that a regular query and an
 * infinite query of the same route never share a cache entry. `any` is used
 * for path keys, which match both.
 */
type QueryType = 'any' | 'query' | 'infinite';
/**
 * `[routeSegments, { request?, type? }?]`
 */
type TuyauKey = readonly [string[]] | readonly [string[], {
    request?: any;
    type?: Exclude<QueryType, 'any'>;
}];
type TuyauMutationKey = readonly [string[]];
/**
 * Ky options, plus `abortOnUnmount` to forward Pinia Colada's abort signal
 */
interface TuyauRequestOptions extends BaseRequestOptions {
    abortOnUnmount?: boolean;
}
interface TuyauBaseOptions {
    tuyau?: TuyauRequestOptions;
}
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
/**
 * A key filter for `queryCache.invalidateQueries()`, `cancelQueries()`, etc.
 */
type TuyauQueryFilter = Simplify<UseQueryEntryFilter & {
    key: TuyauKey;
}>;
type ReservedQueryOptions = 'key' | 'query';
type TuyauQueryOptionsIn<TData, TError, TDataInitial extends TData | undefined> = Omit<DefineQueryOptions<TData, TError, TDataInitial>, ReservedQueryOptions> & TuyauBaseOptions;
interface TuyauQueryOptionsFn<E extends SchemaEndpoint> {
    <TDataInitial extends ResponseOf<E> | undefined = undefined>(input?: RawRequestArgs<E> | SkipToken, options?: TuyauQueryOptionsIn<ResponseOf<E>, ErrorOf<E>, TDataInitial>): DefineQueryOptionsTagged<ResponseOf<E>, ErrorOf<E>, TDataInitial>;
}
interface DecorateQuery<E extends SchemaEndpoint> {
    /**
     * Options for `useQuery()`. Wrap the call in a getter to keep it reactive:
     * `useQuery(() => api.users.show.queryOptions({ params: { id: id.value } }))`
     */
    queryOptions: TuyauQueryOptionsFn<E>;
    /**
     * The exact key of a query, tagged with its data and error types so
     * `queryCache.getQueryData()` and `setQueryData()` are typed
     */
    queryKey: (input?: RawRequestArgs<E>) => TuyauKey & EntryKeyTagged<ResponseOf<E>, ErrorOf<E>>;
    /**
     * A filter for one query of this route. Pass `exact: true` to skip children
     */
    queryFilter: (input?: RawRequestArgs<E>, filters?: Omit<UseQueryEntryFilter, 'key'>) => TuyauQueryFilter;
}
type ReservedInfiniteOptions = 'key' | 'query';
interface TuyauInfiniteBaseOptions {
    /**
     * Name of the query string parameter that receives the page param.
     * Must match a field of your backend validator.
     *
     * @default 'page'
     */
    pageParamKey?: string;
}
type TuyauInfiniteQueryOptionsIn<TData, TError, TPageParam> = Omit<UseInfiniteQueryOptions<TData, TError, TPageParam, undefined>, ReservedInfiniteOptions> & TuyauBaseOptions & TuyauInfiniteBaseOptions;
interface TuyauInfiniteQueryOptionsFn<E extends SchemaEndpoint> {
    <TPageParam = number>(input: RawRequestArgs<E> | SkipToken | undefined, options: TuyauInfiniteQueryOptionsIn<ResponseOf<E>, ErrorOf<E>, TPageParam>): DefineInfiniteQueryOptionsTagged<ResponseOf<E>, ErrorOf<E>, TPageParam>;
}
interface DecorateInfiniteQuery<E extends SchemaEndpoint> {
    /**
     * Options for `useInfiniteQuery()`. The page param is written into
     * `query[pageParamKey]` of the request
     */
    infiniteQueryOptions: TuyauInfiniteQueryOptionsFn<E>;
    infiniteQueryKey: <TPageParam = number>(input?: RawRequestArgs<E>) => TuyauKey & EntryKeyTagged<UseInfiniteQueryData<ResponseOf<E>, TPageParam>, ErrorOf<E>>;
    infiniteQueryFilter: (input?: RawRequestArgs<E>, filters?: Omit<UseQueryEntryFilter, 'key'>) => TuyauQueryFilter;
}
type ReservedMutationOptions = 'key' | 'mutation';
type TuyauMutationOptionsIn<TData, TVars, TError, TContext extends Record<any, any>> = Omit<UseMutationOptions<TData, TVars, TError, TContext>, ReservedMutationOptions> & TuyauBaseOptions;
type TuyauMutationOptionsOut<TData, TVars, TError, TContext extends Record<any, any>> = UseMutationOptions<TData, TVars, TError, TContext> & {
    key: TuyauMutationKey;
};
/**
 * Mutation variables. Optional when the route needs no params, query or body
 */
type MutationVars<E extends SchemaEndpoint> = {} extends RawRequestArgs<E> ? RawRequestArgs<E> | void : RawRequestArgs<E>;
interface TuyauMutationOptionsFn<E extends SchemaEndpoint> {
    <TContext extends Record<any, any> = _EmptyObject>(options?: TuyauMutationOptionsIn<ResponseOf<E>, MutationVars<E>, ErrorOf<E>, TContext>): TuyauMutationOptionsOut<ResponseOf<E>, MutationVars<E>, ErrorOf<E>, TContext>;
}
interface DecorateMutation<E extends SchemaEndpoint> {
    /**
     * Options for `useMutation()`. Call `mutate({ params, query, body })`
     */
    mutationOptions: TuyauMutationOptionsFn<E>;
    mutationKey: () => TuyauMutationKey;
}
interface DecorateRouterKeyable {
    /**
     * Key matching every query under this node, e.g. `api.users.pathKey()`
     * matches `users.index`, `users.show`, and their infinite variants
     */
    pathKey: () => TuyauKey;
    pathFilter: (filters?: Omit<UseQueryEntryFilter, 'key'>) => TuyauQueryFilter;
}
type EndpointKeys = 'methods' | 'pattern' | 'types';
type IsQueryMethod<E extends SchemaEndpoint> = E['methods'][number] extends 'GET' | 'HEAD' ? true : false;
type EndpointNode<E extends SchemaEndpoint> = (IsQueryMethod<E> extends true ? DecorateQuery<E> & DecorateInfiniteQuery<E> : DecorateMutation<E>) & DecorateRouterKeyable;
type TransformToPiniaColada<T> = {
    [K in keyof T]: T[K] extends SchemaEndpoint ? EndpointNode<T[K]> & TransformToPiniaColada<Omit<T[K], EndpointKeys>> : TransformToPiniaColada<T[K]>;
} & DecorateRouterKeyable;
type MutationOut<N> = N extends {
    mutationOptions: (...args: any[]) => infer O;
} ? O : never;
type QueryOut<N> = N extends {
    queryOptions: (...args: any[]) => infer O;
} ? O : never;
type IsNever<T> = [T] extends [never] ? true : false;
/**
 * Response type of a route node, e.g. `InferData<typeof api.users.show>`
 */
type InferData<N> = IsNever<QueryOut<N>> extends false ? QueryOut<N> extends DefineQueryOptionsTagged<infer D, any, any> ? D : never : MutationOut<N> extends {
    mutation: (...args: any[]) => Promise<infer D>;
} ? D : never;
/**
 * `TuyauError` type of a route node, typed from its error responses
 */
type InferError<N> = IsNever<QueryOut<N>> extends false ? QueryOut<N> extends DefineQueryOptionsTagged<any, infer Err, any> ? Err : never : MutationOut<N> extends {
    onError?: (error: infer Err, ...args: any[]) => any;
} ? Err : never;
/**
 * Request input (`params`, `query`, `body`) of a route node. For mutations,
 * this is what `mutate()` takes
 */
type InferInput<N> = N extends {
    queryKey: (input?: infer I) => any;
} ? I : MutationOut<N> extends {
    mutation: (vars: infer V, ...args: any[]) => any;
} ? V : never;

/**
 * Creates a type-safe Pinia Colada client from a Tuyau client.
 *
 * The returned object mirrors your route tree. GET and HEAD routes expose
 * `queryOptions`, `infiniteQueryOptions` and their keys; other routes expose
 * `mutationOptions`. Every node exposes `pathKey` and `pathFilter`.
 *
 * @example
 * export const api = createTuyauPiniaColadaClient({ client })
 *
 * const { data } = useQuery(() => api.users.show.queryOptions({ params: { id: id.value } }))
 */
declare function createTuyauPiniaColadaClient<Reg extends TuyauRegistry, Tree = InferTree<Reg>, Routes extends Record<string, AdonisEndpoint> = InferRoutes<Reg>>(options: {
    client: Tuyau<Reg, Routes>;
    globalOptions?: TuyauRequestOptions;
}): TransformToPiniaColada<Tree>;

/**
 * Shape of one entry in a VineJS `SimpleErrorReporter` response,
 * which is what Adonis returns for 422 JSON responses by default.
 */
interface ValidationIssue {
    message: string;
    field: string;
    rule: string;
    index?: number;
    meta?: Record<string, any>;
}
/**
 * Field name -> messages, in the order the server sent them
 */
type ErrorBag<Field extends string = string> = Partial<Record<Field, string[]>>;
/**
 * Groups the errors of a 422 VineJS validation response by field.
 * Returns `{}` for anything else (other statuses, network errors, `null`),
 * so it is safe to call on any `error` value.
 *
 * Nested fields keep VineJS's dotted names, e.g. `'items.0.name'`.
 *
 * @example
 * const { error } = useMutation(api.users.store.mutationOptions())
 * const errors = computed(() => toErrorBag<'email' | 'password'>(error.value))
 * // errors.value.email?.[0]
 */
declare function toErrorBag<Field extends string = string>(error: unknown): ErrorBag<Field>;
/**
 * First message per field. Handy for forms that show one message under each input.
 */
declare function firstErrors<Field extends string = string>(error: unknown): Partial<Record<Field, string>>;

export { buildKey, createTuyauPiniaColadaClient, firstErrors, segmentsToRouteName, skipToken, toErrorBag };
export type { DecorateInfiniteQuery, DecorateMutation, DecorateQuery, DecorateRouterKeyable, EndpointNode, ErrorBag, InferData, InferError, InferInput, QueryType, SkipToken, TransformToPiniaColada, TuyauBaseOptions, TuyauInfiniteBaseOptions, TuyauInfiniteQueryOptionsFn, TuyauInfiniteQueryOptionsIn, TuyauKey, TuyauMutationKey, TuyauMutationOptionsFn, TuyauMutationOptionsIn, TuyauMutationOptionsOut, TuyauQueryFilter, TuyauQueryOptionsFn, TuyauQueryOptionsIn, TuyauRequestOptions, ValidationIssue };
