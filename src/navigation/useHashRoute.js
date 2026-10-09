import { useSyncExternalStore } from 'react'
import { getRouteFromHash } from './routes.js'

function subscribe(onChange) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const getHash = () => window.location.hash
const getServerHash = () => ''

/** The route matching the current URL hash; re-renders on navigation. */
export function useHashRoute() {
  return getRouteFromHash(useSyncExternalStore(subscribe, getHash, getServerHash))
}
