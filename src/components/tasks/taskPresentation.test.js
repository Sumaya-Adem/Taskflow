import { describe, expect, it } from 'vitest'
import { buildTask } from '../../test/fixtures.js'
import { getCategoryLabel, getCompletedLabel, getDueBadge, getPriorityBadge } from './taskPresentation.js'

const NOW = new Date(2026, 9, 9, 12) // local 2026-10-09 noon

describe('getPriorityBadge', () => {
  it.each([
    ['high', 'danger', 'High priority'],
    ['medium', 'warning', 'Medium priority'],
    ['low', 'neutral', 'Low priority'],
  ])('%s → %s "%s"', (priority, tone, label) => {
    expect(getPriorityBadge(priority)).toEqual({ tone, label })
  })
})

describe('getCategoryLabel', () => {
  it('uses the configured label', () => {
    expect(getCategoryLabel('work')).toBe('Work')
    expect(getCategoryLabel('health')).toBe('Health')
  })
})

describe('getDueBadge', () => {
  const badge = (dueDate, overrides) => getDueBadge(buildTask({ dueDate, ...overrides }), NOW)

  it('returns null without a due date', () => {
    expect(badge(null)).toBeNull()
  })

  it.each([
    ['2026-10-08', 'overdue', 'danger', 'Overdue · due yesterday'],
    ['2026-09-30', 'overdue', 'danger', 'Overdue · due Sep 30'],
    ['2026-10-09', 'today', 'warning', 'Due today'],
    ['2026-10-10', 'soon', 'warning', 'Due tomorrow'],
    ['2026-10-12', 'soon', 'warning', 'Due Oct 12'],
    ['2026-10-13', 'upcoming', 'neutral', 'Due Oct 13'],
    ['2027-01-05', 'upcoming', 'neutral', 'Due Jan 5, 2027'],
  ])('due %s → %s', (dueDate, state, tone, label) => {
    expect(badge(dueDate)).toEqual({ state, tone, label })
  })

  it('shows completed tasks without urgency, even when past due', () => {
    expect(badge('2026-10-01', { completed: true, completedAt: NOW.toISOString() })).toEqual({
      state: 'none',
      tone: 'neutral',
      label: 'Due Oct 1',
    })
  })
})

describe('getCompletedLabel', () => {
  it('returns null for active tasks', () => {
    expect(getCompletedLabel(buildTask(), NOW)).toBeNull()
  })

  it('describes when the task was completed, in local time', () => {
    expect(getCompletedLabel(buildTask({ completed: true, completedAt: NOW.toISOString() }), NOW)).toBe('Completed today')
    const earlier = new Date(2026, 9, 2, 9).toISOString()
    expect(getCompletedLabel(buildTask({ completed: true, completedAt: earlier }), NOW)).toBe('Completed Oct 2')
  })

  it('falls back to plain "Completed" for an unreadable timestamp', () => {
    expect(getCompletedLabel(buildTask({ completed: true, completedAt: 'garbage' }), NOW)).toBe('Completed')
  })
})
