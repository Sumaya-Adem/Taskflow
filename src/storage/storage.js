/**
 * Persistence adapter: the only module that touches `localStorage` (apart
 * from the tiny pre-render theme script in index.html).
 *
 * Tasks are stored under STORAGE_KEYS.TASKS as a versioned envelope:
 *   { "version": 1, "tasks": [ ...task records ] }
 *
 * Every read is treated as untrusted. Records are normalized through the
 * domain model, and whenever stored data cannot be loaded exactly as written
 * (corrupt JSON, unexpected shape, dropped or repaired records) the original
 * raw string is first copied to a backup key so nothing is silently lost.
 *
 * The backend is injected, so all of this is testable without a browser.
 */

import { STORAGE_KEYS, STORAGE_VERSION } from '../config/constants.js'
import { DEFAULT_PREFERENCES, normalizePreferences } from '../domain/preferences.js'
import { generateId, normalizeTasks } from '../domain/task.js'

export const LOAD_STATUS = Object.freeze({
  /** Data loaded exactly as stored. */
  OK: 'ok',
  /** Nothing stored yet. */
  EMPTY: 'empty',
  /** Data loaded, but some records were dropped or repaired (original backed up). */
  REPAIRED: 'repaired',
  /** Data could not be parsed at all (original backed up); starting empty. */
  CORRUPT: 'corrupt',
  /** Data was written by a newer app version; left untouched and saving is disabled. */
  UNSUPPORTED_VERSION: 'unsupported-version',
  /** Storage cannot be accessed (disabled, blocked or missing). */
  UNAVAILABLE: 'unavailable',
})

export const SAVE_ERROR = Object.freeze({
  UNAVAILABLE: 'unavailable',
  QUOTA_EXCEEDED: 'quota-exceeded',
  /** Saving was disabled to protect stored data that could not be backed up or understood. */
  READ_ONLY: 'read-only',
  WRITE_FAILED: 'write-failed',
})

export const BACKUP_KEY_PREFIX = `${STORAGE_KEYS.TASKS}:backup:`

/**
 * Returns `globalObject.localStorage` if it can be read, otherwise null.
 * Accessing the property itself throws in some privacy modes and sandboxed
 * iframes. A failed probe *write* is deliberately not treated as unavailable:
 * a full quota must not hide data that is already stored.
 */
export function resolveBrowserStorage(globalObject = globalThis) {
  try {
    const storage = globalObject?.localStorage
    if (!storage || typeof storage.getItem !== 'function') return null
    storage.getItem(STORAGE_KEYS.TASKS)
    return storage
  } catch {
    return null
  }
}

/** Recognizes quota errors across browsers (standard name, legacy codes, Firefox). */
export function isQuotaExceededError(error) {
  if (!error || typeof error !== 'object') return false
  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  )
}

/** Writes one item, translating exceptions into a save result. */
function writeItem(backend, key, value) {
  try {
    backend.setItem(key, value)
    return { ok: true, reason: null, error: null }
  } catch (error) {
    const reason = isQuotaExceededError(error) ? SAVE_ERROR.QUOTA_EXCEEDED : SAVE_ERROR.WRITE_FAILED
    return { ok: false, reason, error }
  }
}

/**
 * Calls `onChange` when another tab changes `key` (or clears storage).
 * Returns an unsubscribe function; a no-op when events are unsupported.
 */
function subscribeToKey(eventTarget, backend, key, onChange) {
  if (!backend || typeof eventTarget?.addEventListener !== 'function') return () => {}
  const handleStorage = (event) => {
    if (event.key !== key && event.key !== null) return
    if (event.storageArea && event.storageArea !== backend) return
    onChange()
  }
  eventTarget.addEventListener('storage', handleStorage)
  return () => eventTarget.removeEventListener('storage', handleStorage)
}

function parseResult(status, { tasks = [], droppedCount = 0, repairedCount = 0, error = null } = {}) {
  return { status, tasks, droppedCount, repairedCount, error }
}

/**
 * Parses and validates a raw stored string. Pure: performs no I/O.
 * An unversioned bare array (pre-envelope format) is accepted and migrated.
 *
 * @returns {{ status: string, tasks: object[], droppedCount: number, repairedCount: number, error: Error | null }}
 */
export function parseStoredTasks(raw, { now = new Date(), generate = generateId } = {}) {
  if (raw === null || raw === undefined) return parseResult(LOAD_STATUS.EMPTY)

  let data
  try {
    data = JSON.parse(raw)
  } catch (error) {
    return parseResult(LOAD_STATUS.CORRUPT, { error })
  }

  let records
  let isLegacy = false
  if (Array.isArray(data)) {
    records = data
    isLegacy = true
  } else if (data !== null && typeof data === 'object') {
    const { version } = data
    if (!Number.isInteger(version) || version < 1) {
      return parseResult(LOAD_STATUS.CORRUPT, { error: new Error('Missing or invalid storage version') })
    }
    if (version > STORAGE_VERSION) {
      return parseResult(LOAD_STATUS.UNSUPPORTED_VERSION, {
        error: new Error(`Storage version ${version} is newer than supported version ${STORAGE_VERSION}`),
      })
    }
    if (!Array.isArray(data.tasks)) {
      return parseResult(LOAD_STATUS.CORRUPT, { error: new Error('Stored tasks are not a list') })
    }
    records = data.tasks
  } else {
    return parseResult(LOAD_STATUS.CORRUPT, { error: new Error('Stored data has an unexpected shape') })
  }

  const { tasks, droppedCount, repairedCount } = normalizeTasks(records, { now, generate })
  const changed = isLegacy || droppedCount > 0 || repairedCount > 0
  return parseResult(changed ? LOAD_STATUS.REPAIRED : LOAD_STATUS.OK, { tasks, droppedCount, repairedCount })
}

