import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from './config/constants.js'
import { buildTask } from './test/fixtures.js'
import { renderApp } from './test/renderApp.jsx'

const tasksEntry = (tasks) => ({ [STORAGE_KEYS.TASKS]: JSON.stringify({ version: 1, tasks }) })
const mainNav = () => screen.getByRole('navigation', { name: 'Main' })
const navLink = (name) => within(mainNav()).getByRole('link', { name })
const pageHeading = () => screen.getByRole('heading', { level: 1 })

describe('application shell', () => {
  it('renders the landmarks, branding and navigation', () => {
    renderApp()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'TaskFlow home' }).length).toBeGreaterThan(0)
    expect(within(mainNav()).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Dashboard',
      'My Tasks',
      'Settings',
    ])
  })

  it('opens on the Dashboard by default and marks it active', () => {
    renderApp()
    expect(pageHeading()).toHaveTextContent('Dashboard')
    expect(navLink('Dashboard')).toHaveAttribute('aria-current', 'page')
    expect(navLink('My Tasks')).not.toHaveAttribute('aria-current')
    expect(navLink('Settings')).not.toHaveAttribute('aria-current')
    expect(document.title).toBe('Dashboard · TaskFlow')
  })

  it('provides a skip link that focuses the main content without changing the route', async () => {
    const { user } = renderApp({ hash: '#/tasks' })
    await user.click(screen.getByRole('link', { name: 'Skip to main content' }))
    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.location.hash).toBe('#/tasks')
    expect(pageHeading()).toHaveTextContent('My Tasks')
  })
})

describe('navigation', () => {
  it('navigates between sections by clicking links', async () => {
    const { user } = renderApp()

    await user.click(navLink('My Tasks'))
    expect(pageHeading()).toHaveTextContent('My Tasks')
    expect(window.location.hash).toBe('#/tasks')
    expect(navLink('My Tasks')).toHaveAttribute('aria-current', 'page')
    expect(navLink('Dashboard')).not.toHaveAttribute('aria-current')
    expect(document.title).toBe('My Tasks · TaskFlow')

    await user.click(navLink('Settings'))
    expect(pageHeading()).toHaveTextContent('Settings')
    expect(navLink('Settings')).toHaveAttribute('aria-current', 'page')
  })

  it('moves focus to the new page heading after navigating', async () => {
    const { user } = renderApp()
    expect(pageHeading()).not.toHaveFocus() // no focus stealing on first load
    await user.click(navLink('Settings'))
    expect(pageHeading()).toHaveFocus()
  })

  it('supports keyboard navigation', async () => {
    const { user } = renderApp()
    navLink('My Tasks').focus()
    await user.keyboard('{Enter}')
    expect(pageHeading()).toHaveTextContent('My Tasks')
  })

  it('opens the section named in the URL (deep link)', () => {
    renderApp({ hash: '#/settings' })
    expect(pageHeading()).toHaveTextContent('Settings')
    expect(navLink('Settings')).toHaveAttribute('aria-current', 'page')
  })

  it('falls back to the Dashboard for unknown routes', () => {
    renderApp({ hash: '#/does-not-exist' })
    expect(pageHeading()).toHaveTextContent('Dashboard')
  })

  it('follows URL changes such as browser back/forward', async () => {
    renderApp({ hash: '#/tasks' })
    act(() => {
      window.location.hash = '#/settings'
    })
    await waitFor(() => expect(pageHeading()).toHaveTextContent('Settings'))
  })

  it('returns to the Dashboard from the brand link', async () => {
    const { user } = renderApp({ hash: '#/settings' })
    await user.click(screen.getAllByRole('link', { name: 'TaskFlow home' })[0])
    expect(pageHeading()).toHaveTextContent('Dashboard')
  })
})

describe('pages', () => {
  it('shows empty states when there are no tasks', async () => {
    const { user } = renderApp()
    expect(screen.getByRole('heading', { name: 'Nothing to report yet' })).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Go to My Tasks' }))
    expect(pageHeading()).toHaveTextContent('My Tasks')
    expect(screen.getByRole('heading', { name: 'No tasks yet' })).toBeInTheDocument()
  })

  it('reflects stored tasks on the Dashboard and My Tasks pages', async () => {
    const { user } = renderApp({
      entries: tasksEntry([buildTask({ id: 'a' }), buildTask({ id: 'b', completed: true, completedAt: '2026-10-02T00:00:00.000Z' })]),
    })
    expect(screen.getByText('You have 2 tasks: 1 active and 1 completed.')).toBeInTheDocument()
    await user.click(navLink('My Tasks'))
    expect(screen.getByText('2 tasks are saved in this browser.')).toBeInTheDocument()
  })

  it('shows storage status and task count in Settings', () => {
    renderApp({ hash: '#/settings', entries: tasksEntry([buildTask()]) })
    expect(screen.getByText('Saving automatically in this browser')).toBeInTheDocument()
    expect(screen.getByText('Tasks', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
  })
})

describe('theme', () => {
  it('lets the user pick a theme in Settings and remembers it', async () => {
    const { user, storage } = renderApp({ hash: '#/settings' })
    const appearance = screen.getByRole('region', { name: 'Appearance' })
    expect(within(appearance).getByRole('radio', { name: /System/ })).toBeChecked()

    await user.click(within(appearance).getByRole('radio', { name: /Dark/ }))
    expect(within(appearance).getByRole('radio', { name: /Dark/ })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(JSON.parse(storage.getItem(STORAGE_KEYS.PREFERENCES))).toEqual({ theme: 'dark' })
  })

  it('applies a saved theme on startup', () => {
    renderApp({ entries: { [STORAGE_KEYS.PREFERENCES]: JSON.stringify({ theme: 'dark' }) } })
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggles light/dark from the header', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('storage notices', () => {
  it('explains recovery from corrupted data and can be dismissed', async () => {
    const { user } = renderApp({ entries: { [STORAGE_KEYS.TASKS]: '{broken' } })
    const notice = screen.getByRole('status')
    expect(notice).toHaveTextContent('Saved data could not be read')
    expect(notice).toHaveTextContent('taskflow:tasks:backup:')

    await user.click(within(notice).getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Saved data could not be read')).not.toBeInTheDocument()
  })

  it('warns when browser storage is unavailable', () => {
    renderApp({ storage: null, hash: '#/settings' })
    expect(screen.getByRole('status')).toHaveTextContent('Storage unavailable')
    expect(screen.getByText('Unavailable: changes last until you close this tab')).toBeInTheDocument()
  })

  it('shows no notice when storage is healthy', () => {
    renderApp()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
