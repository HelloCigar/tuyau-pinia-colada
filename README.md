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

const { data, error, status, refresh } = useQuery(() =>
  api.posts.show.queryOptions(
    { params: { id: route.params.id }, query: { include: 'comments' } },
    { staleTime: 5_000 },
  ),
)
```

The first argument is the request (`params`, `query`). The second takes any Pinia Colada query option except `key` and `query`, plus `tuyau` for per-call Ky options.

`data` is typed from the controller's return value, and `error` from its error responses (see [Error handling](#error-handling)).

### Conditional queries

Pinia Colada has no `skipToken`, so this package exports one. It turns into `enabled: false`:

```ts
import { skipToken } from 'tuyau-pinia-colada'

useQuery(() => api.posts.show.queryOptions(id.value ? { params: { id: id.value } } : skipToken))
```

## Mutations

```ts
import { useMutation } from '@pinia/colada'

const { mutate, mutateAsync, status, error } = useMutation(api.posts.store.mutationOptions())

mutate({ body: { title, content } })
const post = await mutateAsync({ body: { title, content } })
```

`mutate()` takes the route's request input: `params`, `query` and `body`, each typed from your validator. When a route takes none of them, `mutate()` needs no argument.

### Callback types

All Pinia Colada callbacks are available, and every argument is typed from the route. For `api.posts.store`:

| Callback | Arguments | Notes |
| --- | --- | --- |
| `onMutate` | `(vars, context)` | Runs before the request. Whatever you return becomes the `context` of the other callbacks. |
| `onSuccess` | `(data, vars, context)` | `data` is the controller's response. |
| `onError` | `(error, vars, context)` | `error` is the route's `TuyauError`. Fields you returned from `onMutate` may be `undefined` if it threw. |
| `onSettled` | `(data \| undefined, error \| undefined, vars, context)` | Runs after success or error. A good place to invalidate. |

- `vars` is exactly what you passed to `mutate()`, for example `{ body: { title, content } }`.
- `data` is the response type of the route.
- `error` is `TuyauError`, typed from the route's error responses.

```ts
const { mutate } = useMutation(
  api.posts.store.mutationOptions({
    onMutate(vars) {
      // vars: { body: { title: string; content: string } }
      return { startedAt: Date.now() }
    },
    onSuccess(post, vars, { startedAt }) {
      // post: { id: number; title: string; ... }
      toast.success(`Created "${post.title}" in ${Date.now() - startedAt}ms`)
    },
    onError(error, vars) {
      // error: TuyauError<...> for this route
      if (error.isValidationError()) form.setErrors(error.response.errors)
    },
    onSettled() {
      queryCache.invalidateQueries({ key: api.posts.pathKey() })
    },
  }),
)
```

## Error handling

Every failed request rejects with a `TuyauError` from `@tuyau/core`. Its type is inferred per route from the error responses your controller declares, so `isStatus()` narrows `error.response` to the matching body.

| Member | What it tells you |
| --- | --- |
| `error.kind` | `'http'` for a response with an error status, `'network'` when the server was unreachable |
| `error.status` | HTTP status, or `undefined` for network errors |
| `error.response` | Parsed error body |
| `error.isStatus(404)` | Narrows `error` to that status and its `response` type |
| `error.isValidationError()` | Shortcut for `isStatus(422)`, the VineJS validation response |
| `error.rawResponse` / `error.rawRequest` | Underlying Ky response and request |

### In a query

`useQuery` has no `onError` callback; read the `error` ref instead:

```vue
<script setup lang="ts">
const { data, error, status } = useQuery(() =>
  api.posts.show.queryOptions({ params: { id: route.params.id } }),
)
</script>

<template>
  <p v-if="status === 'pending'">Loading…</p>
  <NotFound v-else-if="error?.isStatus(404)" :message="error.response.message" />
  <Offline v-else-if="error?.kind === 'network'" />
  <ErrorBox v-else-if="error" :error="error" />
  <PostView v-else :post="data!" />
</template>
```

### In a mutation

Prefer `onError` or the `error` ref, which are both typed. `mutateAsync` rejects with the same error, but TypeScript types a `catch` binding as `unknown`, so narrow it with `instanceof` first:

```ts
import { TuyauError } from '@tuyau/core/client'

const createPost = useMutation(api.posts.store.mutationOptions())

// typed ref
watch(createPost.error, (error) => {
  if (error?.isValidationError()) form.setErrors(error.response.errors)
})

// or try/catch
try {
  await createPost.mutateAsync({ body: form.values })
} catch (error) {
  if (error instanceof TuyauError && error.isStatus(409)) showConflict()
}
```

### Globally

Use Pinia Colada's plugin hooks to handle errors for every query, such as a redirect on 401:

```ts
import { PiniaColada, PiniaColadaQueryHooksPlugin } from '@pinia/colada'
import { TuyauError } from '@tuyau/core/client'

app.use(PiniaColada, {
  plugins: [
    PiniaColadaQueryHooksPlugin({
      onError(error) {
        if (error instanceof TuyauError && error.isStatus(401)) router.push('/login')
      },
    }),
  ],
})
```

Ky retries are disabled by this package, so a failed request is retried only if you add Pinia Colada's retry plugin (`@pinia/colada-plugin-retry`). With that plugin, skip retries for 4xx errors:

```ts
import { PiniaColadaRetry } from '@pinia/colada-plugin-retry'

