import { expect, expectTypeOf, test } from 'vitest'
import { useMutation } from '@pinia/colada'
import { toErrorBag, firstErrors } from '../src/index.ts'
import { setup, mountWith } from './helpers/index.ts'

const issues = [
  { field: 'name', rule: 'required', message: 'Name is required' },
  { field: 'name', rule: 'minLength', message: 'Name is too short' },
  { field: 'items.0.sku', rule: 'required', message: 'SKU is required' },
]

test('groups a real 422 TuyauError by field', async () => {
  const { api } = setup(() => ({ status: 422, body: { errors: issues } }))
  const { result } = mountWith(() => useMutation(api.users.store.mutationOptions()))
  await result.mutateAsync({ body: { name: '' } }).catch(() => {})

  expect(toErrorBag(result.error.value)).toEqual({
    name: ['Name is required', 'Name is too short'],
    'items.0.sku': ['SKU is required'],
  })
  expect(firstErrors(result.error.value)).toEqual({
    name: 'Name is required',
    'items.0.sku': 'SKU is required',
  })
})

test('returns {} for anything that is not a 422', async () => {
  const { api } = setup(() => ({ status: 500, body: { errors: issues } }))
  const { result } = mountWith(() => useMutation(api.users.store.mutationOptions()))
  await result.mutateAsync({ body: { name: '' } }).catch(() => {})

  expect(toErrorBag(result.error.value)).toEqual({})
  expect(toErrorBag(null)).toEqual({})
  expect(toErrorBag(undefined)).toEqual({})
  expect(toErrorBag(new Error('x'))).toEqual({})
  expect(toErrorBag({ status: 422, response: { message: 'not vine' } })).toEqual({})
})

test('field names can be typed', () => {
  const bag = toErrorBag<'email' | 'password'>(null)
  expectTypeOf(bag.email).toEqualTypeOf<string[] | undefined>()
  const first = firstErrors<'email'>(null)
  expectTypeOf(first.email).toEqualTypeOf<string | undefined>()
})
