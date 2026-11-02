import { describe, expect, test, vi } from 'vitest'
import { useInfiniteQuery, useMutation, useQuery, useQueryCache } from '@pinia/colada'

import { setup, mountWith, flushPromises } from './helpers/index.ts'

describe('mutationOptions', () => {
  test('sends the body and returns typed data', async () => {
    const { api, requests } = setup(({ body }) => ({ body: { id: 7, ...(body as object) } }))
    const onSuccess = vi.fn()
    const { result, wrapper } = mountWith(() =>
      useMutation(api.users.store.mutationOptions({ onSuccess })),
    )

    const data = await result.mutateAsync({ body: { name: 'new' } })
    expect(data).toEqual({ id: 7, name: 'new' })
    expect(requests[0].method).toBe('POST')
    expect(requests[0].url.pathname).toBe('/users')
    expect(requests[0].body).toEqual({ name: 'new' })
    expect(onSuccess).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  test('mutate() needs no argument when the route takes none', async () => {
    const { api, requests } = setup(() => ({ body: { ok: true } }))
    const { result, wrapper } = mountWith(() => useMutation(api.users.ping.mutationOptions()))
    await result.mutateAsync()
    expect(requests[0].url.pathname).toBe('/users/ping')
    wrapper.unmount()
  })

  test('has a stable key', () => {
    const { api } = setup()
    expect(api.users.store.mutationKey()).toEqual([['users', 'store']])
    expect((api.users.store.mutationOptions() as any).key).toEqual([['users', 'store']])
  })

  test('invalidating from onSettled refetches the list', async () => {
    let count = 0
    const { api, requests } = setup(({ method }) =>
      method === 'GET' ? { body: Array.from({ length: count }, (_, i) => ({ id: i, name: 'u' })) } : (count++, { body: { id: count, name: 'u' } }),
    )
    const { result, wrapper } = mountWith(() => {
      const cache = useQueryCache()
      return {
        list: useQuery(() => api.users.index.queryOptions()),
        create: useMutation(
          api.users.store.mutationOptions({
            onSettled: () => cache.invalidateQueries({ key: api.users.index.pathKey() }),
          }),
        ),
      }
    })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.list.data.value).toHaveLength(0)

    await result.create.mutateAsync({ body: { name: 'a' } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.list.data.value).toHaveLength(1)
    expect(requests.filter((r) => r.method === 'GET')).toHaveLength(2)
    wrapper.unmount()
  })
})

describe('infiniteQueryOptions', () => {
  test('injects the page param and loads more pages', async () => {
    const { api, requests } = setup(({ url }) => {
      const page = Number(url.searchParams.get('page'))
      return {
        body: { data: [{ id: page, title: `p${page}` }], meta: { nextPage: page < 3 ? page + 1 : null } },
      }
    })
    const { result, wrapper } = mountWith(() =>
      useInfiniteQuery(() =>
        api.articles.index.infiniteQueryOptions(
          { query: { search: 'ts' } },
          { initialPageParam: 1, getNextPageParam: (last) => last.meta.nextPage },
        ),
      ),
    )
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.data.value?.pages).toHaveLength(1)

    await result.loadNextPage()
    await result.loadNextPage()
    expect(result.data.value?.pages.map((p) => p.data[0].id)).toEqual([1, 2, 3])
    expect(result.hasNextPage.value).toBe(false)
    expect(requests.map((r) => r.url.searchParams.get('page'))).toEqual(['1', '2', '3'])
    expect(requests.every((r) => r.url.searchParams.get('search') === 'ts')).toBe(true)
    wrapper.unmount()
  })

  test('custom pageParamKey', async () => {
    const { api, requests } = setup(() => ({ body: { data: [], meta: { nextPage: null } } }))
    const { wrapper } = mountWith(() =>
      useInfiniteQuery(() =>
        api.articles.index.infiniteQueryOptions(undefined, {
          initialPageParam: 5,
          pageParamKey: 'offset',
          getNextPageParam: () => null,
        }),
      ),
    )
    await flushPromises()
    await new Promise((r) => setTimeout(r, 20))
    expect(requests[0].url.searchParams.get('offset')).toBe('5')
    wrapper.unmount()
  })

  test('infinite and regular queries of one route do not share an entry', () => {
    const { api } = setup()
    expect(api.articles.index.infiniteQueryKey()).not.toEqual(api.articles.index.queryKey())
  })
})
