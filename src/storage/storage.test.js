import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, STORAGE_VERSION } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import { createMemoryStorage, createQuotaError } from '../test/memoryStorage.js'
import {
  BACKUP_KEY_PREFIX,
  LOAD_STATUS,
  SAVE_ERROR,
  createTaskStorage,
  isQuotaExceededError,
  parseStoredTasks,
  resolveBrowserStorage,
} from './storage.js'

const KEY = STORAGE_KEYS.TASKS
const NOW = new Date('2026-10-08T10:00:00.000Z')
const clock = () => NOW
const envelope = (tasks, version = STORAGE_VERSION) => JSON.stringify({ version, tasks })

function setup(initial = {}) {
  const backend = createMemoryStorage(initial)
  const store = createTaskStorage(backend, { clock, generate: () => 'generated-id' })
  return { backend, store }
}

const backupEntries = (backend) =>
  Object.entries(backend.entries()).filter(([key]) => key.startsWith(BACKUP_KEY_PREFIX))

describe('resolveBrowserStorage', () => {
  it('returns localStorage when it can be read', () => {
    const storage = createMemoryStorage()
    expect(resolveBrowserStorage({ localStorage: storage })).toBe(storage)
  })

  it('returns null when localStorage is missing', () => {
    expect(resolveBrowserStorage({})).toBeNull()
    expect(resolveBrowserStorage(null)).toBeNull()
  })

  it('returns null when accessing localStorage throws (privacy mode, sandbox)', () => {
    const blocked = {
      get localStorage() {
        throw new DOMException('Access denied', 'SecurityError')
      },
    }
    expect(resolveBrowserStorage(blocked)).toBeNull()
  })

  it('returns null when reading throws', () => {
    const storage = createMemoryStorage()
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(resolveBrowserStorage({ localStorage: storage })).toBeNull()
  })

  it('does not write to storage, so a full quota cannot hide existing data', () => {
    const storage = createMemoryStorage()
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw createQuotaError()
    })
    expect(resolveBrowserStorage({ localStorage: storage })).toBe(storage)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('works against the jsdom localStorage by default', () => {
    expect(resolveBrowserStorage()).toBe(globalThis.localStorage)
  })
})

describe('isQuotaExceededError', () => {
  it.each([
    ['standard name', createQuotaError('QuotaExceededError', 22)],
    ['Firefox name', createQuotaError('NS_ERROR_DOM_QUOTA_REACHED', 1014)],
    ['legacy code only', Object.assign(new Error('x'), { code: 22 })],
    ['real DOMException', new DOMException('full', 'QuotaExceededError')],
  ])('recognizes %s', (_label, error) => {
    expect(isQuotaExceededError(error)).toBe(true)
  })

  it.each([new Error('other'), new TypeError('x'), null, undefined, 'QuotaExceededError'])(
    'rejects %p',
    (error) => {
      expect(isQuotaExceededError(error)).toBe(false)
    },
  )
})

