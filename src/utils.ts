import type { TuyauKey, TuyauMutationKey, TuyauRequestOptions, QueryType } from './types.ts'

/**
 * Marker passed instead of request input to disable a query.
 * Translates to `enabled: false` in Pinia Colada, which has no
 * `skipToken` of its own.
 *
 * @example
 * useQuery(() => api.users.show.queryOptions(id.value ? { params: { id: id.value } } : skipToken))
 */
export const skipToken: unique symbol = Symbol.for('tuyau-pinia-colada.skipToken')
export type SkipToken = typeof skipToken

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `getArticles` -> `get_articles`, matching AdonisJS route names
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

/**
 * `['users', 'getProfile']` -> `'users.get_profile'`
 */
export function segmentsToRouteName(segments: string[]): string {
  return segments.map(toSnakeCase).join('.')
}

function splitSegments(segments: string[]): string[] {
  return segments.flatMap((part) => part.split('.'))
}

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
export function buildKey(opts: {
  segments: string[]
  request?: unknown
  type: QueryType
}): TuyauKey {
  const { segments, type } = opts
  const request = opts.request === skipToken ? undefined : opts.request
  const path = splitSegments(segments)

  if (request === undefined && type === 'any') {
    return [path]
  }

  let cleanRequest = request
  if (type === 'infinite' && isObject(request)) {
    cleanRequest = { ...request }
    for (const field of ['query', 'body'] as const) {
      const value = request[field]
      if (isObject(value) && ('cursor' in value || 'direction' in value)) {
        const { cursor: _c, direction: _d, ...rest } = value
        ;(cleanRequest as Record<string, unknown>)[field] = rest
      }
    }
  }

  const meta: { request?: any; type?: Exclude<QueryType, 'any'> } = {}
  if (cleanRequest !== undefined) meta.request = cleanRequest
  if (type !== 'any') meta.type = type

  return [path, meta]
}

export function buildMutationKey(segments: string[]): TuyauMutationKey {
  return [splitSegments(segments)]
}

/**
 * Drops Tuyau-only options so the rest can be forwarded to Ky
 */
export function extractKyOptions(
  options?: TuyauRequestOptions,
): Omit<TuyauRequestOptions, 'abortOnUnmount'> {
  if (!options) return {}
  const { abortOnUnmount: _, ...ky } = options
  return ky
}
