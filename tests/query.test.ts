import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { useQuery, useQueryCache } from '@pinia/colada'

import { skipToken } from '../src/index.ts'
import { setup, mountWith, flushPromises } from './helpers/index.ts'

describe('keys', () => {
  const { api } = setup()

  test('queryKey keeps the @tuyau/vue-query shape', () => {
    expect(api.users.show.queryKey({ params: { id: '1' } })).toEqual([
      ['users', 'show'],
      { request: { params: { id: '1' } }, type: 'query' },
    ])
  })

  test('pathKey has no metadata', () => {
    expect(api.users.pathKey()).toEqual([['users']])
    expect(api.pathKey()).toEqual([[]])
  })

  test('camelCase segments stay as written in keys', () => {
    expect(api.admin.reports.getSummary.pathKey()).toEqual([['admin', 'reports', 'getSummary']])
  })

  test('infinite keys drop cursor and direction', () => {
    expect(
      api.articles.index.infiniteQueryKey({ query: { search: 'ts', cursor: 3, direction: 'forward' } as any }),
    ).toEqual([['articles', 'index'], { request: { query: { search: 'ts' } }, type: 'infinite' }])
  })

  test('filters carry the key and extra options', () => {
    expect(api.users.pathFilter({ active: true })).toEqual({ active: true, key: [['users']] })
    expect(api.users.show.queryFilter({ params: { id: '1' } }, { exact: true })).toEqual({
      exact: true,
      key: [['users', 'show'], { request: { params: { id: '1' } }, type: 'query' }],
    })
  })
})

describe('queryOptions', () => {
  test('fetches through the Tuyau client', async () => {
    const { api, requests } = setup(() => ({ body: [{ id: 1, name: 'foo' }] }))
    const { result, wrapper } = mountWith(() =>
      useQuery(() => api.users.index.queryOptions({ query: { name: 'foo' } })),
    )
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))

    expect(result.data.value).toEqual([{ id: 1, name: 'foo' }])
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('GET')
    expect(requests[0].url.pathname).toBe('/users')
    expect(requests[0].url.searchParams.get('name')).toBe('foo')
    wrapper.unmount()
  })

  test('route params and snake_case route names', async () => {
    const { api, requests } = setup(({ url }) =>
      url.pathname === '/users/42' ? { body: { id: 42, name: 'x' } } : { body: { total: 3 } },
    )
    const { result, wrapper } = mountWith(() => ({
      user: useQuery(() => api.users.show.queryOptions({ params: { id: '42' } })),
      summary: useQuery(() => api.admin.reports.getSummary.queryOptions()),
    }))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))

    expect(result.user.data.value).toEqual({ id: 42, name: 'x' })
    expect(result.summary.data.value).toEqual({ total: 3 })
    expect(requests.map((r) => r.url.pathname).sort()).toEqual(['/admin/reports/summary', '/users/42'])
    wrapper.unmount()
  })

  test('refetches when a reactive input changes', async () => {
    const { api, requests } = setup(({ url }) => ({ body: { id: Number(url.pathname.split('/')[2]), name: 'u' } }))
    const id = ref('1')
    const { result, wrapper } = mountWith(() =>
      useQuery(() => api.users.show.queryOptions({ params: { id: id.value } })),
    )
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.data.value?.id).toBe(1)

    id.value = '2'
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.data.value?.id).toBe(2)
    expect(requests).toHaveLength(2)
    wrapper.unmount()
  })

  test('skipToken disables the query', async () => {
    const { api, requests } = setup(() => ({ body: { id: 1, name: 'u' } }))
    const id = ref<string | null>(null)
    const { result, wrapper } = mountWith(() =>
      useQuery(() => api.users.show.queryOptions(id.value ? { params: { id: id.value } } : skipToken)),
    )
    await flushPromises()
    expect(requests).toHaveLength(0)
    expect(result.status.value).toBe('pending')

    id.value = '1'
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(requests).toHaveLength(1)
    expect(result.data.value).toEqual({ id: 1, name: 'u' })
    wrapper.unmount()
  })

  test('passes Pinia Colada options through and merges Ky options', async () => {
    const { api } = setup(() => ({ body: [] }), { headers: { 'x-global': 'g' } })
    const opts = api.users.index.queryOptions(undefined, {
      staleTime: 1234,
      tuyau: { headers: { 'x-local': 'l' } },
    }) as any
    expect(opts.staleTime).toBe(1234)
    expect(opts.tuyau).toBeUndefined()
    expect(typeof opts.query).toBe('function')
  })

  test('abortOnUnmount forwards the signal', async () => {
    const { api, requests } = setup(() => ({ body: [] }))
    const { wrapper } = mountWith(() =>
      useQuery(() => api.users.index.queryOptions({}, { tuyau: { abortOnUnmount: true } })),
    )
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(requests[0].signal).toBeInstanceOf(AbortSignal)
    wrapper.unmount()
  })

  test('errors surface as TuyauError', async () => {
    const { api } = setup(() => ({ status: 404, body: { message: 'nope' } }))
    const { result, wrapper } = mountWith(() =>
      useQuery(() => api.users.show.queryOptions({ params: { id: '9' } })),
    )
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.status.value).toBe('error')
    expect(result.error.value?.name).toBe('TuyauHTTPError')
    expect(result.error.value?.isStatus(404)).toBe(true)
    wrapper.unmount()
  })
})

describe('cache', () => {
  test('pathKey invalidates every query under a node', async () => {
    let n = 0
    const { api, requests } = setup(({ url }) =>
      url.pathname === '/users' ? { body: [{ id: ++n, name: 'u' }] } : { body: { id: 1, name: `v${++n}` } },
    )
    const { result, wrapper } = mountWith(() => ({
      list: useQuery(() => api.users.index.queryOptions()),
      one: useQuery(() => api.users.show.queryOptions({ params: { id: '1' } })),
      other: useQuery(() => api.admin.reports.getSummary.queryOptions()),
      cache: useQueryCache(),
    }))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(requests).toHaveLength(3)

    await result.cache.invalidateQueries({ key: api.users.pathKey() })
    await flushPromises()
    expect(requests).toHaveLength(5)
    expect(requests.slice(3).map((r) => r.url.pathname).sort()).toEqual(['/users', '/users/1'])
    wrapper.unmount()
  })

  test('typed getQueryData / setQueryData', async () => {
    const { api } = setup(() => ({ body: { id: 1, name: 'server' } }))
    const { result, wrapper } = mountWith(() => ({
      q: useQuery(() => api.users.show.queryOptions({ params: { id: '1' } })),
      cache: useQueryCache(),
    }))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))

    const key = api.users.show.queryKey({ params: { id: '1' } })
    expect(result.cache.getQueryData(key)?.name).toBe('server')
    result.cache.setQueryData(key, { id: 1, name: 'local' })
    expect(result.q.data.value?.name).toBe('local')
    wrapper.unmount()
  })
})
