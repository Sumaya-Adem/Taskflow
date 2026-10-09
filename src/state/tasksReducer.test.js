import { describe, expect, it } from 'vitest'
import { LOAD_STATUS, SAVE_ERROR } from '../storage/storage.js'
import { buildTask } from '../test/fixtures.js'
import { SYNC_NOTICE, TASK_ACTIONS, createTasksState, initialTasksState, tasksReducer } from './tasksReducer.js'

const NOW = new Date('2026-10-09T12:00:00.000Z')

const loadResult = (overrides = {}) => ({
  status: LOAD_STATUS.OK,
  tasks: [],
  droppedCount: 0,
  repairedCount: 0,
  backupKey: null,
  writable: true,
  error: null,
  ...overrides,
})

const stateWith = (tasks) => createTasksState(loadResult({ tasks }))

describe('initial state', () => {
  it('starts empty and writable', () => {
    expect(initialTasksState).toEqual({
      tasks: [],
      persistence: {
        loadStatus: LOAD_STATUS.EMPTY,
        writable: true,
        backupKey: null,
        droppedCount: 0,
        saveError: null,
        syncNotice: null,
        noticeDismissed: false,
      },
    })
  })

  it('is built from a storage load result', () => {
    const tasks = [buildTask()]
    const state = createTasksState(
      loadResult({ status: LOAD_STATUS.REPAIRED, tasks, droppedCount: 2, backupKey: 'backup-key', writable: true }),
    )
    expect(state.tasks).toBe(tasks)
    expect(state.persistence).toEqual({
      loadStatus: LOAD_STATUS.REPAIRED,
      writable: true,
      backupKey: 'backup-key',
      droppedCount: 2,
      saveError: null,
      syncNotice: null,
      noticeDismissed: false,
    })
  })

  it('records unwritable storage', () => {
    const state = createTasksState(loadResult({ status: LOAD_STATUS.UNAVAILABLE, writable: false }))
    expect(state.persistence).toMatchObject({ loadStatus: LOAD_STATUS.UNAVAILABLE, writable: false })
  })
})

describe('LOADED', () => {
  it('replaces tasks and resets persistence status (e.g. after cross-tab sync)', () => {
    let state = stateWith([buildTask({ id: 'old' })])
    state = tasksReducer(state, { type: TASK_ACTIONS.SAVE_FAILED, reason: SAVE_ERROR.QUOTA_EXCEEDED })
    const next = tasksReducer(state, { type: TASK_ACTIONS.LOADED, result: loadResult({ tasks: [buildTask({ id: 'new' })] }) })
    expect(next.tasks.map((task) => task.id)).toEqual(['new'])
    expect(next.persistence.saveError).toBeNull()
  })
})

describe('ADDED', () => {
  it('appends the task', () => {
    const next = tasksReducer(stateWith([buildTask({ id: 'a' })]), { type: TASK_ACTIONS.ADDED, task: buildTask({ id: 'b' }) })
    expect(next.tasks.map((task) => task.id)).toEqual(['a', 'b'])
  })

  it('ignores a duplicate id', () => {
    const state = stateWith([buildTask({ id: 'a' })])
    expect(tasksReducer(state, { type: TASK_ACTIONS.ADDED, task: buildTask({ id: 'a', title: 'Other' }) })).toBe(state)
  })

  it('does not mutate the previous state', () => {
    const state = stateWith([buildTask({ id: 'a' })])
    const before = structuredClone(state)
    tasksReducer(state, { type: TASK_ACTIONS.ADDED, task: buildTask({ id: 'b' }) })
    expect(state).toEqual(before)
  })
})

describe('UPDATED', () => {
  it('applies changes through the domain model, using the action timestamp', () => {
    const state = stateWith([buildTask({ id: 'a' }), buildTask({ id: 'b', title: 'Before' })])
    const next = tasksReducer(state, {
      type: TASK_ACTIONS.UPDATED,
      id: 'b',
      changes: { title: '  After  ', priority: 'high' },
      now: NOW,
    })
    expect(next.tasks[1]).toMatchObject({ title: 'After', priority: 'high', updatedAt: NOW.toISOString() })
    expect(next.tasks[0]).toBe(state.tasks[0]) // untouched tasks keep identity
  })

  it('ignores unknown ids', () => {
    const state = stateWith([buildTask({ id: 'a' })])
    expect(tasksReducer(state, { type: TASK_ACTIONS.UPDATED, id: 'missing', changes: { title: 'X' }, now: NOW })).toBe(state)
  })

  it('ignores invalid changes instead of storing them', () => {
    const state = stateWith([buildTask({ id: 'a' })])
    expect(tasksReducer(state, { type: TASK_ACTIONS.UPDATED, id: 'a', changes: { title: '   ' }, now: NOW })).toBe(state)
  })
})

