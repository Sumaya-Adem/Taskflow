import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '../config/constants.js'
import { createPreferenceStorage } from '../storage/storage.js'
import { createMemoryStorage } from '../test/memoryStorage.js'
import { createMatchMediaStub } from '../test/renderApp.jsx'
import { ThemeProvider } from './ThemeProvider.jsx'
import { applyTheme, getSystemTheme } from './theme.js'
import { useTheme } from './useTheme.js'

function setup({ theme = 'system', prefersDark = false } = {}) {
  const media = createMatchMediaStub(prefersDark)
  vi.stubGlobal('matchMedia', media.matchMedia)
  const backend = createMemoryStorage()
  const preferenceStorage = createPreferenceStorage(backend, { eventTarget: window })
  const wrapper = ({ children }) => (
    <ThemeProvider preferenceStorage={preferenceStorage} initialPreferences={{ theme }}>
      {children}
    </ThemeProvider>
  )
  return { ...renderHook(() => useTheme(), { wrapper }), backend, media }
}

const rootTheme = () => document.documentElement.dataset.theme

describe('ThemeProvider', () => {
  it('throws when useTheme is used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within a ThemeProvider')
  })

  it('follows the OS setting for the "system" preference without setting data-theme', () => {
    const { result } = setup({ theme: 'system', prefersDark: true })
    expect(result.current).toMatchObject({ theme: 'system', resolvedTheme: 'dark' })
    expect(rootTheme()).toBeUndefined()
  })

  it('reacts when the OS color scheme changes', () => {
    const { result, media } = setup({ theme: 'system', prefersDark: false })
    expect(result.current.resolvedTheme).toBe('light')
    act(() => media.setPrefersDark(true))
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('applies an explicit preference to the root element', () => {
    const { result } = setup({ theme: 'dark', prefersDark: false })
    expect(result.current.resolvedTheme).toBe('dark')
    expect(rootTheme()).toBe('dark')
  })

  it('setTheme updates, applies and persists the choice', () => {
    const { result, backend } = setup()
    act(() => result.current.setTheme('light'))
    expect(result.current.theme).toBe('light')
    expect(rootTheme()).toBe('light')
    expect(JSON.parse(backend.getItem(STORAGE_KEYS.PREFERENCES))).toEqual({ theme: 'light' })

    act(() => result.current.setTheme('system'))
    expect(rootTheme()).toBeUndefined()
  })

  it('ignores invalid themes', () => {
    const { result, backend } = setup({ theme: 'dark' })
    act(() => result.current.setTheme('neon'))
    expect(result.current.theme).toBe('dark')
    expect(backend.getItem(STORAGE_KEYS.PREFERENCES)).toBeNull()
  })

  it('still switches theme for the session when saving fails', () => {
    const { result, backend } = setup()
    vi.spyOn(backend, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    act(() => result.current.setTheme('dark'))
    expect(result.current.theme).toBe('dark')
  })
})

describe('theme helpers', () => {
  it('getSystemTheme falls back to light without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(getSystemTheme()).toBe('light')
  })

  it('applyTheme sets or clears data-theme', () => {
    const root = document.createElement('html')
    applyTheme('dark', root)
    expect(root.dataset.theme).toBe('dark')
    applyTheme('system', root)
    expect(root.dataset.theme).toBeUndefined()
  })

  it('index.html pre-paint script reads the same preferences key', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain(`localStorage.getItem('${STORAGE_KEYS.PREFERENCES}')`)
  })
})

describe('cross-tab theme sync (Phase 6)', () => {
  it('follows a theme change made in another tab without re-saving it', () => {
    const { result, backend } = setup({ theme: 'light' })
    backend.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ theme: 'dark' }))
    const setItem = vi.spyOn(backend, 'setItem')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.PREFERENCES }))
    })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(setItem).not.toHaveBeenCalled()
  })

  it('falls back to the default theme for invalid external data', () => {
    const { result, backend } = setup({ theme: 'dark' })
    backend.setItem(STORAGE_KEYS.PREFERENCES, '{oops')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.PREFERENCES }))
    })
    expect(result.current.theme).toBe('system')
  })

  it('ignores task-storage events', () => {
    const { result, backend } = setup({ theme: 'dark' })
    backend.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ theme: 'light' }))
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.TASKS }))
    })
    expect(result.current.theme).toBe('dark')
  })
})
