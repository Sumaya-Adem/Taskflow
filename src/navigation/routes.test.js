import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTE, ROUTES, getRouteFromHash, getRouteHref } from './routes.js'

describe('routes', () => {
  it('defines Dashboard, My Tasks and Settings with unique ids and paths', () => {
    expect(ROUTES.map((route) => route.label)).toEqual(['Dashboard', 'My Tasks', 'Settings'])
    expect(new Set(ROUTES.map((route) => route.id)).size).toBe(ROUTES.length)
    expect(new Set(ROUTES.map((route) => route.path)).size).toBe(ROUTES.length)
  })

  it('builds hash hrefs', () => {
    expect(ROUTES.map(getRouteHref)).toEqual(['#/dashboard', '#/tasks', '#/settings'])
  })

  it.each([
    ['#/tasks', 'tasks'],
    ['#/settings', 'settings'],
    ['#/dashboard', 'dashboard'],
    ['#/TASKS', 'tasks'],
    ['#/tasks/', 'tasks'],
  ])('resolves %s to %s', (hash, id) => {
    expect(getRouteFromHash(hash).id).toBe(id)
  })

  it.each(['', '#', '#/', '#/unknown', '#main-content', null, undefined])('falls back to the default route for %p', (hash) => {
    expect(getRouteFromHash(hash)).toBe(DEFAULT_ROUTE)
  })
})
