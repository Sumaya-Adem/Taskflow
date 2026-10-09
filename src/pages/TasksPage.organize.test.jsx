import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '../config/constants.js'
import { buildTask } from '../test/fixtures.js'
import { renderApp } from '../test/renderApp.jsx'

const KEY = STORAGE_KEYS.TASKS
// Local noon on Friday 2026-10-09. Only Date is faked so user-event timers still run.
const NOW = new Date(2026, 9, 9, 12)

const TASKS = [
  buildTask({ id: 'a', title: 'Write quarterly report', description: 'Include Q3 NUMBERS', priority: 'high', category: 'work', dueDate: '2026-10-07', createdAt: '2026-10-01T09:00:00.000Z' }),
  buildTask({ id: 'b', title: 'Buy oat milk', priority: 'low', category: 'shopping', dueDate: '2026-10-09', createdAt: '2026-10-02T09:00:00.000Z' }),
  buildTask({ id: 'c', title: 'Dentist appointment', description: 'Call the clinic', priority: 'medium', category: 'health', dueDate: '2026-10-11', createdAt: '2026-10-03T09:00:00.000Z' }),
  buildTask({ id: 'd', title: 'Plan trip', priority: 'medium', category: 'personal', dueDate: null, createdAt: '2026-10-04T09:00:00.000Z' }),
  buildTask({ id: 'e', title: 'File taxes', priority: 'high', category: 'personal', dueDate: '2026-09-30', completed: true, completedAt: '2026-09-29T09:00:00.000Z', createdAt: '2026-09-20T09:00:00.000Z' }),
  buildTask({ id: 'f', title: 'Read book', priority: 'low', category: 'personal', dueDate: '2026-11-30', createdAt: '2026-10-05T09:00:00.000Z' }),
]
const STORED = JSON.stringify({ version: 1, tasks: TASKS })
const T = Object.fromEntries(TASKS.map((task) => [task.id, task.title]))

function setup() {
  return renderApp({ hash: '#/tasks', entries: { [KEY]: STORED } })
}

/** Titles of the visible tasks, in display order. */
const visibleTitles = () =>
  screen.queryAllByRole('checkbox').map((box) => box.closest('li').querySelector('h3').textContent)
const titlesOf = (...ids) => ids.map((id) => T[id])

const search = () => screen.getByRole('searchbox', { name: 'Search tasks' })
const select = (name) => screen.getByRole('combobox', { name })
const statusRadio = (name) => within(screen.getByRole('group', { name: 'Status' })).getByRole('radio', { name })
const chip = (label) => screen.getByRole('button', { name: `Remove ${label}` })

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('controls', () => {
  it('are not shown when there are no tasks at all', () => {
    renderApp({ hash: '#/tasks' })
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
  })

  it('are labelled and start at their defaults', () => {
    setup()
    expect(screen.getByRole('region', { name: 'Search, filter and sort tasks' })).toBeInTheDocument()
    expect(search()).toHaveValue('')
    expect(statusRadio('All')).toBeChecked()
    expect(select('Priority')).toHaveValue('all')
    expect(select('Category')).toHaveValue('all')
    expect(select('Due date')).toHaveValue('all')
    expect(select('Sort by')).toHaveValue('createdAt')
    expect(select('Order')).toHaveValue('desc')
    expect(screen.queryByRole('button', { name: 'Reset all' })).not.toBeInTheDocument()
  })

  it('list every configured option', () => {
    setup()
    const optionLabels = (name) => within(select(name)).getAllByRole('option').map((option) => option.textContent)
    expect(optionLabels('Priority')).toEqual(['All priorities', 'High', 'Medium', 'Low'])
    expect(optionLabels('Category')).toEqual(['All categories', 'Work', 'Personal', 'Shopping', 'Health', 'Other'])
    expect(optionLabels('Due date')).toEqual(['Any due date', 'Overdue', 'Due today', 'Due soon (next 3 days)', 'No due date'])
    expect(optionLabels('Sort by')).toEqual(['Date created', 'Due date', 'Priority', 'Title', 'Status', 'Last updated'])
  })
})