/**
 * Creates a task store over a Storage-like backend (`getItem`/`setItem`).
 * Pass `null` to model unavailable storage.
 *
 * @param {Storage | null | undefined} storage
 * @param {{ clock?: () => Date, generate?: () => string, eventTarget?: EventTarget }} [options]
 *   `eventTarget` receives cross-tab `storage` events (the window in browsers).
 */
export function createTaskStorage(
  storage,
  { clock = () => new Date(), generate = generateId, eventTarget = globalThis.window } = {},
) {
  const backend = storage ?? null
  // Set when stored data must not be overwritten (see SAVE_ERROR.READ_ONLY).
  let readOnlyReason = null

  function writeBackup(raw) {
    const base = `${BACKUP_KEY_PREFIX}${clock().toISOString()}`
    try {
      let key = base
      for (let suffix = 1; backend.getItem(key) !== null; suffix += 1) key = `${base}-${suffix}`
      backend.setItem(key, raw)
      return { key, error: null }
    } catch (error) {
      return { key: null, error }
    }
  }

  /**
   * Loads tasks. Never throws.
   *
   * @returns {{
   *   status: string, tasks: object[], droppedCount: number, repairedCount: number,
   *   backupKey: string | null, writable: boolean, error: Error | null
   * }}
   *   `writable` is false when saving would destroy data the app could not
   *   preserve; `saveTasks` then refuses until a later load clears it.
   */
  function loadTasks() {
    readOnlyReason = null
    if (!backend) {
      return { ...parseResult(LOAD_STATUS.UNAVAILABLE), backupKey: null, writable: false }
    }

    let raw
    try {
      raw = backend.getItem(STORAGE_KEYS.TASKS)
    } catch (error) {
      return { ...parseResult(LOAD_STATUS.UNAVAILABLE, { error }), backupKey: null, writable: false }
    }

    const parsed = parseStoredTasks(raw, { now: clock(), generate })
    let backupKey = null
    let error = parsed.error

    if (parsed.status === LOAD_STATUS.UNSUPPORTED_VERSION) {
      readOnlyReason = parsed.status
    } else if (parsed.status === LOAD_STATUS.CORRUPT || parsed.status === LOAD_STATUS.REPAIRED) {
      const backup = writeBackup(raw)
      backupKey = backup.key
      if (backup.error) {
        // Without a backup, the next save would erase the only copy.
        readOnlyReason = 'backup-failed'
        error = backup.error
      }
    }

    return { ...parsed, error, backupKey, writable: readOnlyReason === null }
  }

  /**
   * Persists the full task list. Never throws for storage failures.
   * @returns {{ ok: boolean, reason: string | null, error: Error | null }}
   */
  function saveTasks(tasks) {
    if (!Array.isArray(tasks)) throw new TypeError('saveTasks expects an array of tasks')
    if (!backend) return { ok: false, reason: SAVE_ERROR.UNAVAILABLE, error: null }
    if (readOnlyReason) return { ok: false, reason: SAVE_ERROR.READ_ONLY, error: null }

    return writeItem(backend, STORAGE_KEYS.TASKS, JSON.stringify({ version: STORAGE_VERSION, tasks }))
  }

  return {
    isAvailable: () => backend !== null,
    loadTasks,
    saveTasks,
    /** Notifies `onChange` when another tab modifies the stored tasks. */
    subscribe: (onChange) => subscribeToKey(eventTarget, backend, STORAGE_KEYS.TASKS, onChange),
  }
}

/**
 * Creates a preferences store. Preferences are non-critical: unreadable data
 * falls back to defaults without backups.
 *
 * @param {Storage | null | undefined} storage
 * @param {{ eventTarget?: EventTarget }} [options] receives cross-tab `storage` events.
 */
export function createPreferenceStorage(storage, { eventTarget = globalThis.window } = {}) {
  const backend = storage ?? null

  /** @returns {{ preferences: object, error: Error | null }} Never throws. */
  function loadPreferences() {
    if (!backend) return { preferences: { ...DEFAULT_PREFERENCES }, error: null }
    try {
      const raw = backend.getItem(STORAGE_KEYS.PREFERENCES)
      return { preferences: normalizePreferences(raw === null ? null : JSON.parse(raw)), error: null }
    } catch (error) {
      return { preferences: { ...DEFAULT_PREFERENCES }, error }
    }
  }

  /** @returns {{ ok: boolean, reason: string | null, error: Error | null }} Never throws. */
  function savePreferences(preferences) {
    if (!backend) return { ok: false, reason: SAVE_ERROR.UNAVAILABLE, error: null }
    return writeItem(backend, STORAGE_KEYS.PREFERENCES, JSON.stringify(normalizePreferences(preferences)))
  }

  return {
    loadPreferences,
    savePreferences,
    /** Notifies `onChange` when another tab modifies the stored preferences. */
    subscribe: (onChange) => subscribeToKey(eventTarget, backend, STORAGE_KEYS.PREFERENCES, onChange),
  }
}
