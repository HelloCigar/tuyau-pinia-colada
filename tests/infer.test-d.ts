import { expectTypeOf, test } from 'vitest'
import type { ErrorOf } from '@tuyau/core/types'
import type { InferData, InferError, InferInput } from '../src/index.ts'
import { setup } from './helpers/index.ts'
import type { ApiDefinition } from './helpers/fixtures.ts'

const { api } = setup()

test('infer helpers', () => {
  expectTypeOf<InferData<typeof api.users.show>>().toEqualTypeOf<{ id: number; name: string }>()
  expectTypeOf<InferError<typeof api.users.show>>().toEqualTypeOf<ErrorOf<ApiDefinition['users']['show']>>()
  expectTypeOf<InferData<typeof api.users.store>>().toEqualTypeOf<{ id: number; name: string }>()
  expectTypeOf<InferError<typeof api.users.store>>().toEqualTypeOf<ErrorOf<ApiDefinition['users']['store']>>()
  expectTypeOf<InferInput<typeof api.users.store>>().toMatchTypeOf<{ body: { name: string } }>()
  expectTypeOf<InferInput<typeof api.users.show>>().toMatchTypeOf<{ params: { id: string } } | undefined>()
})