describe('COMPLETION_TOGGLED', () => {
  it('toggles completion and timestamps it', () => {
    const state = stateWith([buildTask({ id: 'a' })])
    const done = tasksReducer(state, { type: TASK_ACTIONS.COMPLETION_TOGGLED, id: 'a', now: NOW })
    expect(done.tasks[0]).toMatchObject({ completed: true, completedAt: NOW.toISOString() })
    const reopened = tasksReducer(done, { type: TASK_ACTIONS.COMPLETION_TOGGLED, id: 'a', now: NOW })
    expect(reopened.tasks[0]).toMatchObject({ completed: false, completedAt: null })
  })

  it('applies two quick toggles to the latest state (no stale double-toggle)', () => {
    let state = stateWith([buildTask({ id: 'a' })])
    state = tasksReducer(state, { type: TASK_ACTIONS.COMPLETION_TOGGLED, id: 'a', now: NOW })
    state = tasksReducer(state, { type: TASK_ACTIONS.COMPLETION_TOGGLED, id: 'a', now: NOW })
    expect(state.tasks[0].completed).toBe(false)
  })
})

describe('DELETED', () => {
  it('removes the task', () => {
    const state = stateWith([buildTask({ id: 'a' }), buildTask({ id: 'b' })])
    expect(tasksReducer(state, { type: TASK_ACTIONS.DELETED, id: 'a' }).tasks.map((task) => task.id)).toEqual(['b'])
  })

  it('returns the same state for unknown ids', () => {
    const state = stateWith([buildTask({ id: 'a' })])
    expect(tasksReducer(state, { type: TASK_ACTIONS.DELETED, id: 'zzz' })).toBe(state)
  })
})

describe('persistence actions', () => {
  it('records a save failure and re-shows a dismissed notice', () => {
    let state = stateWith([])
    state = tasksReducer(state, { type: TASK_ACTIONS.NOTICE_DISMISSED })
    state = tasksReducer(state, { type: TASK_ACTIONS.SAVE_FAILED, reason: SAVE_ERROR.QUOTA_EXCEEDED })
    expect(state.persistence).toMatchObject({ saveError: SAVE_ERROR.QUOTA_EXCEEDED, noticeDismissed: false })
  })

  it('clears a save error after a successful save', () => {
    let state = tasksReducer(stateWith([]), { type: TASK_ACTIONS.SAVE_FAILED, reason: SAVE_ERROR.WRITE_FAILED })
    state = tasksReducer(state, { type: TASK_ACTIONS.SAVE_SUCCEEDED })
    expect(state.persistence.saveError).toBeNull()
  })

  it('keeps state identity when a save succeeds with nothing to clear', () => {
    const state = stateWith([])
    expect(tasksReducer(state, { type: TASK_ACTIONS.SAVE_SUCCEEDED })).toBe(state)
  })

  it('dismisses the notice once', () => {
    const dismissed = tasksReducer(stateWith([]), { type: TASK_ACTIONS.NOTICE_DISMISSED })
    expect(dismissed.persistence.noticeDismissed).toBe(true)
    expect(tasksReducer(dismissed, { type: TASK_ACTIONS.NOTICE_DISMISSED })).toBe(dismissed)
  })
})

it('throws on unknown actions', () => {
  expect(() => tasksReducer(initialTasksState, { type: 'nope' })).toThrow('Unknown task action: nope')
})

describe('Phase 6: sync and save status', () => {
  it('records a write-back failure from the load result', () => {
    const state = createTasksState(loadResult({ status: LOAD_STATUS.REPAIRED, saveError: SAVE_ERROR.QUOTA_EXCEEDED }))
    expect(state.persistence.saveError).toBe(SAVE_ERROR.QUOTA_EXCEEDED)
  })

  it('EXTERNAL_CHANGE_REJECTED keeps tasks and patches persistence, re-showing the notice', () => {
    const tasks = [buildTask({ id: 'a' })]
    let state = tasksReducer(stateWith(tasks), { type: TASK_ACTIONS.NOTICE_DISMISSED })
    state = tasksReducer(state, { type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED, patch: { syncNotice: SYNC_NOTICE.REMOVED } })
    expect(state.tasks).toBe(tasks)
    expect(state.persistence).toMatchObject({ syncNotice: SYNC_NOTICE.REMOVED, noticeDismissed: false })
  })

  it('a successful save resolves "removed" but not "restored"', () => {
    const removed = tasksReducer(stateWith([]), { type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED, patch: { syncNotice: SYNC_NOTICE.REMOVED } })
    expect(tasksReducer(removed, { type: TASK_ACTIONS.SAVE_SUCCEEDED }).persistence.syncNotice).toBeNull()

    const restored = tasksReducer(stateWith([]), { type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED, patch: { syncNotice: SYNC_NOTICE.RESTORED } })
    expect(tasksReducer(restored, { type: TASK_ACTIONS.SAVE_SUCCEEDED })).toBe(restored)
  })

  it('a fresh load clears any sync notice', () => {
    const removed = tasksReducer(stateWith([]), { type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED, patch: { syncNotice: SYNC_NOTICE.REMOVED } })
    expect(tasksReducer(removed, { type: TASK_ACTIONS.LOADED, result: loadResult() }).persistence.syncNotice).toBeNull()
  })
})
