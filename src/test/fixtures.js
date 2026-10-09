/** A fully valid stored task; override any field per test. */
export function buildTask(overrides = {}) {
  return {
    id: 'task-1',
    title: 'Write report',
    description: '',
    priority: 'medium',
    category: 'work',
    dueDate: null,
    completed: false,
    completedAt: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  }
}

/**
 * Runs `fn` with the process timezone set to `timeZone`, restoring the
 * original afterwards. Node re-reads TZ when process.env.TZ is assigned.
 */
export function withTimezone(timeZone, fn) {
  const original = process.env.TZ
  process.env.TZ = timeZone
  try {
    return fn()
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
}
