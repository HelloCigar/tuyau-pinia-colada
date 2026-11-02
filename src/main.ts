import type { Tuyau } from '@tuyau/core/client'
import type {
  AdonisEndpoint,
  InferRoutes,
  InferTree,
  RawRequestArgs,
  TuyauRegistry,
} from '@tuyau/core/types'

import {
  buildKey,
  buildMutationKey,
  extractKyOptions,
  isObject,
  segmentsToRouteName,
  skipToken,
} from './utils.ts'
import type { TransformToPiniaColada, TuyauRequestOptions } from './types.ts'


function rejectSkipped(): Promise<never> {
  return Promise.reject(
    new Error('[tuyau-pinia-colada] A query called with skipToken was refetched manually.'),
  )
}

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
export function createTuyauPiniaColadaClient<
  Reg extends TuyauRegistry,
  Tree = InferTree<Reg>,
  Routes extends Record<string, AdonisEndpoint> = InferRoutes<Reg>,
>(options: {
  client: Tuyau<Reg, Routes>
  globalOptions?: TuyauRequestOptions
}): TransformToPiniaColada<Tree> {
  const { client, globalOptions } = options

  function send(
    routeName: string,
    request: RawRequestArgs<any> | undefined,
    local: TuyauRequestOptions | undefined,
    signal?: AbortSignal,
  ) {
    const abort = local?.abortOnUnmount ?? globalOptions?.abortOnUnmount ?? false
    return (client as Tuyau<any>).request(routeName as never, {
      ...extractKyOptions(globalOptions),
      ...(request ?? {}),
      ...extractKyOptions(local),
      // Pinia Colada owns retries
      retry: 0,
      ...(abort && signal ? { signal } : {}),
    } as any) as Promise<unknown>
  }

  function makeNode(segments: string[]): any {
    const routeName = segmentsToRouteName(segments)

    const node = {
      queryOptions(input?: RawRequestArgs<any> | typeof skipToken, opts?: any) {
        const { tuyau, enabled, ...rest } = opts ?? {}
        const skipped = input === skipToken
        const request = skipped ? undefined : (input as RawRequestArgs<any> | undefined)

        return {
          ...rest,
          key: buildKey({ segments, request, type: 'query' }),
          query: skipped
            ? rejectSkipped
            : ({ signal }: { signal: AbortSignal }) => send(routeName, request, tuyau, signal),
          ...(skipped ? { enabled: false } : enabled !== undefined ? { enabled } : {}),
        }
      },
      queryKey: (input?: RawRequestArgs<any>) =>
        buildKey({ segments, request: input, type: 'query' }),
      queryFilter: (input?: RawRequestArgs<any>, filters?: object) => ({
        ...filters,
        key: buildKey({ segments, request: input, type: 'query' }),
      }),

      infiniteQueryOptions(input: RawRequestArgs<any> | typeof skipToken | undefined, opts: any) {
        const { tuyau, enabled, pageParamKey = 'page', ...rest } = opts ?? {}
        const skipped = input === skipToken
        const request = skipped ? undefined : (input as RawRequestArgs<any> | undefined)

        return {
          initialPageParam: 1,
          getNextPageParam: () => null,
          ...rest,
          key: buildKey({ segments, request, type: 'infinite' }),
          query: skipped
            ? rejectSkipped
            : ({ signal, pageParam }: { signal: AbortSignal; pageParam: unknown }) => {
                const base = isObject(request) ? request : {}
                const withPage =
                  pageParam === undefined
                    ? base
                    : { ...base, query: { ...(base as any).query, [pageParamKey]: pageParam } }
                return send(routeName, withPage as RawRequestArgs<any>, tuyau, signal)
              },
          ...(skipped ? { enabled: false } : enabled !== undefined ? { enabled } : {}),
        }
      },
      infiniteQueryKey: (input?: RawRequestArgs<any>) =>
        buildKey({ segments, request: input, type: 'infinite' }),
      infiniteQueryFilter: (input?: RawRequestArgs<any>, filters?: object) => ({
        ...filters,
        key: buildKey({ segments, request: input, type: 'infinite' }),
      }),

      mutationOptions(opts?: any) {
        const { tuyau, ...rest } = opts ?? {}
        return {
          ...rest,
          key: buildMutationKey(segments),
          mutation: (vars: RawRequestArgs<any> | undefined) =>
            send(routeName, vars ?? undefined, tuyau),
        }
      },
      mutationKey: () => buildMutationKey(segments),

      pathKey: () => buildKey({ segments, type: 'any' }),
      pathFilter: (filters?: object) => ({ ...filters, key: buildKey({ segments, type: 'any' }) }),
    }

    return new Proxy(node, {
      get(target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (prop in target) return target[prop as keyof typeof target]
        return makeNode([...segments, prop])
      },
    })
  }

  return makeNode([]) as TransformToPiniaColada<Tree>
}
