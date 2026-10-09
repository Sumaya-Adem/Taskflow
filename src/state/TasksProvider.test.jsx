import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, STORAGE_VERSION } from '../config/constants.js'
import { BACKUP_KEY_PREFIX, LOAD_STATUS, SAVE_ERROR, createTaskStorage } from '../storage/storage.js'
import { buildTask } from '../test/fixtures.js'
import { createMemoryStorage, createQuotaError } from '../test/memoryStorage.js'
import { TASK_NOT_FOUND_ERROR, TasksProvider } from './TasksProvider.jsx'
import { writeBackRecoveredTasks } from './services.js'
import { useTasks } from './useTasks.js'

const KEY = STORAGE_KEYS.TASKS
const NOW = new Date('2026-10-09T12:00:00.000Z')
const clock = () => NOW
const envelope = (tasks, version = STORAGE_VERSION) => JSON.stringify({ version, tasks })
const storedTasks = (backend) => JSON.parse(backend.getItem(KEY)).tasks

/** Renders useTasks() inside a provider over in-memory storage. */
function setup({ entries = {}, backend = createMemoryStorage(entries) } = {}) {
  const storage = createTaskStorage(backend, { clock, eventTarget: window })
  // Same initial load the app performs in createAppServices (including write-back of recovered data).
  const initialLoad = writeBackRecoveredTasks(storage, storage.loadTasks())
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
    expect(outcome).toEqual({ ok: true, saved: true })
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
    expect(outcome).toEqual({ ok: true, saved: true })
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

  // Phase 6 policy: clearing storage elsewhere must not silently wipe the tasks open in this tab.
  it('keeps its tasks when storage is cleared in another tab, and saves them again on the next change', () => {
    const tasks = [buildTask({ id: 'a' })]
    const { result, backend } = setup({ entries: { [KEY]: envelope(tasks) } })
    backend.clear()
    dispatchStorageEvent(null)

    expect(result.current.tasks).toEqual(tasks)
    expect(result.current.persistence.syncNotice).toBe('removed')
    expect(backend.getItem(KEY)).toBeNull() // nothing is rewritten behind the user's back

    act(() => {
      result.current.addTask({ title: 'After clear' })
    })
    expect(storedTasks(backend).map((task) => task.title)).toEqual(['Write report', 'After clear'])
    expect(result.current.persistence.syncNotice).toBeNull()
  })

  it('mirrors a cleared storage when this tab has no tasks either', () => {
    const { result, backend } = setup({ entries: { [KEY]: envelope([]) } })
    backend.clear()
    dispatchStorageEvent(null)
    expect(result.current.tasks).toEqual([])
    expect(result.current.persistence).toMatchObject({ loadStatus: LOAD_STATUS.EMPTY, syncNotice: null })
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

describe('write-through persistence (Phase 6)', () => {
  it('saves synchronously inside the action and reports it', () => {
    const { result, backend } = setup()
    let outcome
    act(() => {
      outcome = result.current.addTask({ title: 'Saved now' })
      // Already in storage before React re-renders.
      expect(storedTasks(backend).map((task) => task.title)).toEqual(['Saved now'])
    })
    expect(outcome.saved).toBe(true)
  })

  it('reports saved: false when the write fails, keeping the change in memory', () => {
    const { result, setItem } = setup()
    setItem.mockImplementation(() => {
      throw createQuotaError()
    })
    let outcome
    act(() => {
      outcome = result.current.addTask({ title: 'Not saved' })
    })
    expect(outcome).toMatchObject({ ok: true, saved: false })
    expect(result.current.tasks).toHaveLength(1)
    expect(result.current.persistence.saveError).toBe(SAVE_ERROR.QUOTA_EXCEEDED)
  })

  it.each(['updateTask', 'toggleTaskCompleted', 'deleteTask'])('%s reports saved: false when storage is unavailable', (action) => {
    const { result } = setup({ backend: null })
    let id
    act(() => {
      id = result.current.addTask({ title: 'Memory only' }).task.id
    })
    let outcome
    act(() => {
      outcome = result.current[action](id, { title: 'Changed' })
    })
    expect(outcome).toEqual({ ok: true, saved: false })
  })

  it('applies several actions in the same event on top of each other', () => {
    const { result, backend } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a' })]) } })
    act(() => {
      result.current.addTask({ title: 'First' })
      result.current.addTask({ title: 'Second' })
      result.current.toggleTaskCompleted('a')
      result.current.toggleTaskCompleted('a') // a fast double click: back to active
    })
    expect(result.current.tasks.map((task) => task.title)).toEqual(['Write report', 'First', 'Second'])
    expect(storedTasks(backend).map((task) => [task.title, task.completed])).toEqual([
      ['Write report', false],
      ['First', false],
      ['Second', false],
    ])
  })

  it('keeps action functions stable across task changes', () => {
    const { result } = setup()
    const { addTask, deleteTask } = result.current
    act(() => {
      addTask({ title: 'One' })
    })
    expect(result.current.addTask).toBe(addTask)
    expect(result.current.deleteTask).toBe(deleteTask)
  })
})

describe('cross-tab sync policy (Phase 6)', () => {
  const external = (backend, value) => {
    backend.setItem(KEY, value)
  }

  it('builds later local changes on top of external changes (no stale overwrite)', () => {
    const { result, backend } = setup({ entries: { [KEY]: envelope([buildTask({ id: 'a', title: 'Mine' })]) } })
    external(backend, envelope([buildTask({ id: 'a', title: 'Mine' }), buildTask({ id: 'b', title: 'From other tab' })]))
    dispatchStorageEvent()

    act(() => {
      result.current.addTask({ title: 'Added here' })
    })
    expect(storedTasks(backend).map((task) => task.title)).toEqual(['Mine', 'From other tab', 'Added here'])
  })

  it('writes repaired external data back exactly once', () => {
    const { result, backend, setItem } = setup()
    external(backend, envelope([buildTask({ id: 'x', priority: 'URGENT' })]))
    setItem.mockClear()
    dispatchStorageEvent()

    expect(result.current.tasks[0].priority).toBe('medium')
    const taskWrites = setItem.mock.calls.filter(([key]) => key === KEY)
    expect(taskWrites).toHaveLength(1)
    expect(storedTasks(backend)[0].priority).toBe('medium')
  })

  it('restores its own tasks over unreadable external data, after backing that data up', () => {
    const tasks = [buildTask({ id: 'a' })]
    const { result, backend } = setup({ entries: { [KEY]: envelope(tasks) } })
    external(backend, '{not json')
    dispatchStorageEvent()

    expect(result.current.tasks).toEqual(tasks)
    expect(result.current.persistence.syncNotice).toBe('restored')
    expect(storedTasks(backend)).toEqual(tasks)
    const backups = Object.entries(backend.entries()).filter(([key]) => key.startsWith(BACKUP_KEY_PREFIX))
    expect(backups.map(([, value]) => value)).toEqual(['{not json'])
  })

  it('keeps tasks in memory and stops saving when another tab writes a newer schema version', () => {
    const tasks = [buildTask({ id: 'a' })]
    const { result, backend, setItem } = setup({ entries: { [KEY]: envelope(tasks) } })
    const newer = envelope([buildTask({ id: 'z' })], STORAGE_VERSION + 1)
    external(backend, newer)
    setItem.mockClear()
    dispatchStorageEvent()

    expect(result.current.tasks).toEqual(tasks)
    expect(result.current.persistence).toMatchObject({ loadStatus: LOAD_STATUS.UNSUPPORTED_VERSION, writable: false })

    let outcome
    act(() => {
      outcome = result.current.addTask({ title: 'In memory' })
    })
    expect(outcome.saved).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
    expect(backend.getItem(KEY)).toBe(newer)
  })

  it('does not write anything when loading valid external data (no sync loop)', () => {
    const { backend, setItem } = setup()
    external(backend, envelope([buildTask({ id: 'b' })]))
    setItem.mockClear()
    dispatchStorageEvent()
    dispatchStorageEvent() // repeated events are harmless
    expect(setItem).not.toHaveBeenCalled()
  })

  it('ignores events once storage cannot be read', () => {
    const tasks = [buildTask({ id: 'a' })]
    const { result, backend } = setup({ entries: { [KEY]: envelope(tasks) } })
    vi.spyOn(backend, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    dispatchStorageEvent()
    expect(result.current.tasks).toEqual(tasks)
  })

  it('removes its storage listener on unmount', () => {
    const removeEventListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = setup()
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})
