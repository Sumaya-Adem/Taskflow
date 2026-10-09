import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from './config/constants.js'
import { buildTask } from './test/fixtures.js'
import { renderApp } from './test/renderApp.jsx'

/**
 * Structural accessibility sweep across every page and dialog: landmarks,
 * heading order and accessible names for every interactive control.
 */

const NOW = new Date(2026, 9, 9, 12)
const TASKS = [
  buildTask({ id: 'a', title: 'Overdue report', priority: 'high', dueDate: '2026-10-01' }),
  buildTask({ id: 'b', title: 'Due today', dueDate: '2026-10-09', description: 'Some notes' }),
  buildTask({ id: 'c', title: 'Finished', completed: true, completedAt: NOW.toISOString() }),
]
const entries = { [STORAGE_KEYS.TASKS]: JSON.stringify({ version: 1, tasks: TASKS }) }

const INTERACTIVE_ROLES = ['button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'progressbar']

function expectAllNamed(container) {
  for (const role of INTERACTIVE_ROLES) {
    for (const element of within(container).queryAllByRole(role)) {
      expect(element, `${role} without a name: ${element.outerHTML.slice(0, 120)}`).toHaveAccessibleName()
    }
  }
}

/** Heading levels in document order must never skip (h2 → h4). */
function expectHeadingOrder(container, startLevel) {
  const headings = [...container.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => !h.closest('dialog') || container.tagName === 'DIALOG')
  let previous = startLevel - 1
  for (const heading of headings) {
    const level = Number(heading.tagName[1])
    expect(level, `"${heading.textContent}" jumps from h${previous} to h${level}`).toBeLessThanOrEqual(previous + 1)
    previous = level
  }
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe.each(['#/dashboard', '#/tasks', '#/settings'])('page %s', (hash) => {
  it('has the landmarks, one h1 and an ordered heading structure', () => {
    renderApp({ hash, entries })
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expectHeadingOrder(document.body, 1)
  })

  it('gives every interactive control an accessible name', () => {
    renderApp({ hash, entries })
    expectAllNamed(document.body)
  })

  it('has the same structure when empty', () => {
    renderApp({ hash })
    expectAllNamed(document.body)
    expectHeadingOrder(document.body, 1)
  })
})

describe('dialogs', () => {
  it('task form: named dialog, labelled fields, ordered headings', async () => {
    const { user } = renderApp({ hash: '#/tasks', entries })
    await user.click(screen.getByRole('button', { name: 'New task' }))
    const dialog = screen.getByRole('dialog', { name: 'New task' })
    expectAllNamed(dialog)
    expectHeadingOrder(dialog, 2)
    for (const label of ['Title', 'Description', 'Priority', 'Category', 'Due date']) {
      expect(within(dialog).getByLabelText(new RegExp(label))).toBeInTheDocument()
    }
  })

  it('validation errors are announced through the field description', async () => {
    const { user } = renderApp({ hash: '#/tasks', entries })
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.click(screen.getByRole('button', { name: 'Create task' }))
    const title = within(screen.getByRole('dialog')).getByLabelText(/Title/)
    expect(title).toBeInvalid()
    expect(title).toHaveAccessibleDescription(expect.stringContaining('Title is required.'))
  })

  it('delete confirmation: named and described alertdialog', async () => {
    const { user } = renderApp({ hash: '#/tasks', entries })
    await user.click(screen.getByRole('button', { name: 'Delete "Finished"' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete task?' })
    expect(dialog).toHaveAccessibleDescription(/"Finished" will be permanently deleted/)
    expectAllNamed(dialog)
  })

  it('Escape-equivalent cancel and focus restoration work from the dashboard edit dialog', async () => {
    const { user } = renderApp({ entries })
    const trigger = within(screen.getByRole('region', { name: 'Overdue' })).getByRole('button', { name: 'Edit "Overdue report"' })
    await user.click(trigger)
    expect(within(screen.getByRole('dialog')).getByLabelText(/Title/)).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(trigger).toHaveFocus()
  })
})

describe('status information is not conveyed by color alone', () => {
  it('task states and priorities are spelled out in text', () => {
    renderApp({ hash: '#/tasks', entries })
    const item = (title) => screen.getByRole('checkbox', { name: title }).closest('li')
    expect(within(item('Overdue report')).getByText('Overdue · due Oct 1')).toBeInTheDocument()
    expect(within(item('Overdue report')).getByText('High priority')).toBeInTheDocument()
    expect(within(item('Due today')).getByText('Due today', { selector: 'time' })).toBeInTheDocument()
    expect(within(item('Finished')).getByText('Completed today')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Finished' })).toBeChecked()
  })

  it('the progress bar exposes its value as text', () => {
    renderApp({ entries })
    expect(screen.getByRole('progressbar', { name: 'Tasks completed' })).toHaveAttribute(
      'aria-valuetext',
      '33% (1 of 3 tasks completed)',
    )
  })
})

describe('keyboard', () => {
  it('reaches the skip link first and the main navigation next', async () => {
    const { user } = renderApp({ entries })
    await user.tab()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
    await user.tab()
    expect(screen.getAllByRole('link', { name: 'TaskFlow home' })[0]).toHaveFocus()
    await user.tab()
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Dashboard' })).toHaveFocus()
  })

  it('operates the status filter with arrow keys', async () => {
    const { user } = renderApp({ hash: '#/tasks', entries })
    const group = screen.getByRole('group', { name: 'Status' })
    within(group).getByRole('radio', { name: 'All' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(within(group).getByRole('radio', { name: 'Active' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Finished' })).not.toBeInTheDocument()
  })
})
