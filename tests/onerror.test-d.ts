import { expectTypeOf, test } from 'vitest'
import { useMutation, useQuery } from '@pinia/colada'
import type { ErrorOf } from '@tuyau/core/types'
import type { TuyauError } from '@tuyau/core/client'
import { setup } from './helpers/index.ts'
import type { ApiDefinition } from './helpers/fixtures.ts'

const { api } = setup()

test('mutation callbacks are typed from the route', () => {
  useMutation(
    api.users.store.mutationOptions({
      onMutate: (vars) => {
        expectTypeOf(vars.body.name).toEqualTypeOf<string>()
        return { startedAt: 1 }
      },
      onSuccess: (data, vars, context) => {
        expectTypeOf(data).toEqualTypeOf<{ id: number; name: string }>()
        expectTypeOf(vars.body).toEqualTypeOf<{ name: string }>()
        expectTypeOf(context.startedAt).toEqualTypeOf<number>()
      },
      onError: (error) => {
        expectTypeOf(error).toEqualTypeOf<ErrorOf<ApiDefinition['users']['store']>>()
        expectTypeOf(error).toMatchTypeOf<TuyauError<any>>()
        if (error.isValidationError()) {
          expectTypeOf(error.response.errors[0].field).toEqualTypeOf<string>()
        }
      },
      onSettled: (data, error) => {
        expectTypeOf(data).toEqualTypeOf<{ id: number; name: string } | undefined>()
        expectTypeOf(error).toEqualTypeOf<ErrorOf<ApiDefinition['users']['store']> | undefined>()
      },
    }),
  )
})

test('query error narrows by status', () => {
  const { error } = useQuery(() => api.users.show.queryOptions({ params: { id: '1' } }))
  if (error.value?.isStatus(404)) {
    expectTypeOf(error.value.response.message).toEqualTypeOf<string>()
  }
})
