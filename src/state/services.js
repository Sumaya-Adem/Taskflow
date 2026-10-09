/**
 * Creates the storage-backed services the app needs and performs the initial
 * loads exactly once, outside React rendering. Tests pass an in-memory
 * storage; the browser entry point uses the defaults.
 */

import { createPreferenceStorage, createTaskStorage, resolveBrowserStorage } from '../storage/storage.js'

export function createAppServices({ storage = resolveBrowserStorage(), eventTarget = globalThis.window } = {}) {
  const taskStorage = createTaskStorage(storage, { eventTarget })
  const preferenceStorage = createPreferenceStorage(storage)

  return {
    taskStorage,
    preferenceStorage,
    initialTaskLoad: taskStorage.loadTasks(),
    initialPreferences: preferenceStorage.loadPreferences().preferences,
  }
}
