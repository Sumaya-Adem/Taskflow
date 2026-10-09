import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '../config/constants.js'
import { LOAD_STATUS } from '../storage/storage.js'
import { buildTask } from '../test/fixtures.js'
import { createMemoryStorage } from '../test/memoryStorage.js'
import { createAppServices, writeBackRecoveredTasks } from './services.js'

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

describe('writeBackRecoveredTasks', () => {
  const fakeStorage = (ok = true) => ({
    saveTasks: vi.fn(() => (ok ? { ok: true, reason: null } : { ok: false, reason: 'quota-exceeded' })),
  })

  it.each([LOAD_STATUS.REPAIRED, LOAD_STATUS.CORRUPT])('writes %s data back and reports success', (status) => {
    const storage = fakeStorage()
    const result = writeBackRecoveredTasks(storage, { status, tasks: [], writable: true })
    expect(storage.saveTasks).toHaveBeenCalledWith([])
    expect(result.saveError).toBeNull()
  })

  it('reports a failed write-back', () => {
    const result = writeBackRecoveredTasks(fakeStorage(false), { status: LOAD_STATUS.REPAIRED, tasks: [], writable: true })
    expect(result.saveError).toBe('quota-exceeded')
  })

  it.each([
    ['clean data', { status: LOAD_STATUS.OK, tasks: [], writable: true }],
    ['protected data', { status: LOAD_STATUS.CORRUPT, tasks: [], writable: false }],
    ['no data', { status: LOAD_STATUS.EMPTY, tasks: [], writable: true }],
  ])('does not write for %s', (_label, loadResult) => {
    const storage = fakeStorage()
    writeBackRecoveredTasks(storage, loadResult)
    expect(storage.saveTasks).not.toHaveBeenCalled()
  })

  it('happens once at startup, so a second start finds clean data', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.TASKS]: '{broken' })
    expect(createAppServices({ storage }).initialTaskLoad.status).toBe(LOAD_STATUS.CORRUPT)
    expect(createAppServices({ storage }).initialTaskLoad.status).toBe(LOAD_STATUS.OK)
  })
})
