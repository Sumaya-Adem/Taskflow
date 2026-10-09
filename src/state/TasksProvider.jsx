import { useEffect, useMemo, useReducer, useRef } from 'react'
import { createTask, validateTaskInput } from '../domain/task.js'
import { LOAD_STATUS } from '../storage/storage.js'
import { writeBackRecoveredTasks } from './services.js'
import { TasksContext } from './tasksContext.js'
import { SYNC_NOTICE, TASK_ACTIONS, createTasksState, tasksReducer } from './tasksReducer.js'

export const TASK_NOT_FOUND_ERROR = 'This task no longer exists.'

const systemClock = () => new Date()

/**
 * Decides how this tab reacts to a change another tab made to stored tasks.
 *
 * Policy (storage is the shared source of truth, last write wins):
 * - Valid data (OK/REPAIRED) replaces this tab's tasks; repaired data is written back once.
 * - Removed data (EMPTY) does not wipe this tab: its tasks are kept and saved again on the next change.
 * - Unreadable data (CORRUPT) is backed up by the adapter and replaced with this tab's tasks.
 * - Data from a newer app version (UNSUPPORTED_VERSION) is left untouched; this tab keeps its
 *   tasks in memory and stops saving.
 * - If storage can no longer be read, the event is ignored.
 *
 * Returns the reducer actions to apply.
 */
function planExternalChange(storage, localState) {
  const result = storage.loadTasks()

  switch (result.status) {
    case LOAD_STATUS.OK:
    case LOAD_STATUS.REPAIRED:
      return [{ type: TASK_ACTIONS.LOADED, result: writeBackRecoveredTasks(storage, result) }]

    case LOAD_STATUS.EMPTY:
      if (localState.tasks.length === 0) return [{ type: TASK_ACTIONS.LOADED, result: { ...result, saveError: null } }]
      return [{ type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED, patch: { syncNotice: SYNC_NOTICE.REMOVED } }]

    case LOAD_STATUS.CORRUPT: {
      if (!result.writable) {
        // The backup failed: do not overwrite the only copy of the unreadable data.
        return [
          {
            type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED,
            patch: { loadStatus: LOAD_STATUS.CORRUPT, writable: false, syncNotice: null },
          },
        ]
      }
      const save = storage.saveTasks(localState.tasks)
      return [
        {
          type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED,
          patch: { syncNotice: SYNC_NOTICE.RESTORED, backupKey: result.backupKey, saveError: save.ok ? null : save.reason },
        },
      ]
    }

    case LOAD_STATUS.UNSUPPORTED_VERSION:
      return [
        {
          type: TASK_ACTIONS.EXTERNAL_CHANGE_REJECTED,
          // Replaces any earlier sync notice: "saving is paused" matters more now.
          patch: { loadStatus: LOAD_STATUS.UNSUPPORTED_VERSION, writable: false, syncNotice: null },
        },
      ]

    default:
      return []
  }
}

/**
 * Provides task state backed by a task storage adapter.
 *
 * `initialLoad` is the (recovered) result of `storage.loadTasks()`, produced
 * once at startup by createAppServices rather than during render: loading can
 * write backups, and React may run render-phase initializers more than once.
 *
 * Changes are written through to storage synchronously, inside the action, so
 * every action can report whether the change was actually saved. Actions
 * return `{ ok: true, saved, ... }` or `{ ok: false, errors }` and never throw.
 */
export function TasksProvider({ storage, initialLoad, clock = systemClock, children }) {
  const [state, dispatch] = useReducer(tasksReducer, initialLoad, createTasksState)

  // The latest state, including changes React has not rendered yet, so that
  // several actions in one event (e.g. a fast double click) build on each other.
  // Only read and written in event handlers and effects, never during render.
  const latestRef = useRef(state)

  const { apply, publicActions } = useMemo(() => {
    /** Applies actions to the latest state, then lets React render the result. */
    const apply = (reducerActions) => {
      latestRef.current = reducerActions.reduce(tasksReducer, latestRef.current)
      reducerActions.forEach(dispatch)
    }

    /** Applies a task change and saves the resulting list. Returns whether it was saved. */
    const commit = (action) => {
      const next = tasksReducer(latestRef.current, action)
      if (next.tasks === latestRef.current.tasks) return true // nothing changed, nothing to save

      if (!next.persistence.writable) {
        apply([action]) // storage unavailable or protected: keep the change in memory only
        return false
      }
      const result = storage.saveTasks(next.tasks)
      apply([action, result.ok ? { type: TASK_ACTIONS.SAVE_SUCCEEDED } : { type: TASK_ACTIONS.SAVE_FAILED, reason: result.reason }])
      return result.ok
    }

    const findTask = (id) => latestRef.current.tasks.find((task) => task.id === id)
    const notFound = { ok: false, errors: { form: TASK_NOT_FOUND_ERROR } }

    const publicActions = {
      /** Validates and adds a task. Returns `{ ok, saved, task }` or `{ ok: false, errors }`. */
      addTask(input) {
        const validation = validateTaskInput(input)
        if (!validation.isValid) return { ok: false, errors: validation.errors }
        const task = createTask(validation.values, { now: clock() })
        return { ok: true, saved: commit({ type: TASK_ACTIONS.ADDED, task }), task }
      },

      /** Validates and applies edits to a task's editable fields. */
      updateTask(id, changes) {
        const current = findTask(id)
        if (!current) return notFound
        const validation = validateTaskInput({ ...current, ...changes })
        if (!validation.isValid) return { ok: false, errors: validation.errors }
        return { ok: true, saved: commit({ type: TASK_ACTIONS.UPDATED, id, changes, now: clock() }) }
      },

      /** Flips a task between active and completed. */
      toggleTaskCompleted(id) {
        if (!findTask(id)) return notFound
        return { ok: true, saved: commit({ type: TASK_ACTIONS.COMPLETION_TOGGLED, id, now: clock() }) }
      },

      deleteTask(id) {
        if (!findTask(id)) return notFound
        return { ok: true, saved: commit({ type: TASK_ACTIONS.DELETED, id }) }
      },

      dismissStorageNotice() {
        apply([{ type: TASK_ACTIONS.NOTICE_DISMISSED }])
      },
    }
    return { apply, publicActions }
  }, [storage, clock])

  // Cross-tab sync: storage events only fire in *other* tabs, so this tab's own
  // writes never come back here; writes made while handling an event (write-back
  // or restore) produce a valid state that other tabs simply load, so no loop.
  useEffect(() => storage.subscribe(() => apply(planExternalChange(storage, latestRef.current))), [storage, apply])

  const value = useMemo(
    () => ({ tasks: state.tasks, persistence: state.persistence, ...publicActions }),
    [state.tasks, state.persistence, publicActions],
  )

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
}
