import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, DEFAULT_SORT } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import {
  filterTasks,
  hasActiveCriteria,
  resolveSort,
  searchTasks,
  selectVisibleTasks,
  sortTasks,
  toSearchTerms,
} from './selectors.js'

const NOW = new Date(2026, 9, 8, 12) // local 2026-10-08 noon
const ids = (tasks) => tasks.map((task) => task.id)

const TASKS = [
  buildTask({ id: 'report', title: 'Write quarterly report', description: 'Include Q3 numbers', priority: 'high', category: 'work', dueDate: '2026-10-07', createdAt: '2026-10-01T09:00:00.000Z' }),
  buildTask({ id: 'milk', title: 'Buy oat milk', priority: 'low', category: 'shopping', dueDate: '2026-10-08', createdAt: '2026-10-02T09:00:00.000Z' }),
  buildTask({ id: 'dentist', title: 'Dentist appointment', description: 'Call the clinic', priority: 'medium', category: 'health', dueDate: '2026-10-20', createdAt: '2026-10-03T09:00:00.000Z' }),
  buildTask({ id: 'cafe', title: 'Meet at Café Lumière', priority: 'medium', category: 'personal', dueDate: null, createdAt: '2026-10-04T09:00:00.000Z' }),
  buildTask({ id: 'taxes', title: 'File taxes', priority: 'high', category: 'personal', dueDate: '2026-09-30', completed: true, completedAt: '2026-09-29T09:00:00.000Z', createdAt: '2026-09-20T09:00:00.000Z' }),
]

describe('toSearchTerms', () => {
  it('splits, lower-cases and drops empty terms', () => {
    expect(toSearchTerms('  Buy   MILK ')).toEqual(['buy', 'milk'])
  })

  it.each(['', '   ', null, undefined, 42])('returns no terms for %p', (query) => {
    expect(toSearchTerms(query)).toEqual([])
  })
})

describe('searchTasks', () => {
  it('returns a copy of all tasks for an empty or whitespace query', () => {
    for (const query of ['', '   ', undefined]) {
      const result = searchTasks(TASKS, query)
      expect(result).toEqual(TASKS)
      expect(result).not.toBe(TASKS)
    }
  })

  it('is case-insensitive', () => {
    expect(ids(searchTasks(TASKS, 'REPORT'))).toEqual(['report'])
  })

  it('matches descriptions as well as titles', () => {
    expect(ids(searchTasks(TASKS, 'clinic'))).toEqual(['dentist'])
  })

  it('matches partial words', () => {
    expect(ids(searchTasks(TASKS, 'dent'))).toEqual(['dentist'])
  })

  it('requires every term to match, in any order and across fields', () => {
    expect(ids(searchTasks(TASKS, 'milk buy'))).toEqual(['milk'])
    expect(ids(searchTasks(TASKS, 'quarterly Q3'))).toEqual(['report'])
    expect(searchTasks(TASKS, 'milk dentist')).toEqual([])
  })

  it('ignores accents in both query and task text', () => {
    expect(ids(searchTasks(TASKS, 'cafe lumiere'))).toEqual(['cafe'])
    expect(ids(searchTasks(TASKS, 'CAFÉ'))).toEqual(['cafe'])
  })

  it('treats regex characters literally', () => {
    expect(searchTasks(TASKS, '.*')).toEqual([])
  })

  it('handles an empty task list', () => {
    expect(searchTasks([], 'anything')).toEqual([])
  })
})

describe('filterTasks', () => {
  const filter = (filters) => ids(filterTasks(TASKS, filters, { now: NOW }))

  it('returns everything with default or missing filters', () => {
    expect(filter(DEFAULT_FILTERS)).toEqual(ids(TASKS))
    expect(filter(undefined)).toEqual(ids(TASKS))
    expect(filter({})).toEqual(ids(TASKS))
  })

  it('filters by status', () => {
    expect(filter({ status: 'active' })).toEqual(['report', 'milk', 'dentist', 'cafe'])
    expect(filter({ status: 'completed' })).toEqual(['taxes'])
  })

  it('filters by priority and category', () => {
    expect(filter({ priority: 'high' })).toEqual(['report', 'taxes'])
    expect(filter({ category: 'personal' })).toEqual(['cafe', 'taxes'])
  })

  it('filters by due-date condition', () => {
    expect(filter({ due: 'overdue' })).toEqual(['report']) // completed past-due task excluded
    expect(filter({ due: 'today' })).toEqual(['milk'])
    expect(filter({ due: 'upcoming' })).toEqual(['dentist'])
    expect(filter({ due: 'none' })).toEqual(['cafe'])
  })

  it('combines criteria with AND', () => {
    expect(filter({ status: 'active', category: 'personal' })).toEqual(['cafe'])
    expect(filter({ priority: 'high', due: 'overdue' })).toEqual(['report'])
    expect(filter({ priority: 'low', category: 'work' })).toEqual([])
  })

  it('treats null/undefined criteria as "all" and unknown values as matching nothing', () => {
    expect(filter({ priority: null, category: undefined })).toEqual(ids(TASKS))
    expect(filter({ priority: 'urgent' })).toEqual([])
  })

  it('ignores an unknown status or due filter', () => {
    expect(filter({ status: 'archived', due: 'someday' })).toEqual(ids(TASKS))
  })

  it('does not mutate the input', () => {
    const copy = [...TASKS]
    filterTasks(TASKS, { status: 'completed' }, { now: NOW })
    expect(TASKS).toEqual(copy)
  })
})

