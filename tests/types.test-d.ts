import { describe, expectTypeOf, test } from 'vitest'
import { useInfiniteQuery, useMutation, useQuery, useQueryCache } from '@pinia/colada'
import type { ErrorOf } from '@tuyau/core/types'
import type { ApiDefinition } from './helpers/fixtures.ts'

import { skipToken } from '../src/index.ts'
import { setup } from './helpers/index.ts'

const { api } = setup()

describe('types', () => {
  test('query data and error come from the route', () => {
    const { data, error } = useQuery(() => api.users.show.queryOptions({ params: { id: '1' } }))
    expectTypeOf(data.value).toEqualTypeOf<{ id: number; name: string } | undefined>()
    expectTypeOf(error.value).toEqualTypeOf<ErrorOf<ApiDefinition['users']['show']> | null>()
  })

  test('the plain object form works too', () => {
    const { data } = useQuery(api.users.index.queryOptions())
    expectTypeOf(data.value).toEqualTypeOf<Array<{ id: number; name: string }> | undefined>()
  })

  test('input is checked', () => {
    // @ts-expect-error missing id
    api.users.show.queryOptions({ params: {} })
    // @ts-expect-error unknown query field
    api.users.index.queryOptions({ query: { nope: 1 } })
    api.users.show.queryOptions(skipToken)
  })

  test('GET routes have no mutationOptions, POST routes have no queryOptions', () => {
    // @ts-expect-error
    api.users.index.mutationOptions
    // @ts-expect-error
    api.users.store.queryOptions
  })

  test('queryKey is tagged for the cache', () => {
    const cache = useQueryCache()
    const data = cache.getQueryData(api.users.show.queryKey({ params: { id: '1' } }))
    expectTypeOf(data).toEqualTypeOf<{ id: number; name: string } | undefined>()
  })

  test('mutation vars, data and error', () => {
    const m = useMutation(api.users.store.mutationOptions())
    expectTypeOf(m.mutateAsync).parameter(0).toMatchTypeOf<{ body: { name: string } }>()
    expectTypeOf(m.data.value).toEqualTypeOf<{ id: number; name: string } | undefined>()
    // @ts-expect-error body is required
    m.mutate()
    const ping = useMutation(api.users.ping.mutationOptions())
    ping.mutate()
  })

  test('infinite query pages are typed', () => {
    const q = useInfiniteQuery(() =>
      api.articles.index.infiniteQueryOptions(
        {},
        {
          initialPageParam: 1,
          getNextPageParam: (last) => {
            expectTypeOf(last.meta.nextPage).toEqualTypeOf<number | null>()
            return last.meta.nextPage
          },
        },
      ),
    )
    expectTypeOf(q.data.value!.pages[0].data[0].title).toEqualTypeOf<string>()
  })
})
