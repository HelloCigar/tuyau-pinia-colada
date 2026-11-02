import type { AdonisEndpoint } from '@tuyau/core/types'

const placeholder: any = {}

const routes = {
  'users.index': {
    methods: ['GET', 'HEAD'],
    pattern: '/users',
    tokens: [{ old: '/users', type: 0, val: 'users', end: '' }],
    types: placeholder as {
      body: {}
      paramsTuple: []
      params: {}
      query: { name?: string }
      response: Array<{ id: number; name: string }>
    },
  },
  'users.show': {
    methods: ['GET', 'HEAD'],
    pattern: '/users/:id',
    tokens: [
      { old: '/users/:id', type: 0, val: 'users', end: '' },
      { old: '/users/:id', type: 1, val: 'id', end: '' },
    ],
    types: placeholder as {
      body: {}
      paramsTuple: [string]
      params: { id: string }
      query: {}
      response: { id: number; name: string }
      errorResponse: { status: 404; response: { message: string } }
    },
  },
  'users.store': {
    methods: ['POST'],
    pattern: '/users',
    tokens: [{ old: '/users', type: 0, val: 'users', end: '' }],
    types: placeholder as {
      body: { name: string }
      paramsTuple: []
      params: {}
      query: {}
      response: { id: number; name: string }
      errorResponse: { status: 422; response: { errors: Array<{ field: string; message: string }> } }
    },
  },
  'users.ping': {
    methods: ['POST'],
    pattern: '/users/ping',
    tokens: [
      { old: '/users/ping', type: 0, val: 'users', end: '' },
      { old: '/users/ping', type: 0, val: 'ping', end: '' },
    ],
    types: placeholder as {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: { ok: true }
    },
  },
  'users.update': {
    methods: ['PUT'],
    pattern: '/users/:id',
    tokens: [
      { old: '/users/:id', type: 0, val: 'users', end: '' },
      { old: '/users/:id', type: 1, val: 'id', end: '' },
    ],
    types: placeholder as {
      body: { name?: string }
      paramsTuple: [string]
      params: { id: string }
      query: {}
      response: { id: number; name: string }
    },
  },
  'users.destroy': {
    methods: ['DELETE'],
    pattern: '/users/:id',
    tokens: [
      { old: '/users/:id', type: 0, val: 'users', end: '' },
      { old: '/users/:id', type: 1, val: 'id', end: '' },
    ],
    types: placeholder as {
      body: {}
      paramsTuple: [string]
      params: { id: string }
      query: {}
      response: { ok: true }
    },
  },
  'articles.index': {
    methods: ['GET', 'HEAD'],
    pattern: '/articles',
    tokens: [{ old: '/articles', type: 0, val: 'articles', end: '' }],
    types: placeholder as {
      body: {}
      paramsTuple: []
      params: {}
      query: { page?: number; search?: string }
      response: { data: Array<{ id: number; title: string }>; meta: { nextPage: number | null } }
    },
  },
  'admin.reports.get_summary': {
    methods: ['GET', 'HEAD'],
    pattern: '/admin/reports/summary',
    tokens: [
      { old: '/admin/reports/summary', type: 0, val: 'admin', end: '' },
      { old: '/admin/reports/summary', type: 0, val: 'reports', end: '' },
      { old: '/admin/reports/summary', type: 0, val: 'summary', end: '' },
    ],
    types: placeholder as {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: { total: number }
    },
  },
} as const satisfies Record<string, AdonisEndpoint>

type Routes = typeof routes

export interface ApiDefinition {
  users: {
    index: Routes['users.index']
    show: Routes['users.show']
    store: Routes['users.store']
    ping: Routes['users.ping']
    update: Routes['users.update']
    destroy: Routes['users.destroy']
  }
  articles: {
    index: Routes['articles.index']
  }
  admin: {
    reports: {
      getSummary: Routes['admin.reports.get_summary']
    }
  }
}

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}
