import { describe, expect, it } from 'vitest'
import { DEFAULT_FILTERS, DEFAULT_SORT } from '../config/constants.js'
import { VIEW_ACTIONS, initialTaskView, isDefaultSort, taskViewReducer } from './taskViewReducer.js'

const reduce = (...actions) => actions.reduce(taskViewReducer, initialTaskView)

describe('taskViewReducer', () => {
  it('starts with an empty query, no filters and the default sort', () => {
    expect(initialTaskView).toEqual({ query: '', filters: DEFAULT_FILTERS, sort: DEFAULT_SORT })
  })

  it('stores the raw query (trimming happens in the selector)', () => {
    expect(reduce({ type: VIEW_ACTIONS.QUERY_CHANGED, query: '  milk ' }).query).toBe('  milk ')
  })

  it('updates one filter at a time and keeps the others', () => {
    const state = reduce(
      { type: VIEW_ACTIONS.FILTER_CHANGED, name: 'priority', value: 'high' },
      { type: VIEW_ACTIONS.FILTER_CHANGED, name: 'status', value: 'active' },
    )
    expect(state.filters).toEqual({ ...DEFAULT_FILTERS, priority: 'high', status: 'active' })
  })

  it('ignores unknown filter names', () => {
    expect(reduce({ type: VIEW_ACTIONS.FILTER_CHANGED, name: 'color', value: 'red' })).toBe(initialTaskView)
  })

  it('applies the natural direction when the sort field changes', () => {
    expect(reduce({ type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'dueDate' }).sort).toEqual({ field: 'dueDate', direction: 'asc' })
    expect(reduce({ type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'priority' }).sort).toEqual({ field: 'priority', direction: 'desc' })
    expect(reduce({ type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'title' }).sort).toEqual({ field: 'title', direction: 'asc' })
  })

  it('keeps the chosen direction when the same field is picked again', () => {
    const state = reduce(
      { type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'title' },
      { type: VIEW_ACTIONS.SORT_DIRECTION_CHANGED, direction: 'desc' },
      { type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'title' },
    )
    expect(state.sort).toEqual({ field: 'title', direction: 'desc' })
  })

  it('ignores unknown sort fields and directions', () => {
    expect(reduce({ type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'color' })).toBe(initialTaskView)
    expect(reduce({ type: VIEW_ACTIONS.SORT_DIRECTION_CHANGED, direction: 'sideways' })).toBe(initialTaskView)
  })

  it('returns the same state when nothing changes', () => {
    expect(reduce({ type: VIEW_ACTIONS.QUERY_CHANGED, query: '' })).toBe(initialTaskView)
    expect(reduce({ type: VIEW_ACTIONS.FILTER_CHANGED, name: 'status', value: 'all' })).toBe(initialTaskView)
  })

  it('clearing criteria resets search and filters but keeps the sort', () => {
    const state = reduce(
      { type: VIEW_ACTIONS.QUERY_CHANGED, query: 'report' },
      { type: VIEW_ACTIONS.FILTER_CHANGED, name: 'category', value: 'work' },
      { type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'title' },
      { type: VIEW_ACTIONS.CRITERIA_CLEARED },
    )
    expect(state).toEqual({ query: '', filters: DEFAULT_FILTERS, sort: { field: 'title', direction: 'asc' } })
  })

  it('reset restores everything, including the sort', () => {
    const state = reduce(
      { type: VIEW_ACTIONS.QUERY_CHANGED, query: 'report' },
      { type: VIEW_ACTIONS.SORT_FIELD_CHANGED, field: 'title' },
      { type: VIEW_ACTIONS.RESET },
    )
    expect(state).toBe(initialTaskView)
  })

  it('throws on unknown actions', () => {
    expect(() => taskViewReducer(initialTaskView, { type: 'nope' })).toThrow('Unknown view action: nope')
  })
})

describe('isDefaultSort', () => {
  it('is true only for the default field and direction', () => {
    expect(isDefaultSort(DEFAULT_SORT)).toBe(true)
    expect(isDefaultSort({ field: DEFAULT_SORT.field, direction: 'asc' })).toBe(false)
    expect(isDefaultSort({ field: 'title', direction: DEFAULT_SORT.direction })).toBe(false)
  })
})