PiniaColadaRetry({
  retry: (count, error) =>
    !(error instanceof TuyauError && error.status && error.status < 500) && count < 2,
})
```

## Invalidation and the cache

Every route node exposes keys and filters that plug straight into `useQueryCache()`:

| Helper | Returns | Use it to |
| --- | --- | --- |
| `queryKey(input)` | Exact key, typed for the cache | `getQueryData`, `setQueryData`, exact invalidation |
| `queryFilter(input?, filters?)` | `{ key, ...filters }` | `invalidateQueries`, `cancelQueries`, `getEntries` |
| `infiniteQueryKey(input)` / `infiniteQueryFilter()` | Same, for infinite queries | |
| `pathKey()` | Key of a route or a whole subtree | Invalidate every query under `api.posts` |
| `pathFilter(filters?)` | `{ key, ...filters }` | Same, with extra filters |
| `mutationKey()` | Key of a mutation | `useMutationCache()` lookups |

Keys use the same shape as `@tuyau/vue-query`, `[['posts', 'show'], { request, type }]`. Pinia Colada matches keys by prefix, so a shorter key matches every longer key that starts with it.

```ts
import { useQueryCache } from '@pinia/colada'

const queryCache = useQueryCache()

// Everything under /posts: posts.index, posts.show, comments, infinite lists
queryCache.invalidateQueries({ key: api.posts.pathKey() })
queryCache.invalidateQueries(api.posts.pathFilter()) // same thing

// One endpoint, every input: all pages and searches of posts.index
queryCache.invalidateQueries(api.posts.index.pathFilter())

// One exact query
queryCache.invalidateQueries(api.posts.show.queryFilter({ params: { id } }, { exact: true }))

// Only queries that are mounted right now
queryCache.invalidateQueries(api.posts.pathFilter({ active: true }))

// Your own rule
queryCache.invalidateQueries(
  api.posts.index.pathFilter({ predicate: (entry) => entry.state.value.data?.length === 0 }),
)
```

`invalidateQueries` marks matching entries stale and refetches the active ones. Pass `'all'` as the second argument to refetch inactive ones too.

### After a mutation

The usual pattern is to invalidate in `onSettled`, so the list refreshes after success and after failure:

```ts
const queryCache = useQueryCache()

const deletePost = useMutation(
  api.posts.destroy.mutationOptions({
    onSettled: (_data, _error, vars) => {
      queryCache.invalidateQueries({ key: api.posts.index.pathKey() })
      queryCache.invalidateQueries(api.posts.show.queryFilter({ params: vars.params }, { exact: true }))
    },
  }),
)

deletePost.mutate({ params: { id: post.id } })
```

### Reading and writing the cache

`queryKey()` is tagged with the route's data type, so cache reads and writes are typed:

```ts
const key = api.posts.show.queryKey({ params: { id: '1' } })

const post = queryCache.getQueryData(key)
//    ^? { id: number; title: string } | undefined

if (post) queryCache.setQueryData(key, { ...post, title: 'Renamed' })
```

### Optimistic updates

Combine `onMutate`, `onError` and `onSettled` to update the cache first and roll back on failure:

```ts
const updatePost = useMutation(
  api.posts.update.mutationOptions({
    onMutate(vars) {
      const key = api.posts.show.queryKey({ params: vars.params })
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
```

Keys are compared after JSON serialisation, so `{ id: 1 }` and `{ id: '1' }` are different entries. Route params from `vue-router` are strings, so keep the types consistent between queries and invalidation.

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

The page param is written into `query[pageParamKey]`, which must match a field of your validator. `lastPage` is typed as the route's response. Invalidate infinite queries with the same `pathKey()` as regular ones, or target only them with `infiniteQueryFilter()`.

## Type helpers

To type a prop, a store or a form from a route, use the inference helpers. They take a route node:

```ts
import type { InferData, InferError, InferInput } from 'tuyau-pinia-colada'

type Post = InferData<typeof api.posts.show> // response body
type PostError = InferError<typeof api.posts.show> // TuyauError for this route
type CreatePostInput = InferInput<typeof api.posts.store> // what mutate() takes
```

`@tuyau/core/types` also exports `ResponseOf`, `ErrorOf` and `RawRequestArgs` if you work with endpoint types directly.

## Options

```ts
createTuyauPiniaColadaClient({
  client,
  globalOptions: { headers: { 'x-app': 'web' }, abortOnUnmount: true },
})
```

- `globalOptions` and per-call `tuyau` take any Ky option. Per-call options win.
- `abortOnUnmount` forwards Pinia Colada's `AbortSignal`, so stale requests are cancelled.
- Ky retries are disabled. Retries are left to Pinia Colada.

## How HTTP methods are picked

GET and HEAD routes get `queryOptions`, `infiniteQueryOptions` and their keys. All other methods get `mutationOptions`. Calling the wrong one is a type error. At runtime, requests go through `client.request(routeName)`, and Tuyau sends the first method registered for that route.

## License

MIT. Parts are adapted from Tuyau by Julien Ripouteau (MIT).
