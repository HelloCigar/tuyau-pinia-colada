# tuyau-pinia-colada

[Pinia Colada](https://pinia-colada.esm.dev) integration for [Tuyau](https://github.com/Julien-R44/tuyau), the type-safe client for AdonisJS. It is the Pinia Colada counterpart of `@tuyau/vue-query`, with the same API.

Each named route gets option builders you pass straight to `useQuery`, `useMutation` and `useInfiniteQuery`. Inputs, data and errors are typed from your Adonis controllers and validators.

## Install

Not on npm yet. Install the prebuilt `dist` branch from GitHub:

```sh
pnpm add github:HelloCigar/tuyau-pinia-colada#dist
pnpm add @pinia/colada pinia @tuyau/core
```

npm and yarn work the same way (`npm i github:HelloCigar/tuyau-pinia-colada#dist`). The `dist` branch holds only the built files, so nothing has to compile on install.

Peer dependencies: `@pinia/colada` ^1.4, `@tuyau/core` ^1.0, `vue` ^3.5.

## Setup

```ts
// src/lib/api.ts
import { registry } from '@generated/registry'
import { createTuyau } from '@tuyau/core/client'
import { createTuyauPiniaColadaClient } from 'tuyau-pinia-colada'

export const client = createTuyau({ baseUrl: import.meta.env.VITE_API_URL, registry })
export const api = createTuyauPiniaColadaClient({ client })
```

Install `pinia` and `PiniaColada` in your Vue app as usual.

## Queries

Wrap the call in a getter so reactive values are tracked:

```ts
import { useQuery } from '@pinia/colada'

const { data, error } = useQuery(() =>
  api.posts.show.queryOptions({ params: { id: route.params.id }, query: { include: 'comments' } }, { staleTime: 5_000 }),
)
```

The first argument is the request (`params`, `query`). The second takes any Pinia Colada query option except `key` and `query`, plus `tuyau` for per-call Ky options.

### Conditional queries

Pinia Colada has no `skipToken`, so this package exports one. It turns into `enabled: false`:

```ts
import { skipToken } from 'tuyau-pinia-colada'

useQuery(() => api.posts.show.queryOptions(id.value ? { params: { id: id.value } } : skipToken))
```

## Mutations

```ts
import { useMutation, useQueryCache } from '@pinia/colada'

const queryCache = useQueryCache()
const { mutate } = useMutation(
  api.posts.store.mutationOptions({
    onSettled: () => queryCache.invalidateQueries({ key: api.posts.pathKey() }),
  }),
)

mutate({ body: { title, content } })
```

## Infinite queries

```ts
import { useInfiniteQuery } from '@pinia/colada'

const posts = useInfiniteQuery(() =>
  api.posts.index.infiniteQueryOptions(
    { query: { search: 'typescript' } },
    {
      initialPageParam: 1,
      getNextPageParam: (lastPage) => lastPage.meta.nextPage,
      pageParamKey: 'page', // default
    },
  ),
)

posts.loadNextPage()
```

The page param is written into `query[pageParamKey]`, which must match a field of your validator.

## Keys and invalidation

| Helper | Returns | Use it to |
| --- | --- | --- |
| `queryKey(input)` | Exact key, typed for the cache | `getQueryData`, `setQueryData`, exact invalidation |
| `queryFilter(input, filters?)` | `{ key, ...filters }` | `invalidateQueries`, `cancelQueries` |
| `infiniteQueryKey(input)` / `infiniteQueryFilter()` | Same, for infinite queries | |
| `pathKey()` | Key of a route or a whole subtree | Invalidate every query under `api.posts` |
| `pathFilter(filters?)` | `{ key, ...filters }` | |
| `mutationKey()` | Key of a mutation | `useMutationCache()` lookups |

Keys use the same shape as `@tuyau/vue-query`, `[['posts', 'show'], { request, type }]`. Pinia Colada matches keys partially, so `api.posts.pathKey()` (`[['posts']]`) matches every posts query.

```ts
const post = queryCache.getQueryData(api.posts.show.queryKey({ params: { id: '1' } }))
//    ^? { id: number; title: string } | undefined
```

Keys are compared after JSON serialisation, so `{ id: 1 }` and `{ id: '1' }` are different entries. Route params from `vue-router` are strings, so keep the types consistent.

## Options

```ts
createTuyauPiniaColadaClient({
  client,
  globalOptions: { headers: { 'x-app': 'web' }, abortOnUnmount: true },
})
```

- `globalOptions` and per-call `tuyau` take any Ky option. Per-call options win.
- `abortOnUnmount` forwards Pinia Colada's `AbortSignal`, so stale requests are cancelled.
- Ky retries are disabled. Retries are left to Pinia Colada's retry plugin.

## Errors

Failed requests reject with a `TuyauError`, typed per route from your controller's error responses:

```ts
const { error } = useQuery(() => api.posts.show.queryOptions({ params: { id } }))
if (error.value?.isStatus(404)) { /* ... */ }
```

## License

MIT. Parts are adapted from Tuyau by Julien Ripouteau (MIT).
