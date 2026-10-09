import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CATEGORY, DEFAULT_PRIORITY, TASK_LIMITS } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import {
  TaskValidationError,
  createTask,
  generateId,
  normalizeTask,
  normalizeTasks,
  setTaskCompleted,
  toggleTaskCompleted,
  updateTask,
  validateTaskInput,
} from './task.js'

const NOW = new Date('2026-10-08T10:00:00.000Z')
const LATER = new Date('2026-10-09T15:30:00.000Z')
const { titleMaxLength: TITLE_MAX, descriptionMaxLength: DESCRIPTION_MAX } = TASK_LIMITS

describe('generateId', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(generateId({ randomUUID: () => 'uuid-1' })).toBe('uuid-1')
  })

  it('falls back to getRandomValues and produces 32 hex characters', () => {
    const id = generateId({ getRandomValues: (bytes) => bytes.fill(171) })
    expect(id).toBe('ab'.repeat(16))
  })

  it('still produces an id without any crypto support', () => {
    expect(generateId(null)).toMatch(/^[0-9a-f]{32}$/)
  })

  it('produces unique ids by default', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()))
    expect(ids.size).toBe(200)
  })
})

describe('validateTaskInput', () => {
  describe('title', () => {
    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['whitespace-only', '   \t\n '],
      ['non-string', 42],
      ['null', null],
    ])('is required (%s)', (_label, title) => {
      const result = validateTaskInput({ title })
      expect(result.isValid).toBe(false)
      expect(result.errors.title).toBe('Title is required.')
      expect(result.values).not.toHaveProperty('title')
    })

    it('is trimmed', () => {
      expect(validateTaskInput({ title: '  Buy milk  ' }).values.title).toBe('Buy milk')
    })

    it('accepts exactly the maximum length', () => {
      const result = validateTaskInput({ title: 'a'.repeat(TITLE_MAX) })
      expect(result.isValid).toBe(true)
    })

    it('rejects one character over the maximum', () => {
      const result = validateTaskInput({ title: 'a'.repeat(TITLE_MAX + 1) })
      expect(result.errors.title).toBe(`Title must be ${TITLE_MAX} characters or fewer.`)
    })

    it('measures length after trimming', () => {
      expect(validateTaskInput({ title: `  ${'a'.repeat(TITLE_MAX)}  ` }).isValid).toBe(true)
    })
  })

  describe('description', () => {
    it('defaults to an empty string when blank', () => {
      for (const description of [undefined, null, '']) {
        expect(validateTaskInput({ title: 'T', description }).values.description).toBe('')
      }
    })

    it('trims outer whitespace but keeps inner line breaks', () => {
      const result = validateTaskInput({ title: 'T', description: '  line 1\nline 2  ' })
      expect(result.values.description).toBe('line 1\nline 2')
    })

    it('accepts exactly the maximum length and rejects one more', () => {
      expect(validateTaskInput({ title: 'T', description: 'd'.repeat(DESCRIPTION_MAX) }).isValid).toBe(true)
      const result = validateTaskInput({ title: 'T', description: 'd'.repeat(DESCRIPTION_MAX + 1) })
      expect(result.errors.description).toBe(`Description must be ${DESCRIPTION_MAX} characters or fewer.`)
    })

    it('rejects non-string values', () => {
      expect(validateTaskInput({ title: 'T', description: { text: 'x' } }).errors.description).toBe(
        'Description must be text.',
      )
    })
  })

  describe('priority and category', () => {
    it('apply defaults when blank', () => {
      const { values } = validateTaskInput({ title: 'T' })
      expect(values.priority).toBe(DEFAULT_PRIORITY)
      expect(values.category).toBe(DEFAULT_CATEGORY)
    })

    it('accept configured values', () => {
      const { values, isValid } = validateTaskInput({ title: 'T', priority: 'high', category: 'health' })
      expect(isValid).toBe(true)
      expect(values).toMatchObject({ priority: 'high', category: 'health' })
    })

    it.each(['urgent', 'HIGH', ' high', 3, true])('reject invalid priority %p', (priority) => {
      expect(validateTaskInput({ title: 'T', priority }).errors.priority).toBe('Choose a valid priority.')
    })

    it.each(['hobbies', 'Work', 0, ['work']])('reject invalid category %p', (category) => {
      expect(validateTaskInput({ title: 'T', category }).errors.category).toBe('Choose a valid category.')
    })
  })

  describe('dueDate', () => {
    it('is optional', () => {
      for (const dueDate of [undefined, null, '']) {
        expect(validateTaskInput({ title: 'T', dueDate }).values.dueDate).toBeNull()
      }
    })

    it('accepts a valid date key, including past dates', () => {
      expect(validateTaskInput({ title: 'T', dueDate: '2020-01-01' }).values.dueDate).toBe('2020-01-01')
    })

    it.each(['2026-02-30', '10/08/2026', '2026-10-08T00:00:00Z', 20261008])('rejects %p', (dueDate) => {
      expect(validateTaskInput({ title: 'T', dueDate }).errors.dueDate).toBe('Enter a valid date.')
    })
  })

  it('reports every invalid field at once', () => {
    const result = validateTaskInput({ title: ' ', priority: 'x', category: 'y', dueDate: 'z' })
    expect(Object.keys(result.errors).sort()).toEqual(['category', 'dueDate', 'priority', 'title'])
  })

  it('ignores unknown fields such as id or completed', () => {
    const { values } = validateTaskInput({ title: 'T', id: 'hack', completed: true, extra: 1 })
    expect(Object.keys(values).sort()).toEqual(['category', 'description', 'dueDate', 'priority', 'title'])
  })

  it.each([null, undefined, 'title', 42, []])('handles non-object input %p', (input) => {
    expect(validateTaskInput(input)).toMatchObject({ isValid: false, errors: { title: 'Title is required.' } })
  })
})

