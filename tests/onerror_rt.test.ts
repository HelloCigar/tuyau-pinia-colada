import { expect, test, vi } from 'vitest'
import { useMutation } from '@pinia/colada'
import { TuyauError } from '@tuyau/core/client'
import { setup, mountWith } from './helpers/index.ts'
test('onError receives a TuyauError at runtime', async () => {
  const { api } = setup(() => ({ status: 422, body: { errors: [{ field: 'name', message: 'required' }] } }))
  const onError = vi.fn()
  const { result } = mountWith(() => useMutation(api.users.store.mutationOptions({ onError })))
  await result.mutateAsync({ body: { name: '' } }).catch(() => {})
  const err = onError.mock.calls[0][0]
  expect(err).toBeInstanceOf(TuyauError)
  expect(err.status).toBe(422)
  expect(err.isValidationError()).toBe(true)
})
