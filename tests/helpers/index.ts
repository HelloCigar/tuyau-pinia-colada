import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { PiniaColada } from '@pinia/colada'
import { createTuyau } from '@tuyau/core/client'

import { registry } from './fixtures.ts'
import { createTuyauPiniaColadaClient } from '../../src/index.ts'

export interface Captured {
  method: string
  url: URL
  body: unknown
  signal: AbortSignal | null
}

type Handler = (req: Captured) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>

/**
 * A Tuyau client whose `fetch` is a fake server. Every request is captured.
 */
export function setup(handler: Handler = () => ({ body: {} }), globalOptions?: any) {
  const requests: Captured[] = []

  const fetch = async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const text = await request.text()
    const captured: Captured = {
      method: request.method,
      url: new URL(request.url),
      body: text ? JSON.parse(text) : undefined,
      signal: request.signal ?? null,
    }
    requests.push(captured)
    const { status = 200, body } = await handler(captured)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client = createTuyau({ baseUrl: 'http://localhost:3333', registry, fetch })
  const api = createTuyauPiniaColadaClient({ client, globalOptions })
  return { api, client, requests }
}

export function mountWith<T>(composable: () => T) {
  let result!: T
  const pinia = createPinia()
  const wrapper = mount(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
    { global: { plugins: [pinia, [PiniaColada, { queryOptions: { refetchOnWindowFocus: false } }]] } },
  )
  return { result, wrapper, pinia }
}

export { flushPromises }