describe('parseStoredTasks', () => {
  const parse = (raw) => parseStoredTasks(raw, { now: NOW, generate: () => 'generated-id' })

  it('reports empty when nothing is stored', () => {
    expect(parse(null)).toMatchObject({ status: LOAD_STATUS.EMPTY, tasks: [], error: null })
  })

  it('loads a valid envelope as-is', () => {
    const tasks = [buildTask({ id: 'a' }), buildTask({ id: 'b' })]
    expect(parse(envelope(tasks))).toEqual({
      status: LOAD_STATUS.OK,
      tasks,
      droppedCount: 0,
      repairedCount: 0,
      error: null,
    })
  })

  it('loads an empty task list', () => {
    expect(parse(envelope([]))).toMatchObject({ status: LOAD_STATUS.OK, tasks: [] })
  })

  it.each([
    ['truncated JSON', '{"version":1,"tasks":['],
    ['plain text', 'hello'],
    ['empty string', ''],
    ['JSON null', 'null'],
    ['JSON number', '42'],
    ['JSON string', '"tasks"'],
    ['missing version', JSON.stringify({ tasks: [] })],
    ['non-integer version', JSON.stringify({ version: '1', tasks: [] })],
    ['zero version', JSON.stringify({ version: 0, tasks: [] })],
    ['tasks not a list', JSON.stringify({ version: 1, tasks: {} })],
  ])('reports corrupt for %s', (_label, raw) => {
    const result = parse(raw)
    expect(result.status).toBe(LOAD_STATUS.CORRUPT)
    expect(result.tasks).toEqual([])
    expect(result.error).toBeInstanceOf(Error)
  })

  it('refuses data from a newer schema version', () => {
    const result = parse(envelope([buildTask()], STORAGE_VERSION + 1))
    expect(result.status).toBe(LOAD_STATUS.UNSUPPORTED_VERSION)
    expect(result.tasks).toEqual([])
    expect(result.error.message).toMatch(/newer/)
  })

  it('migrates a legacy unversioned array', () => {
    const result = parse(JSON.stringify([buildTask({ id: 'legacy' })]))
    expect(result.status).toBe(LOAD_STATUS.REPAIRED)
    expect(result.tasks.map((task) => task.id)).toEqual(['legacy'])
  })

  it('drops malformed records and repairs fixable ones', () => {
    const result = parse(
      envelope([buildTask({ id: 'ok' }), null, 'junk', { title: '   ' }, buildTask({ id: 'fix', priority: 'BAD' })]),
    )
    expect(result.status).toBe(LOAD_STATUS.REPAIRED)
    expect(result.tasks.map((task) => [task.id, task.priority])).toEqual([
      ['ok', 'medium'],
      ['fix', 'medium'],
    ])
    expect(result.droppedCount).toBe(3)
    expect(result.repairedCount).toBe(1)
  })
})

