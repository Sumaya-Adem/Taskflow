import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, STORAGE_VERSION } from '../config/constants.js'
import { BACKUP_KEY_PREFIX, LOAD_STATUS, SAVE_ERROR, createTaskStorage } from '../storage/storage.js'
import { buildTask } from '../test/fixtures.js'
import { createMemoryStorage, createQuotaError } from '../test/memoryStorage.js'
import { TASK_NOT_FOUND_ERROR, TasksProvider } from './TasksProvider.jsx'
import { useTasks } from './useTasks.js'

const KEY = STORAGE_KEYS.TASKS
const NOW = new Date('2026-10-09T12:00:00.000Z')
const clock = () => NOW
const envelope = (tasks, version = STORAGE_VERSION) => JSON.stringify({ version, tasks })
const storedTasks = (backend) => JSON.parse(backend.getItem(KEY)).tasks

/** Renders useTasks() inside a provider over in-memory storage. */
function setup({ entries = {}, backend = createMemoryStorage(entries) } = {}) {
  const storage = createTaskStorage(backend, { clock, eventTarget: window })
  const initialLoad = storage.loadTasks()
  const setItem = backend ? vi.spyOn(backend, 'setItem') : null
  const wrapper = ({ children }) => (
    <TasksProvider storage={storage} initialLoad={initialLoad} clock={clock}>
      {children}
    </TasksProvider>
  )
  const hook = renderHook(() => useTasks(), { wrapper })
  return { ...hook, backend, storage, setItem, initialLoad }
}

/** Simulates another tab writing to storage. */
function dispatchStorageEvent(key = KEY) {
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
}

describe('useTasks', () => {
  it('throws outside a TasksProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useTasks())).toThrow('useTasks must be used within a TasksProvider')
  })
})

