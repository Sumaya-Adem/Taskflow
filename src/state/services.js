/**
 * Creates the storage-backed services the app needs and performs the initial
 * loads exactly once, outside React rendering. Tests pass an in-memory
 * storage; the browser entry point uses the defaults.
 */

import { LOAD_STATUS, createPreferenceStorage, createTaskStorage, resolveBrowserStorage } from '../storage/storage.js'

/**
 * Writes recovered data (repaired records, or an empty list after corrupt
 * data was backed up) back to storage. Without this, every reload would back
 * up the same damaged data again. Adds `saveError` (null on success or when
 * nothing needed writing) to the load result.
 */
export function writeBackRecoveredTasks(taskStorage, loadResult) {
  const recovered = loadResult.status === LOAD_STATUS.REPAIRED || loadResult.status === LOAD_STATUS.CORRUPT
  if (!recovered || !loadResult.writable) return { ...loadResult, saveError: null }
  const save = taskStorage.saveTasks(loadResult.tasks)
  return { ...loadResult, saveError: save.ok ? null : save.reason }
}

export function createAppServices({ storage = resolveBrowserStorage(), eventTarget = globalThis.window } = {}) {
  const taskStorage = createTaskStorage(storage, { eventTarget })
  const preferenceStorage = createPreferenceStorage(storage, { eventTarget })

  return {
    taskStorage,
    preferenceStorage,
    initialTaskLoad: writeBackRecoveredTasks(taskStorage, taskStorage.loadTasks()),
    initialPreferences: preferenceStorage.loadPreferences().preferences,
  }
}