describe('createTaskStorage', () => {
  describe('loadTasks', () => {
    it('returns empty, writable and without backups when nothing is stored', () => {
      const { backend, store } = setup()
      expect(store.loadTasks()).toEqual({
        status: LOAD_STATUS.EMPTY,
        tasks: [],
        droppedCount: 0,
        repairedCount: 0,
        backupKey: null,
        writable: true,
        error: null,
      })
      expect(backend.entries()).toEqual({})
    })

    it('loads valid data without creating a backup', () => {
      const tasks = [buildTask()]
      const { backend, store } = setup({ [KEY]: envelope(tasks) })
      expect(store.loadTasks()).toMatchObject({ status: LOAD_STATUS.OK, tasks, backupKey: null, writable: true })
      expect(backupEntries(backend)).toEqual([])
    })

    it('backs up corrupted JSON before recovering, preserving the original', () => {
      const raw = '{"version":1,"tasks":[{"title":"Unfinished'
      const { backend, store } = setup({ [KEY]: raw })

      const result = store.loadTasks()

      expect(result).toMatchObject({ status: LOAD_STATUS.CORRUPT, tasks: [], writable: true })
      expect(result.error).toBeInstanceOf(SyntaxError)
      expect(result.backupKey).toBe(`${BACKUP_KEY_PREFIX}${NOW.toISOString()}`)
      expect(backend.getItem(result.backupKey)).toBe(raw)
      expect(backend.getItem(KEY)).toBe(raw) // load never overwrites the main key
    })

    it('backs up the original when records are dropped or repaired', () => {
      const raw = envelope([buildTask({ id: 'a' }), { title: '' }])
      const { backend, store } = setup({ [KEY]: raw })
      const result = store.loadTasks()
      expect(result.status).toBe(LOAD_STATUS.REPAIRED)
      expect(result.droppedCount).toBe(1)
      expect(backend.getItem(result.backupKey)).toBe(raw)
    })

    it('never overwrites an existing backup with the same timestamp', () => {
      const existingKey = `${BACKUP_KEY_PREFIX}${NOW.toISOString()}`
      const { backend, store } = setup({ [KEY]: 'broken', [existingKey]: 'earlier backup' })
      const result = store.loadTasks()
      expect(result.backupKey).toBe(`${existingKey}-1`)
      expect(backend.getItem(existingKey)).toBe('earlier backup')
      expect(backend.getItem(`${existingKey}-1`)).toBe('broken')
    })

    it('becomes read-only when the backup cannot be written, so the original survives', () => {
      const { backend, store } = setup({ [KEY]: 'broken' })
      vi.spyOn(backend, 'setItem').mockImplementation(() => {
        throw createQuotaError()
      })

      const result = store.loadTasks()
      expect(result).toMatchObject({ status: LOAD_STATUS.CORRUPT, backupKey: null, writable: false })
      expect(isQuotaExceededError(result.error)).toBe(true)

      vi.mocked(backend.setItem).mockRestore()
      expect(store.saveTasks([buildTask()])).toEqual({ ok: false, reason: SAVE_ERROR.READ_ONLY, error: null })
      expect(backend.getItem(KEY)).toBe('broken')
    })

    it('leaves newer-version data untouched and disables saving', () => {
      const raw = envelope([buildTask()], STORAGE_VERSION + 1)
      const { backend, store } = setup({ [KEY]: raw })

      const result = store.loadTasks()
      expect(result).toMatchObject({
        status: LOAD_STATUS.UNSUPPORTED_VERSION,
        tasks: [],
        writable: false,
        backupKey: null,
      })
      expect(store.saveTasks([])).toMatchObject({ ok: false, reason: SAVE_ERROR.READ_ONLY })
      expect(backend.getItem(KEY)).toBe(raw)
      expect(backupEntries(backend)).toEqual([])
    })

    it('re-enables saving once a later load succeeds', () => {
      const { backend, store } = setup({ [KEY]: envelope([], STORAGE_VERSION + 1) })
      store.loadTasks()
      backend.setItem(KEY, envelope([])) // e.g. the newer tab was closed and data rewritten
      expect(store.loadTasks().writable).toBe(true)
      expect(store.saveTasks([]).ok).toBe(true)
    })

    it('reports unavailable when there is no backend', () => {
      for (const backend of [null, undefined]) {
        const store = createTaskStorage(backend)
        expect(store.isAvailable()).toBe(false)
        expect(store.loadTasks()).toMatchObject({
          status: LOAD_STATUS.UNAVAILABLE,
          tasks: [],
          writable: false,
          error: null,
        })
      }
    })

    it('reports unavailable, without throwing, when reading fails', () => {
      const { backend, store } = setup()
      const failure = new Error('read failed')
      vi.spyOn(backend, 'getItem').mockImplementation(() => {
        throw failure
      })
      expect(store.loadTasks()).toMatchObject({ status: LOAD_STATUS.UNAVAILABLE, error: failure, writable: false })
    })
  })

  describe('saveTasks', () => {
    it('writes a versioned envelope that loads back identically', () => {
      const { backend, store } = setup()
      const tasks = [buildTask({ id: 'a' }), buildTask({ id: 'b', completed: true, completedAt: NOW.toISOString() })]

      expect(store.saveTasks(tasks)).toEqual({ ok: true, reason: null, error: null })
      expect(JSON.parse(backend.getItem(KEY))).toEqual({ version: STORAGE_VERSION, tasks })
      expect(store.loadTasks()).toMatchObject({ status: LOAD_STATUS.OK, tasks })
    })

    it('saves an empty list', () => {
      const { backend, store } = setup()
      expect(store.saveTasks([]).ok).toBe(true)
      expect(JSON.parse(backend.getItem(KEY))).toEqual({ version: STORAGE_VERSION, tasks: [] })
    })

    it('reports quota errors without throwing', () => {
      const { backend, store } = setup()
      const quota = createQuotaError()
      vi.spyOn(backend, 'setItem').mockImplementation(() => {
        throw quota
      })
      expect(store.saveTasks([buildTask()])).toEqual({ ok: false, reason: SAVE_ERROR.QUOTA_EXCEEDED, error: quota })
    })

    it('reports other write failures without throwing', () => {
      const { backend, store } = setup()
      const failure = new Error('disk error')
      vi.spyOn(backend, 'setItem').mockImplementation(() => {
        throw failure
      })
      expect(store.saveTasks([])).toEqual({ ok: false, reason: SAVE_ERROR.WRITE_FAILED, error: failure })
    })

    it('reports unavailable storage', () => {
      expect(createTaskStorage(null).saveTasks([])).toEqual({
        ok: false,
        reason: SAVE_ERROR.UNAVAILABLE,
        error: null,
      })
    })

    it('throws on programmer error (non-array input)', () => {
      const { store } = setup()
      expect(() => store.saveTasks({})).toThrow(TypeError)
    })

    it('allows saving after recovering from corrupt data (backup already taken)', () => {
      const { backend, store } = setup({ [KEY]: 'broken' })
      const { backupKey } = store.loadTasks()
      expect(store.saveTasks([buildTask()]).ok).toBe(true)
      expect(backend.getItem(backupKey)).toBe('broken')
    })
  })
})