describe('initial load', () => {
  it('exposes stored tasks without re-saving them', () => {
    const tasks = [buildTask({ id: 'a' }), buildTask({ id: 'b' })]
    const { result, setItem } = setup({ entries: { [KEY]: envelope(tasks) } })
    expect(result.current.tasks).toEqual(tasks)
    expect(result.current.persistence).toMatchObject({ loadStatus: LOAD_STATUS.OK, writable: true })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('starts empty when nothing is stored, without writing', () => {
    const { result, setItem } = setup()
    expect(result.current.tasks).toEqual([])
    expect(result.current.persistence.loadStatus).toBe(LOAD_STATUS.EMPTY)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('writes recovered data back once, so reloads do not back it up again', () => {
    const { backend, result } = setup({ entries: { [KEY]: 'corrupt{' } })

    expect(result.current.persistence.loadStatus).toBe(LOAD_STATUS.CORRUPT)
    expect(storedTasks(backend)).toEqual([])
    const backups = Object.keys(backend.entries()).filter((key) => key.startsWith(BACKUP_KEY_PREFIX))
    expect(backups).toHaveLength(1)
    expect(backend.getItem(backups[0])).toBe('corrupt{')

    // A fresh load now finds clean data.
    expect(createTaskStorage(backend, { clock }).loadTasks().status).toBe(LOAD_STATUS.OK)
  })

  it('persists repaired records in their normalized form', () => {
    const { backend } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a', priority: 'URGENT' }), null]) } })
    expect(storedTasks(backend)).toEqual([buildTask({ id: 'a', priority: 'medium' })])
  })
})

describe('actions', () => {
  it('addTask validates, creates and persists a task', () => {
    const { result, backend } = setup()
    let outcome
    act(() => {
      outcome = result.current.addTask({ title: '  Plan sprint ', priority: 'high' })
    })

    expect(outcome.ok).toBe(true)
    expect(outcome.task).toMatchObject({ title: 'Plan sprint', priority: 'high', createdAt: NOW.toISOString() })
    expect(result.current.tasks).toEqual([outcome.task])
    expect(storedTasks(backend)).toEqual([outcome.task])
  })

  it('addTask returns field errors and changes nothing when invalid', () => {
    const { result, setItem } = setup()
    let outcome
    act(() => {
      outcome = result.current.addTask({ title: '   ', priority: 'urgent' })
    })
    expect(outcome).toEqual({
      ok: false,
      errors: { title: 'Title is required.', priority: 'Choose a valid priority.' },
    })
    expect(result.current.tasks).toEqual([])
    expect(setItem).not.toHaveBeenCalled()
  })

  it('updateTask applies and persists valid changes', () => {
    const { result, backend } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a', title: 'Old' })]) } })
    let outcome
    act(() => {
      outcome = result.current.updateTask('a', { title: 'New', dueDate: '2026-10-20' })
    })
    expect(outcome).toEqual({ ok: true })
    expect(result.current.tasks[0]).toMatchObject({ title: 'New', dueDate: '2026-10-20', updatedAt: NOW.toISOString() })
    expect(storedTasks(backend)[0].title).toBe('New')
  })

  it('updateTask rejects invalid changes', () => {
    const { result, setItem } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a' })]) } })
    let outcome
    act(() => {
      outcome = result.current.updateTask('a', { dueDate: '2026-02-30' })
    })
    expect(outcome).toEqual({ ok: false, errors: { dueDate: 'Enter a valid date.' } })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('toggleTaskCompleted flips completion and persists it', () => {
    const { result, backend } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a' })]) } })
    act(() => {
      result.current.toggleTaskCompleted('a')
    })
    expect(result.current.tasks[0]).toMatchObject({ completed: true, completedAt: NOW.toISOString() })
    expect(storedTasks(backend)[0].completed).toBe(true)
  })

  it('deleteTask removes and persists', () => {
    const { result, backend } = setup({
      entries: { [KEY]: envelope([buildTask({ id: 'a' }), buildTask({ id: 'b' })]) },
    })
    let outcome
    act(() => {
      outcome = result.current.deleteTask('a')
    })
    expect(outcome).toEqual({ ok: true })
    expect(result.current.tasks.map((task) => task.id)).toEqual(['b'])
    expect(storedTasks(backend).map((task) => task.id)).toEqual(['b'])
  })

  it.each(['updateTask', 'toggleTaskCompleted', 'deleteTask'])('%s reports a missing task', (action) => {
    const { result, setItem } = setup()
    let outcome
    act(() => {
      outcome = result.current[action]('missing', { title: 'X' })
    })
    expect(outcome).toEqual({ ok: false, errors: { form: TASK_NOT_FOUND_ERROR } })
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('storage failures', () => {
  it('keeps working in memory when storage is unavailable', () => {
    const { result } = setup({ backend: null })
    expect(result.current.persistence).toMatchObject({ loadStatus: LOAD_STATUS.UNAVAILABLE, writable: false })
    act(() => {
      result.current.addTask({ title: 'In memory' })
    })
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.persistence.saveError).toBeNull()
  })

  it('never overwrites data from a newer version', () => {
    const raw = envelope([buildTask()], STORAGE_VERSION + 1)
    const { result, backend, setItem } = setup({ entries: { [KEY]: raw } })
    act(() => {
      result.current.addTask({ title: 'New task' })
    })
    expect(result.current.tasks).toHaveLength(1)
    expect(backend.getItem(KEY)).toBe(raw)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reports a quota error, keeps the change in memory and recovers on the next successful save', () => {
    const { result, setItem } = setup()
    setItem.mockImplementationOnce(() => {
      throw createQuotaError()
    })

    act(() => {
      result.current.addTask({ title: 'First' })
    })
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.persistence.saveError).toBe(SAVE_ERROR.QUOTA_EXCEEDED)

    act(() => {
      result.current.addTask({ title: 'Second' })
    })
    expect(result.current.persistence.saveError).toBeNull()
  })

  it('reports generic write failures', () => {
    const { result, setItem } = setup()
    setItem.mockImplementationOnce(() => {
      throw new Error('disk error')
    })
    act(() => {
      result.current.addTask({ title: 'Task' })
    })
    expect(result.current.persistence.saveError).toBe(SAVE_ERROR.WRITE_FAILED)
  })

  it('dismissStorageNotice marks the notice dismissed', () => {
    const { result } = setup({ backend: null })
    act(() => {
      result.current.dismissStorageNotice()
    })
    expect(result.current.persistence.noticeDismissed).toBe(true)
  })
})

describe('cross-tab sync', () => {
  it('reloads tasks when another tab changes them, without echoing a save', () => {
    const { result, backend, setItem } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a' })]) } })
    const otherTabTasks = [buildTask({ id: 'a' }), buildTask({ id: 'from-other-tab' })]
    backend.setItem(KEY, envelope(otherTabTasks))
    setItem.mockClear()

    dispatchStorageEvent()

    expect(result.current.tasks).toEqual(otherTabTasks)
    expect(setItem).not.toHaveBeenCalled()
  })

  it('reloads when storage is cleared in another tab', () => {
    const { result, backend } = setup({ entries: { [KEY]: envelope([buildTask()]) } })
    backend.clear()
    dispatchStorageEvent(null)
    expect(result.current.tasks).toEqual([])
    expect(result.current.persistence.loadStatus).toBe(LOAD_STATUS.EMPTY)
  })

  it('ignores changes to unrelated keys', () => {
    const tasks = [buildTask()]
    const { result, backend } = setup({ entries: { [KEY]: envelope(tasks) } })
    backend.setItem(KEY, envelope([]))
    dispatchStorageEvent('some-other-key')
    expect(result.current.tasks).toEqual(tasks)
  })

  it('stops listening after unmount', () => {
    const { unmount, storage } = setup()
    const loadTasks = vi.spyOn(storage, 'loadTasks')
    unmount()
    dispatchStorageEvent()
    expect(loadTasks).not.toHaveBeenCalled()
  })
})