describe('hasActiveCriteria', () => {
  it('is false for defaults and blank queries', () => {
    expect(hasActiveCriteria()).toBe(false)
    expect(hasActiveCriteria(DEFAULT_FILTERS, '   ')).toBe(false)
  })

  it('is true when a filter or search is set', () => {
    expect(hasActiveCriteria({ category: 'work' })).toBe(true)
    expect(hasActiveCriteria(DEFAULT_FILTERS, 'milk')).toBe(true)
  })
})

describe('resolveSort', () => {
  it('keeps valid options', () => {
    expect(resolveSort({ field: 'title', direction: 'asc' })).toEqual({ field: 'title', direction: 'asc' })
  })

  it('falls back to defaults for invalid options', () => {
    expect(resolveSort({ field: 'color', direction: 'sideways' })).toEqual(DEFAULT_SORT)
    expect(resolveSort(undefined)).toEqual(DEFAULT_SORT)
    expect(resolveSort({ field: 'toString' })).toEqual(DEFAULT_SORT)
  })
})

describe('sortTasks', () => {
  it('sorts by creation date, newest first, by default', () => {
    expect(ids(sortTasks(TASKS))).toEqual(['cafe', 'dentist', 'milk', 'report', 'taxes'])
  })

  it('sorts by due date ascending with undated tasks last', () => {
    expect(ids(sortTasks(TASKS, { field: 'dueDate', direction: 'asc' }))).toEqual([
      'taxes',
      'report',
      'milk',
      'dentist',
      'cafe',
    ])
  })

  it('keeps undated tasks last when sorting by due date descending', () => {
    expect(ids(sortTasks(TASKS, { field: 'dueDate', direction: 'desc' }))).toEqual([
      'dentist',
      'milk',
      'report',
      'taxes',
      'cafe',
    ])
  })

  it('sorts by priority rank, not alphabetically', () => {
    const result = ids(sortTasks(TASKS, { field: 'priority', direction: 'desc' }))
    // high (report, taxes) → medium (cafe, dentist) → low; ties newest first
    expect(result).toEqual(['report', 'taxes', 'cafe', 'dentist', 'milk'])
  })

  it('sorts titles case-insensitively with natural number ordering', () => {
    const tasks = [
      buildTask({ id: '1', title: 'item 10' }),
      buildTask({ id: '2', title: 'Item 2' }),
      buildTask({ id: '3', title: 'apple' }),
    ]
    expect(ids(sortTasks(tasks, { field: 'title', direction: 'asc' }))).toEqual(['3', '2', '1'])
    expect(ids(sortTasks(tasks, { field: 'title', direction: 'desc' }))).toEqual(['1', '2', '3'])
  })

  it('sorts by updatedAt', () => {
    const tasks = [
      buildTask({ id: 'old', updatedAt: '2026-10-01T00:00:00.000Z' }),
      buildTask({ id: 'new', updatedAt: '2026-10-05T00:00:00.000Z' }),
    ]
    expect(ids(sortTasks(tasks, { field: 'updatedAt', direction: 'desc' }))).toEqual(['new', 'old'])
  })

  it('breaks ties deterministically (newest first, then id) regardless of direction or input order', () => {
    const tasks = [
      buildTask({ id: 'b', priority: 'high', createdAt: '2026-10-01T00:00:00.000Z' }),
      buildTask({ id: 'a', priority: 'high', createdAt: '2026-10-01T00:00:00.000Z' }),
      buildTask({ id: 'c', priority: 'high', createdAt: '2026-10-02T00:00:00.000Z' }),
    ]
    const expected = ['c', 'a', 'b']
    for (const direction of ['asc', 'desc']) {
      expect(ids(sortTasks(tasks, { field: 'priority', direction }))).toEqual(expected)
      expect(ids(sortTasks([...tasks].reverse(), { field: 'priority', direction }))).toEqual(expected)
    }
  })

  it('orders multiple undated tasks by the tie-breakers', () => {
    const tasks = [
      buildTask({ id: 'x', dueDate: null, createdAt: '2026-10-01T00:00:00.000Z' }),
      buildTask({ id: 'y', dueDate: null, createdAt: '2026-10-03T00:00:00.000Z' }),
      buildTask({ id: 'z', dueDate: '2026-12-01' }),
    ]
    expect(ids(sortTasks(tasks, { field: 'dueDate', direction: 'asc' }))).toEqual(['z', 'y', 'x'])
  })

  it('falls back to the default sort for an invalid option', () => {
    expect(ids(sortTasks(TASKS, { field: 'bogus' }))).toEqual(ids(sortTasks(TASKS, DEFAULT_SORT)))
  })

  it('returns a new array and never mutates the input', () => {
    const copy = [...TASKS]
    const result = sortTasks(TASKS, { field: 'title', direction: 'asc' })
    expect(result).not.toBe(TASKS)
    expect(TASKS).toEqual(copy)
  })

  it('handles empty and single-item lists', () => {
    expect(sortTasks([])).toEqual([])
    expect(ids(sortTasks([TASKS[0]]))).toEqual(['report'])
  })
})