describe('search', () => {
  it('matches titles case-insensitively', async () => {
    const { user } = setup()
    await user.type(search(), 'REPORT')
    expect(visibleTitles()).toEqual(titlesOf('a'))
  })

  it('matches descriptions case-insensitively', async () => {
    const { user } = setup()
    await user.type(search(), 'clinic')
    expect(visibleTitles()).toEqual(titlesOf('c'))
    await user.clear(search())
    await user.type(search(), 'q3 numbers')
    expect(visibleTitles()).toEqual(titlesOf('a'))
  })

  it('ignores leading and trailing whitespace', async () => {
    const { user } = setup()
    await user.type(search(), '   milk   ')
    expect(visibleTitles()).toEqual(titlesOf('b'))
    expect(chip('Search: “milk”')).toBeInTheDocument()
  })

  it('treats a whitespace-only query as no search', async () => {
    const { user } = setup()
    await user.type(search(), '     ')
    expect(visibleTitles()).toHaveLength(TASKS.length)
    expect(screen.getByText('5 active · 1 completed')).toBeInTheDocument()
  })

  it('updates results as the user types', async () => {
    const { user } = setup()
    await user.type(search(), 'p')
    expect(visibleTitles()).toEqual(titlesOf('d', 'c', 'a')) // "Plan trip", "appointment", "report"
    await user.type(search(), 'l')
    expect(visibleTitles()).toEqual(titlesOf('d'))
    expect(screen.getByText('Showing 1 of 6')).toBeInTheDocument()
  })

  it('can be cleared with the clear button, keeping focus in the search box', async () => {
    const { user } = setup()
    await user.type(search(), 'milk')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search()).toHaveValue('')
    expect(visibleTitles()).toHaveLength(TASKS.length)
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument()
  })

  it('can be cleared with Escape', async () => {
    const { user } = setup()
    await user.type(search(), 'milk{Escape}')
    expect(search()).toHaveValue('')
  })

  it('announces the result count to screen readers', async () => {
    const { user } = setup()
    await user.type(search(), 'milk')
    expect(screen.getByText('1 of 6 tasks shown')).toHaveAttribute('aria-live', 'polite')
  })

  it('shows a dedicated empty state when nothing matches, with a way out', async () => {
    const { user } = setup()
    await user.type(search(), 'zzz')
    expect(visibleTitles()).toEqual([])
    expect(screen.getByRole('heading', { name: 'No matching tasks' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'No tasks yet' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(search()).toHaveValue('')
    expect(visibleTitles()).toHaveLength(TASKS.length)
  })
})

describe('filters', () => {
  it('filter by completion status', async () => {
    const { user } = setup()
    await user.click(statusRadio('Completed'))
    expect(visibleTitles()).toEqual(titlesOf('e'))
    await user.click(statusRadio('Active'))
    expect(visibleTitles()).toEqual(titlesOf('f', 'd', 'c', 'b', 'a'))
    await user.click(statusRadio('All'))
    expect(visibleTitles()).toHaveLength(TASKS.length)
  })

  it('filter by priority', async () => {
    const { user } = setup()
    await user.selectOptions(select('Priority'), 'high')
    expect(visibleTitles()).toEqual(titlesOf('a', 'e'))
    await user.selectOptions(select('Priority'), 'low')
    expect(visibleTitles()).toEqual(titlesOf('f', 'b'))
  })

  it('filter by category', async () => {
    const { user } = setup()
    await user.selectOptions(select('Category'), 'personal')
    expect(visibleTitles()).toEqual(titlesOf('f', 'd', 'e'))
  })

  it.each([
    ['overdue', ['a']], // completed "File taxes" is past due but not overdue
    ['today', ['b']],
    ['soon', ['c', 'b']], // today through the next 3 days
    ['none', ['d']],
  ])('filter by due date: %s', async (due, expected) => {
    const { user } = setup()
    await user.selectOptions(select('Due date'), due)
    expect(visibleTitles()).toEqual(titlesOf(...expected))
  })

  it('names due-date chips without repeating "Due"', async () => {
    const { user } = setup()
    await user.selectOptions(select('Due date'), 'soon')
    expect(chip('Due soon (next 3 days)')).toBeInTheDocument()
  })

  it('combine filters and search with AND', async () => {
    const { user } = setup()
    await user.click(statusRadio('Active'))
    await user.selectOptions(select('Category'), 'personal')
    expect(visibleTitles()).toEqual(titlesOf('f', 'd'))
    await user.type(search(), 'trip')
    expect(visibleTitles()).toEqual(titlesOf('d'))
    await user.selectOptions(select('Due date'), 'overdue')
    expect(screen.getByRole('heading', { name: 'No matching tasks' })).toBeInTheDocument()
  })

  it('highlight active filters and list them as removable chips', async () => {
    const { user } = setup()
    await user.selectOptions(select('Priority'), 'high')
    await user.click(statusRadio('Active'))

    expect(select('Priority')).toHaveClass('activeControl')
    expect(select('Category')).not.toHaveClass('activeControl')
    expect(chip('Status: Active')).toBeInTheDocument()
    expect(chip('Priority: High')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Matching tasks' })).toBeInTheDocument()

    await user.click(chip('Priority: High'))
    expect(select('Priority')).toHaveValue('all')
    expect(screen.queryByRole('button', { name: 'Remove Priority: High' })).not.toBeInTheDocument()
    expect(statusRadio('Active')).toBeChecked()
  })

  it('show the number of active filters on the mobile filter toggle', async () => {
    const { user } = setup()
    const toggle = screen.getByRole('button', { name: /Show filters/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(screen.getByRole('button', { name: /Hide filters/ })).toHaveAttribute('aria-expanded', 'true')

    await user.selectOptions(select('Category'), 'work')
    await user.selectOptions(select('Priority'), 'high')
    expect(screen.getByRole('button', { name: /Hide filters/ })).toHaveAccessibleName('Hide filters (2 active)')
  })
})

describe('sorting', () => {
  async function sortBy(user, field, direction) {
    await user.selectOptions(select('Sort by'), field)
    if (direction) await user.selectOptions(select('Order'), direction)
  }

  it('defaults to newest first', () => {
    setup()
    expect(visibleTitles()).toEqual(titlesOf('f', 'd', 'c', 'b', 'a', 'e'))
  })

  it('sorts by creation date in both directions', async () => {
    const { user } = setup()
    await user.selectOptions(select('Order'), 'asc')
    expect(visibleTitles()).toEqual(titlesOf('e', 'a', 'b', 'c', 'd', 'f'))
  })

  it('sorts by due date with undated tasks last in both directions', async () => {
    const { user } = setup()
    await sortBy(user, 'dueDate')
    expect(select('Order')).toHaveValue('asc')
    expect(visibleTitles()).toEqual(titlesOf('e', 'a', 'b', 'c', 'f', 'd'))
    await user.selectOptions(select('Order'), 'desc')
    expect(visibleTitles()).toEqual(titlesOf('f', 'c', 'b', 'a', 'e', 'd'))
  })

  it('sorts by title alphabetically in both directions', async () => {
    const { user } = setup()
    await sortBy(user, 'title')
    expect(visibleTitles()).toEqual([
      'Buy oat milk',
      'Dentist appointment',
      'File taxes',
      'Plan trip',
      'Read book',
      'Write quarterly report',
    ])
    await user.selectOptions(select('Order'), 'desc')
    expect(visibleTitles()).toEqual([
      'Write quarterly report',
      'Read book',
      'Plan trip',
      'File taxes',
      'Dentist appointment',
      'Buy oat milk',
    ])
  })

  it('sorts by priority rank with deterministic ties (newest first)', async () => {
    const { user } = setup()
    await sortBy(user, 'priority')
    expect(select('Order')).toHaveValue('desc')
    expect(visibleTitles()).toEqual(titlesOf('a', 'e', 'd', 'c', 'f', 'b'))
    await user.selectOptions(select('Order'), 'asc')
    expect(visibleTitles()).toEqual(titlesOf('f', 'b', 'd', 'c', 'a', 'e'))
  })

  it('sorts by completion status', async () => {
    const { user } = setup()
    await sortBy(user, 'status')
    expect(visibleTitles()).toEqual(titlesOf('f', 'd', 'c', 'b', 'a', 'e'))
    await user.selectOptions(select('Order'), 'desc')
    expect(visibleTitles()).toEqual(titlesOf('e', 'f', 'd', 'c', 'b', 'a'))
  })

  it('labels directions in terms of the chosen field and shows the sort as a chip', async () => {
    const { user } = setup()
    const directionLabels = () => within(select('Order')).getAllByRole('option').map((option) => option.textContent)
    expect(directionLabels()).toEqual(['Oldest first', 'Newest first'])
    await sortBy(user, 'dueDate')
    expect(directionLabels()).toEqual(['Earliest first', 'Latest first'])
    await sortBy(user, 'title')
    expect(directionLabels()).toEqual(['A to Z', 'Z to A'])
    expect(chip('Sort: Title (A to Z)')).toBeInTheDocument()

    await user.click(chip('Sort: Title (A to Z)'))
    expect(select('Sort by')).toHaveValue('createdAt')
    expect(select('Order')).toHaveValue('desc')
  })

  it('applies to search and filter results', async () => {
    const { user } = setup()
    await user.selectOptions(select('Category'), 'personal')
    await sortBy(user, 'title')
    expect(visibleTitles()).toEqual(titlesOf('e', 'd', 'f'))
  })

  it('keeps the chosen sort when search and filters are cleared', async () => {
    const { user } = setup()
    await sortBy(user, 'title')
    await user.type(search(), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(select('Sort by')).toHaveValue('title')
  })
})

describe('reset and data safety', () => {
  it('"Reset all" restores search, filters and sort', async () => {
    const { user } = setup()
    await user.type(search(), 'a')
    await user.click(statusRadio('Active'))
    await user.selectOptions(select('Priority'), 'medium')
    await user.selectOptions(select('Sort by'), 'title')

    await user.click(screen.getByRole('button', { name: 'Reset all' }))
    expect(search()).toHaveValue('')
    expect(statusRadio('All')).toBeChecked()
    expect(select('Priority')).toHaveValue('all')
    expect(select('Sort by')).toHaveValue('createdAt')
    expect(visibleTitles()).toEqual(titlesOf('f', 'd', 'c', 'b', 'a', 'e'))
    expect(screen.queryByRole('button', { name: 'Reset all' })).not.toBeInTheDocument()
  })

  it('never changes or re-saves stored tasks while searching, filtering and sorting', async () => {
    const { user, storage } = setup()
    const setItem = vi.spyOn(storage, 'setItem')
    await user.type(search(), 'a')
    await user.click(statusRadio('Completed'))
    await user.selectOptions(select('Sort by'), 'title')
    await user.click(screen.getByRole('button', { name: 'Reset all' }))

    expect(setItem).not.toHaveBeenCalled()
    expect(storage.getItem(KEY)).toBe(STORED)
  })

  it('keeps the view settings out of storage', async () => {
    const { user, storage } = setup()
    await user.type(search(), 'milk')
    expect(Object.keys(storage.entries())).toEqual([KEY])
  })
})

describe('working with task changes', () => {
  it('places a new task according to the current sort', async () => {
    const { user } = setup()
    await user.selectOptions(select('Sort by'), 'title')
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Title/), 'Call plumber{Enter}')
    expect(visibleTitles().slice(0, 2)).toEqual(['Buy oat milk', 'Call plumber'])
  })

  it('tells the user when a new task is hidden by the current view', async () => {
    const { user } = setup()
    await user.selectOptions(select('Category'), 'work')
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Title/), 'Personal errand{Enter}')

    expect(screen.getByRole('status')).toHaveTextContent(
      'Task "Personal errand" created. It is hidden by your current search or filters.',
    )
    expect(visibleTitles()).toEqual(titlesOf('a'))
  })

  it('removes an edited task that no longer matches, and says why', async () => {
    const { user } = setup()
    await user.type(search(), 'report')
    await user.click(screen.getByRole('button', { name: `Edit "${T.a}"` }))
    const titleInput = within(screen.getByRole('dialog')).getByLabelText(/Title/)
    await user.clear(titleInput)
    await user.type(titleInput, 'Quarterly summary{Enter}')

    expect(screen.getByRole('status')).toHaveTextContent('Changes saved. It is hidden by your current search or filters.')
    expect(screen.getByRole('heading', { name: 'No matching tasks' })).toBeInTheDocument()
  })

  it('shows an edited task once it starts matching', async () => {
    const { user } = setup()
    await user.type(search(), 'urgent')
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    await user.click(screen.getByRole('button', { name: `Edit "${T.d}"` }))
    const titleInput = within(screen.getByRole('dialog')).getByLabelText(/Title/)
    await user.clear(titleInput)
    await user.type(titleInput, 'Urgent: plan trip{Enter}')
    await user.type(search(), 'urgent')
    expect(visibleTitles()).toEqual(['Urgent: plan trip'])
  })

  it('moves a completed task out of the "Active" view and keeps keyboard focus in the list', async () => {
    const { user } = setup()
    await user.click(statusRadio('Active'))
    await user.click(screen.getByRole('checkbox', { name: T.b }))

    expect(visibleTitles()).toEqual(titlesOf('f', 'd', 'c', 'a'))
    expect(screen.getByRole('heading', { name: 'Matching tasks' })).toHaveFocus()
  })

  it('keeps focus on the checkbox when the task stays visible', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('checkbox', { name: T.b }))
    expect(screen.getByRole('checkbox', { name: T.b })).toHaveFocus()
  })

  it('deletes from a filtered view', async () => {
    const { user, storage } = setup()
    await user.selectOptions(select('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: `Delete "${T.a}"` }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete task' }))

    expect(visibleTitles()).toEqual(titlesOf('e'))
    expect(JSON.parse(storage.getItem(KEY)).tasks.map((task) => task.id)).toEqual(['b', 'c', 'd', 'e', 'f'])
  })
})
