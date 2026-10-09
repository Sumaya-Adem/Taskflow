import { describe, expect, it } from 'vitest'
import { PRIORITIES } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import { completionPercentage, computeStats, sharePercentage } from './stats.js'

const NOW = new Date(2026, 9, 8, 12) // local 2026-10-08 noon

describe('completionPercentage', () => {
  it('is 0 when there are no tasks or nothing is complete', () => {
    expect(completionPercentage(0, 0)).toBe(0)
    expect(completionPercentage(0, 5)).toBe(0)
  })

  it('is 100 only when everything is complete', () => {
    expect(completionPercentage(4, 4)).toBe(100)
    expect(completionPercentage(199, 200)).toBe(99) // 99.5 would round to 100
  })

  it('never shows 0% once something is complete', () => {
    expect(completionPercentage(1, 300)).toBe(1) // 0.33 would round to 0
  })

  it('rounds to the nearest whole percent otherwise', () => {
    expect(completionPercentage(1, 3)).toBe(33)
    expect(completionPercentage(2, 3)).toBe(67)
    expect(completionPercentage(1, 2)).toBe(50)
  })

  it('guards against invalid input', () => {
    expect(completionPercentage(NaN, 3)).toBe(0)
    expect(completionPercentage(1, -1)).toBe(0)
    expect(completionPercentage(1, Infinity)).toBe(0)
  })
})

describe('computeStats', () => {
  it('returns zeros, including every priority bucket, for an empty list', () => {
    const stats = computeStats([], { now: NOW })
    expect(stats).toEqual({
      total: 0,
      active: 0,
      completed: 0,
      overdue: 0,
      dueToday: 0,
      completionPercentage: 0,
      byPriority: {
        high: { total: 0, active: 0, completed: 0 },
        medium: { total: 0, active: 0, completed: 0 },
        low: { total: 0, active: 0, completed: 0 },
      },
    })
    expect(Object.keys(stats.byPriority)).toEqual(PRIORITIES.map((priority) => priority.value))
  })

  it('counts totals, overdue, due today and priority breakdown', () => {
    const tasks = [
      buildTask({ id: '1', priority: 'high', dueDate: '2026-10-01' }), // overdue
      buildTask({ id: '2', priority: 'high', dueDate: '2026-10-01', completed: true }), // completed: not overdue
      buildTask({ id: '3', priority: 'medium', dueDate: '2026-10-08' }), // due today
      buildTask({ id: '4', priority: 'low', dueDate: '2026-10-09' }),
      buildTask({ id: '5', priority: 'low', completed: true }),
    ]
    expect(computeStats(tasks, { now: NOW })).toEqual({
      total: 5,
      active: 3,
      completed: 2,
      overdue: 1,
      dueToday: 1,
      completionPercentage: 40,
      byPriority: {
        high: { total: 2, active: 1, completed: 1 },
        medium: { total: 1, active: 1, completed: 0 },
        low: { total: 2, active: 1, completed: 1 },
      },
    })
  })

  it('reports 100% when all tasks are complete', () => {
    const tasks = [buildTask({ id: '1', completed: true }), buildTask({ id: '2', completed: true })]
    expect(computeStats(tasks, { now: NOW }).completionPercentage).toBe(100)
  })

  it('ignores unknown priorities in the breakdown but still counts the task', () => {
    const stats = computeStats([buildTask({ priority: 'urgent' })], { now: NOW })
    expect(stats.total).toBe(1)
    expect(Object.values(stats.byPriority).every((bucket) => bucket.total === 0)).toBe(true)
  })

  it('does not mutate tasks', () => {
    const tasks = [buildTask()]
    const snapshot = structuredClone(tasks)
    computeStats(tasks, { now: NOW })
    expect(tasks).toEqual(snapshot)
  })
})

describe('sharePercentage', () => {
  it('is 0 when there is nothing to divide', () => {
    expect(sharePercentage(0, 0)).toBe(0)
    expect(sharePercentage(3, 0)).toBe(0)
    expect(sharePercentage(0, 5)).toBe(0)
  })

  it('rounds normally', () => {
    expect(sharePercentage(1, 3)).toBe(33)
    expect(sharePercentage(2, 3)).toBe(67)
    expect(sharePercentage(5, 5)).toBe(100)
  })

  it('guards against invalid input and parts larger than the total', () => {
    expect(sharePercentage(NaN, 4)).toBe(0)
    expect(sharePercentage(9, 4)).toBe(100)
  })
})
