/**
 * In-memory implementation of the Web Storage API for tests, so storage
 * logic never touches real browser data. Individual methods can be replaced
 * with `vi.spyOn` to simulate failures.
 */
export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, String(value))
    },
    removeItem: (key) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    /** Test helper: snapshot of all stored entries. */
    entries: () => Object.fromEntries(data),
  }
}

/** Builds a DOMException-like quota error as thrown by browsers. */
export function createQuotaError(name = 'QuotaExceededError', code = 22) {
  const error = new Error('The quota has been exceeded.')
  error.name = name
  error.code = code
  return error
}
