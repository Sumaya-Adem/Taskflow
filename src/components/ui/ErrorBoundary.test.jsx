import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.jsx'

function Broken() {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows a recovery screen with a reload action when a child throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    expect(consoleError).toHaveBeenCalledWith('TaskFlow crashed while rendering', expect.any(Error), expect.any(String))

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload TaskFlow' }))
    expect(reload).toHaveBeenCalled()
  })
})
