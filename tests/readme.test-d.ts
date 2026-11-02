// Mirrors the README snippets so they keep compiling.
import { test } from 'vitest'
import { useMutation, useQueryCache } from '@pinia/colada'
import { TuyauError } from '@tuyau/core/client'
import { PiniaColadaQueryHooksPlugin } from '@pinia/colada'
import { setup } from './helpers/index.ts'

const { api } = setup()

test('invalidation snippets', () => {
  const queryCache = useQueryCache()
  queryCache.invalidateQueries({ key: api.users.pathKey() })
  queryCache.invalidateQueries(api.users.pathFilter())
  queryCache.invalidateQueries(api.users.index.pathFilter())
  queryCache.invalidateQueries(api.users.show.queryFilter({ params: { id: '1' } }, { exact: true }))
  queryCache.invalidateQueries(api.users.pathFilter({ active: true }))
  queryCache.invalidateQueries(
    api.users.index.pathFilter({ predicate: (entry) => (entry.state.value.data as any)?.length === 0 }),
  )
  queryCache.invalidateQueries({ key: api.users.pathKey() }, 'all')
})

test('after a mutation', () => {
  const queryCache = useQueryCache()
  const del = useMutation(
    api.users.destroy.mutationOptions({
      onSettled: (_data, _error, vars) => {
        queryCache.invalidateQueries({ key: api.users.index.pathKey() })
        queryCache.invalidateQueries(api.users.show.queryFilter({ params: vars.params }, { exact: true }))
      },
    }),
  )
  del.mutate({ params: { id: '1' } })
})

test('cache read/write', () => {
  const queryCache = useQueryCache()
  const key = api.users.show.queryKey({ params: { id: '1' } })
  const user = queryCache.getQueryData(key)
  user?.name.toUpperCase()
  if (user) queryCache.setQueryData(key, { ...user, name: 'Renamed' })
})

test('optimistic update', () => {
  const queryCache = useQueryCache()
  useMutation(
    api.users.update.mutationOptions({
      onMutate(vars) {
        const key = api.users.show.queryKey({ params: vars.params })
        const previous = queryCache.getQueryData(key)
        queryCache.cancelQueries({ key })
        if (previous) queryCache.setQueryData(key, { ...previous, ...vars.body })
        return { key, previous }
      },
      onError(_error, _vars, { key, previous }) {
        if (key && previous) queryCache.setQueryData(key, previous)
      },
      onSettled(_data, _error, _vars, { key }) {
        if (key) queryCache.invalidateQueries({ key, exact: true })
      },
    }),
  )
})

test('global hook', () => {
  PiniaColadaQueryHooksPlugin({
    onError(error) {
      if (error instanceof TuyauError && error.isStatus(401)) void 0
    },
  })
})
