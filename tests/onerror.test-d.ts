import { expectTypeOf, test } from 'vitest'
import { useMutation } from '@pinia/colada'
import type { ErrorOf } from '@tuyau/core/types'
import type { TuyauError } from '@tuyau/core/client'
import { setup } from './helpers/index.ts'
import type { ApiDefinition } from './helpers/fixtures.ts'

const { api } = setup()
test('onError gets the route TuyauError', () => {
  useMutation(api.users.store.mutationOptions({
    onError: (error) => {
      expectTypeOf(error).toEqualTypeOf<ErrorOf<ApiDefinition['users']['store']>>()
      expectTypeOf(error).toMatchTypeOf<TuyauError<any>>()
      if (error.isValidationError()) {}
    },
  }))
})
