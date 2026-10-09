import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App.jsx'
import { createAppServices } from '../state/services.js'
import { createMemoryStorage } from './memoryStorage.js'

/**
 * Renders the full app over an in-memory storage (never the real browser's).
 * Pass `entries` to seed storage and `hash` to start on a given route.
 */
export function renderApp({ entries = {}, storage = createMemoryStorage(entries), hash = '' } = {}) {
  window.history.replaceState(null, '', `/${hash}`)
  const services = createAppServices({ storage, eventTarget: window })
  const user = userEvent.setup()
  return { user, storage, services, ...render(<App services={services} />) }
}

/** Matches the stub shape of `window.matchMedia` for a given dark-mode setting. */
export function createMatchMediaStub(prefersDark) {
  const listeners = new Set()
  const query = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  }
  return {
    matchMedia: () => query,
    /** Simulates the OS switching color scheme. */
    setPrefersDark(value) {
      query.matches = value
      listeners.forEach((listener) => listener({ matches: value }))
    },
  }
}