describe('createTask', () => {
  it('builds a complete active task with timestamps and the given id', () => {
    const task = createTask(
      { title: ' Plan sprint ', description: 'Agenda', priority: 'high', category: 'work', dueDate: '2026-10-10' },
      { now: NOW, id: 'id-1' },
    )
    expect(task).toEqual({
      id: 'id-1',
      title: 'Plan sprint',
      description: 'Agenda',
      priority: 'high',
      category: 'work',
      dueDate: '2026-10-10',
      completed: false,
      completedAt: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
  })

  it('generates an id when none is given', () => {
    const task = createTask({ title: 'T' }, { now: NOW })
    expect(typeof task.id).toBe('string')
    expect(task.id.length).toBeGreaterThan(0)
  })

  it('throws a TaskValidationError carrying field errors', () => {
    expect.assertions(3)
    try {
      createTask({ title: '' }, { now: NOW })
    } catch (error) {
      expect(error).toBeInstanceOf(TaskValidationError)
      expect(error.name).toBe('TaskValidationError')
      expect(error.errors).toEqual({ title: 'Title is required.' })
    }
  })

  it('rejects an invalid clock', () => {
    expect(() => createTask({ title: 'T' }, { now: new Date('bad') })).toThrow(TypeError)
  })

  it('uses the current time by default', () => {
    vi.useFakeTimers({ now: NOW })
    try {
      expect(createTask({ title: 'T' }).createdAt).toBe(NOW.toISOString())
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('updateTask', () => {
  const task = buildTask({ title: 'Old', priority: 'low', dueDate: '2026-10-10' })

  it('changes only the given fields and bumps updatedAt', () => {
    const updated = updateTask(task, { title: ' New ', priority: 'high' }, { now: LATER })
    expect(updated).toEqual({
      ...task,
      title: 'New',
      priority: 'high',
      updatedAt: LATER.toISOString(),
    })
  })

  it('clears a due date when given an empty value', () => {
    expect(updateTask(task, { dueDate: '' }, { now: LATER }).dueDate).toBeNull()
  })

  it('does not let edits change identity, completion or creation time', () => {
    const updated = updateTask(
      task,
      { id: 'other', completed: true, completedAt: 'x', createdAt: '2000-01-01T00:00:00.000Z' },
      { now: LATER },
    )
    expect(updated.id).toBe(task.id)
    expect(updated.completed).toBe(false)
    expect(updated.completedAt).toBeNull()
    expect(updated.createdAt).toBe(task.createdAt)
  })

  it('throws on invalid changes and leaves the original untouched', () => {
    expect(() => updateTask(task, { title: '   ' }, { now: LATER })).toThrow(TaskValidationError)
    expect(task.title).toBe('Old')
  })

  it('does not mutate the input task', () => {
    const snapshot = structuredClone(task)
    updateTask(task, { title: 'Changed' }, { now: LATER })
    expect(task).toEqual(snapshot)
  })
})

describe('setTaskCompleted / toggleTaskCompleted', () => {
  it('sets completedAt and updatedAt when completing', () => {
    const done = setTaskCompleted(buildTask(), true, { now: LATER })
    expect(done).toMatchObject({ completed: true, completedAt: LATER.toISOString(), updatedAt: LATER.toISOString() })
  })

  it('clears completedAt when reopening', () => {
    const reopened = setTaskCompleted(
      buildTask({ completed: true, completedAt: NOW.toISOString() }),
      false,
      { now: LATER },
    )
    expect(reopened).toMatchObject({ completed: false, completedAt: null, updatedAt: LATER.toISOString() })
  })

  it('returns the same object when the state does not change', () => {
    const task = buildTask()
    expect(setTaskCompleted(task, false, { now: LATER })).toBe(task)
  })

  it('toggles back and forth', () => {
    const task = buildTask()
    const done = toggleTaskCompleted(task, { now: NOW })
    expect(done.completed).toBe(true)
    expect(toggleTaskCompleted(done, { now: LATER }).completed).toBe(false)
  })
})

describe('normalizeTask', () => {
  const options = { now: NOW, generate: () => 'generated-id' }

  it('keeps a valid record unchanged', () => {
    const task = buildTask({ dueDate: '2026-10-10', priority: 'high' })
    expect(normalizeTask(task, options)).toEqual(task)
  })

  it.each([
    ['null', null],
    ['an array', [buildTask()]],
    ['a string', 'task'],
    ['a number', 7],
    ['missing title', { ...buildTask(), title: undefined }],
    ['blank title', buildTask({ title: '   ' })],
    ['non-string title', buildTask({ title: 123 })],
  ])('returns null for %s', (_label, raw) => {
    expect(normalizeTask(raw, options)).toBeNull()
  })

  it('repairs unknown or mis-cased enum values', () => {
    const task = normalizeTask(buildTask({ priority: 'URGENT', category: 'Hobbies' }), options)
    expect(task.priority).toBe(DEFAULT_PRIORITY)
    expect(task.category).toBe(DEFAULT_CATEGORY)
    expect(normalizeTask(buildTask({ priority: ' HIGH ', category: 'Work' }), options)).toMatchObject({
      priority: 'high',
      category: 'work',
    })
  })

  it('truncates over-long text instead of dropping the task', () => {
    const task = normalizeTask(
      buildTask({ title: 'a'.repeat(TITLE_MAX + 50), description: 'd'.repeat(DESCRIPTION_MAX + 50) }),
      options,
    )
    expect(task.title).toHaveLength(TITLE_MAX)
    expect(task.description).toHaveLength(DESCRIPTION_MAX)
  })

  it('handles invalid and legacy due dates', () => {
    expect(normalizeTask(buildTask({ dueDate: '2026-02-30' }), options).dueDate).toBeNull()
    expect(normalizeTask(buildTask({ dueDate: 12345 }), options).dueDate).toBeNull()
    expect(normalizeTask(buildTask({ dueDate: '2026-10-08T00:00:00.000Z' }), options).dueDate).toBe('2026-10-08')
    expect(normalizeTask(buildTask({ dueDate: ' 2026-10-08 ' }), options).dueDate).toBe('2026-10-08')
  })

  it('generates an id when missing and stringifies numeric legacy ids', () => {
    expect(normalizeTask({ ...buildTask(), id: undefined }, options).id).toBe('generated-id')
    expect(normalizeTask(buildTask({ id: '  ' }), options).id).toBe('generated-id')
    expect(normalizeTask(buildTask({ id: 17 }), options).id).toBe('17')
  })

  it('only treats a strict boolean true as completed', () => {
    expect(normalizeTask(buildTask({ completed: 'true' }), options).completed).toBe(false)
    expect(normalizeTask(buildTask({ completed: 1 }), options).completed).toBe(false)
  })

  it('clears completedAt on active tasks and fills it on completed ones', () => {
    expect(normalizeTask(buildTask({ completedAt: NOW.toISOString() }), options).completedAt).toBeNull()
    const updatedAt = '2026-10-05T08:00:00.000Z'
    expect(normalizeTask(buildTask({ completed: true, completedAt: 'garbage', updatedAt }), options).completedAt).toBe(
      updatedAt,
    )
  })

  it('normalizes and defaults timestamps', () => {
    const task = normalizeTask(
      { title: 'Legacy', createdAt: 1759312800000, updatedAt: 'not a date' },
      options,
    )
    expect(task.createdAt).toBe(new Date(1759312800000).toISOString())
    expect(task.updatedAt).toBe(task.createdAt)
    expect(normalizeTask({ title: 'No dates' }, options)).toMatchObject({
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
  })

  it('builds a complete task from a minimal legacy record and drops unknown fields', () => {
    expect(normalizeTask({ title: 'Legacy', done: true, color: 'red' }, options)).toEqual({
      id: 'generated-id',
      title: 'Legacy',
      description: '',
      priority: DEFAULT_PRIORITY,
      category: DEFAULT_CATEGORY,
      dueDate: null,
      completed: false,
      completedAt: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
  })

  it('does not mutate the raw record', () => {
    const raw = buildTask({ title: '  Spaced  ', priority: 'HIGH' })
    const snapshot = structuredClone(raw)
    normalizeTask(raw, options)
    expect(raw).toEqual(snapshot)
  })
})

describe('normalizeTasks', () => {
  it('returns an empty result for non-arrays', () => {
    for (const value of [null, undefined, {}, 'tasks']) {
      expect(normalizeTasks(value, { now: NOW })).toEqual({ tasks: [], droppedCount: 0, repairedCount: 0 })
    }
  })

  it('handles an empty list', () => {
    expect(normalizeTasks([], { now: NOW })).toEqual({ tasks: [], droppedCount: 0, repairedCount: 0 })
  })

  it('drops unsalvageable records, counts repairs and keeps order', () => {
    const result = normalizeTasks(
      [buildTask({ id: 'a' }), null, { title: '' }, buildTask({ id: 'b', priority: 'nope' }), buildTask({ id: 'c' })],
      { now: NOW },
    )
    expect(result.tasks.map((task) => task.id)).toEqual(['a', 'b', 'c'])
    expect(result.droppedCount).toBe(2)
    expect(result.repairedCount).toBe(1)
  })

  it('reassigns duplicate ids instead of dropping data', () => {
    let counter = 0
    const generate = () => `new-${(counter += 1)}`
    const result = normalizeTasks(
      [buildTask({ id: 'dup', title: 'First' }), buildTask({ id: 'dup', title: 'Second' })],
      { now: NOW, generate },
    )
    expect(result.tasks.map((task) => [task.id, task.title])).toEqual([
      ['dup', 'First'],
      ['new-1', 'Second'],
    ])
    expect(result.repairedCount).toBe(1)
  })

  it('counts records with extra fields as repaired', () => {
    expect(normalizeTasks([{ ...buildTask(), legacy: true }], { now: NOW }).repairedCount).toBe(1)
  })
})
