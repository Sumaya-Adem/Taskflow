import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../config/constants.js'
import { LOAD_STATUS } from '../storage/storage.js'
import { buildTask } from '../test/fixtures.js'
import { createMemoryStorage } from '../test/memoryStorage.js'
import { createAppServices } from './services.js'

describe('createAppServices', () => {
  it('loads tasks and preferences once from the given storage', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.TASKS]: JSON.stringify({ version: 1, tasks: [buildTask()] }),
      [STORAGE_KEYS.PREFERENCES]: JSON.stringify({ theme: 'dark' }),
    })
    const services = createAppServices({ storage })
    expect(services.initialTaskLoad).toMatchObject({ status: LOAD_STATUS.OK, tasks: [buildTask()] })
    expect(services.initialPreferences).toEqual({ theme: 'dark' })
  })

  it('handles unavailable storage', () => {
    const services = createAppServices({ storage: null })
    expect(services.initialTaskLoad.status).toBe(LOAD_STATUS.UNAVAILABLE)
    expect(services.initialPreferences).toEqual({ theme: 'system' })
  })

  it('uses the browser storage by default', () => {
    localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify({ theme: 'light' }))
    expect(createAppServices().initialPreferences).toEqual({ theme: 'light' })
  })
})