describe('selectVisibleTasks', () => {
  it('applies search, filters and sort together', () => {
    const result = selectVisibleTasks(
      TASKS,
      { query: 'e', filters: { status: 'active' }, sort: { field: 'dueDate', direction: 'asc' } },
      { now: NOW },
    )
    // "e" matches every title except "Buy oat milk"; the status filter then drops "taxes"
    expect(ids(result)).toEqual(['report', 'dentist', 'cafe'])
  })

  it('works with no options', () => {
    expect(selectVisibleTasks(TASKS)).toHaveLength(TASKS.length)
  })

  it('returns an empty list when nothing matches', () => {
    expect(selectVisibleTasks(TASKS, { query: 'zzz' }, { now: NOW })).toEqual([])
  })
})

describe('Phase 4 additions', () => {
  describe('due "soon" filter', () => {
    const tasks = [
      buildTask({ id: 'late', dueDate: '2026-10-07' }),
      buildTask({ id: 'today', dueDate: '2026-10-08' }),
      buildTask({ id: 'plus3', dueDate: '2026-10-11' }), // boundary: DUE_SOON_DAYS away
      buildTask({ id: 'plus4', dueDate: '2026-10-12' }),
      buildTask({ id: 'none', dueDate: null }),
      buildTask({ id: 'done', dueDate: '2026-10-09', completed: true }),
    ]

    it('matches active tasks due today through the next DUE_SOON_DAYS days', () => {
      expect(ids(filterTasks(tasks, { due: 'soon' }, { now: NOW }))).toEqual(['today', 'plus3'])
    })

    it('combines with other filters and search', () => {
      const mixed = [
        buildTask({ id: 'a', title: 'Call bank', priority: 'high', dueDate: '2026-10-09' }),
        buildTask({ id: 'b', title: 'Call mum', priority: 'low', dueDate: '2026-10-09' }),
        buildTask({ id: 'c', title: 'Email bank', priority: 'high', dueDate: '2026-10-30' }),
      ]
      expect(
        ids(selectVisibleTasks(mixed, { query: 'call', filters: { due: 'soon', priority: 'high' } }, { now: NOW })),
      ).toEqual(['a'])
    })
  })

  describe('status sort', () => {
    const tasks = [
      buildTask({ id: 'done-old', completed: true, createdAt: '2026-10-01T00:00:00.000Z' }),
      buildTask({ id: 'active-old', createdAt: '2026-10-02T00:00:00.000Z' }),
      buildTask({ id: 'done-new', completed: true, createdAt: '2026-10-03T00:00:00.000Z' }),
      buildTask({ id: 'active-new', createdAt: '2026-10-04T00:00:00.000Z' }),
    ]

    it('puts active tasks first ascending, newest first within each group', () => {
      expect(ids(sortTasks(tasks, { field: 'status', direction: 'asc' }))).toEqual([
        'active-new',
        'active-old',
        'done-new',
        'done-old',
      ])
    })

    it('puts completed tasks first descending, keeping the same tie-breakers', () => {
      expect(ids(sortTasks(tasks, { field: 'status', direction: 'desc' }))).toEqual([
        'done-new',
        'done-old',
        'active-new',
        'active-old',
      ])
    })

    it('is accepted by resolveSort', () => {
      expect(resolveSort({ field: 'status', direction: 'asc' })).toEqual({ field: 'status', direction: 'asc' })
    })
  })

  it('treats ascending and descending due-date sorts as mirror images apart from undated tasks', () => {
    const tasks = [
      buildTask({ id: 'x', dueDate: '2026-10-20' }),
      buildTask({ id: 'none-1', dueDate: null, createdAt: '2026-10-01T00:00:00.000Z' }),
      buildTask({ id: 'y', dueDate: '2026-10-10' }),
      buildTask({ id: 'none-2', dueDate: null, createdAt: '2026-10-02T00:00:00.000Z' }),
    ]
    expect(ids(sortTasks(tasks, { field: 'dueDate', direction: 'asc' }))).toEqual(['y', 'x', 'none-2', 'none-1'])
    expect(ids(sortTasks(tasks, { field: 'dueDate', direction: 'desc' }))).toEqual(['x', 'y', 'none-2', 'none-1'])
  })
})
