/**
 * App sections and hash-based routing helpers.
 *
 * Hash routing (`#/tasks`) needs no server configuration, works on any static
 * host, and keeps back/forward and deep links working without a router
 * dependency. Unknown hashes fall back to the default route.
 */

export const ROUTES = Object.freeze([
  Object.freeze({
    id: 'dashboard',
    path: '/dashboard',
    label: 'Dashboard',
    title: 'Dashboard',
    description: 'An overview of your work at a glance.',
    icon: 'dashboard',
  }),
  Object.freeze({
    id: 'tasks',
    path: '/tasks',
    label: 'My Tasks',
    title: 'My Tasks',
    description: 'Everything you need to get done, in one place.',
    icon: 'tasks',
  }),
  Object.freeze({
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    title: 'Settings',
    description: 'Personalize TaskFlow and manage your data.',
    icon: 'settings',
  }),
])

export const DEFAULT_ROUTE = ROUTES[0]

/** The `href` for a route, e.g. `#/tasks`. */
export function getRouteHref(route) {
  return `#${route.path}`
}

/** Resolves a `location.hash` value to a route; unknown or empty hashes give the default route. */
export function getRouteFromHash(hash) {
  const path = typeof hash === 'string' ? hash.replace(/^#/, '').replace(/\/+$/, '').toLowerCase() : ''
  return ROUTES.find((route) => route.path === path) ?? DEFAULT_ROUTE
}
