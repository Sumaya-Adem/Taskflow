/**
 * Task state reducer. Pure: anything non-deterministic (new ids, the current
 * time) arrives in the action payload, so the same action always produces the
 * same state. Business rules live in the domain layer and are reused here.
 *
 * State shape:
 * {
 *   tasks: Task[],
 *   persistence: {
 *     loadStatus: LOAD_STATUS,   // outcome of the most recent load
 *     writable: boolean,         // false → changes stay in memory only
 *     backupKey: string | null,  // where damaged data was preserved
 *     droppedCount: number,      // records that could not be recovered
 *     saveError: SAVE_ERROR | null,
 *     syncNotice: SYNC_NOTICE | null,  // an external change this tab did not accept
 *     noticeDismissed: boolean,
 *   },
 * }
 */

import { TaskValidationError, toggleTaskCompleted, updateTask } from '../domain/task.js'
import { LOAD_STATUS } from '../storage/storage.js'

/** Why an external (other-tab) change was not applied as-is. */
export const SYNC_NOTICE = Object.freeze({
  /** Another tab removed the stored tasks; this tab kept its copy. */
  REMOVED: 'removed',
  /** Another tab wrote unreadable data; this tab restored its copy (after a backup). */
  RESTORED: 'restored',
})

export const TASK_ACTIONS = Object.freeze({
  LOADED: 'tasks/loaded',
  /** An external change was rejected; tasks stay as they are and `patch` updates persistence. */
  EXTERNAL_CHANGE_REJECTED: 'tasks/externalChangeRejected',
  ADDED: 'tasks/added',
  UPDATED: 'tasks/updated',
  COMPLETION_TOGGLED: 'tasks/completionToggled',
  DELETED: 'tasks/deleted',
  SAVE_SUCCEEDED: 'persistence/saveSucceeded',
  SAVE_FAILED: 'persistence/saveFailed',
  NOTICE_DISMISSED: 'persistence/noticeDismissed',
})

export const initialTasksState = Object.freeze({
  tasks: Object.freeze([]),
  persistence: Object.freeze({
    loadStatus: LOAD_STATUS.EMPTY,
    writable: true,
    backupKey: null,
    droppedCount: 0,
    saveError: null,
    syncNotice: null,
    noticeDismissed: false,
  }),
})

/** Builds state from a `taskStorage.loadTasks()` result (optionally with `saveError` from a write-back). */
export function createTasksState(loadResult) {
  return tasksReducer(initialTasksState, { type: TASK_ACTIONS.LOADED, result: loadResult })
}

/** Replaces the task with `id` using `transform`, keeping state identity when nothing changes. */
function replaceTask(state, id, transform) {
  const index = state.tasks.findIndex((task) => task.id === id)
  if (index === -1) return state

  const current = state.tasks[index]
  let next
  try {
    next = transform(current)
  } catch (error) {
    // Callers validate before dispatching; an invalid change is ignored rather than corrupting state.
    if (error instanceof TaskValidationError) return state
    throw error
  }
  if (next === current) return state

  const tasks = [...state.tasks]
  tasks[index] = next
  return { ...state, tasks }
}

export function tasksReducer(state, action) {
  switch (action.type) {
    case TASK_ACTIONS.LOADED: {
      const { result } = action
      return {
        tasks: result.tasks,
        persistence: {
          loadStatus: result.status,
          writable: result.writable,
          backupKey: result.backupKey ?? null,
          droppedCount: result.droppedCount ?? 0,
          saveError: result.saveError ?? null,
          syncNotice: null,
          noticeDismissed: false,
        },
      }
    }

    case TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED:
      return { ...state, persistence: { ...state.persistence, ...action.patch, noticeDismissed: false } }

    case TASK_ACTIONS.ADDED: {
      if (state.tasks.some((task) => task.id === action.task.id)) return state
      return { ...state, tasks: [...state.tasks, action.task] }
    }

    case TASK_ACTIONS.UPDATED:
      return replaceTask(state, action.id, (task) => updateTask(task, action.changes, { now: action.now }))

    case TASK_ACTIONS.COMPLETION_TOGGLED:
      return replaceTask(state, action.id, (task) => toggleTaskCompleted(task, { now: action.now }))

    case TASK_ACTIONS.DELETED: {
      const tasks = state.tasks.filter((task) => task.id !== action.id)
      return tasks.length === state.tasks.length ? state : { ...state, tasks }
    }

    case TASK_ACTIONS.SAVE_SUCCEEDED: {
      // A successful save also resolves "removed in another tab": the tasks are stored again.
      const syncNotice = state.persistence.syncNotice === SYNC_NOTICE.REMOVED ? null : state.persistence.syncNotice
      if (state.persistence.saveError === null && syncNotice === state.persistence.syncNotice) return state
      return { ...state, persistence: { ...state.persistence, saveError: null, syncNotice } }
    }

    case TASK_ACTIONS.SAVE_FAILED:
      return {
        ...state,
        persistence: { ...state.persistence, saveError: action.reason, noticeDismissed: false },
      }

    case TASK_ACTIONS.NOTICE_DISMISSED:
      if (state.persistence.noticeDismissed) return state
      return { ...state, persistence: { ...state.persistence, noticeDismissed: true } }

    default:
      throw new Error(`Unknown task action: ${action.type}`)
  }
}
