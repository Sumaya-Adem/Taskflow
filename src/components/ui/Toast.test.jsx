import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOAST_DURATION_MS, Toast } from './Toast.jsx'

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('always renders a polite live region, empty when there is no message', () => {
    render(<Toast toast={null} onDismiss={() => {}} />)
    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toBeEmptyDOMElement()
  })

  it('shows the message and can be dismissed', async () => {
    const onDismiss = vi.fn()
    render(<Toast toast={{ id: 1, message: 'Saved.', tone: 'success' }} onDismiss={onDismiss} />)
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('dismisses itself after the configured duration', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    render(<Toast toast={{ id: 1, message: 'Saved.' }} onDismiss={onDismiss} />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1))
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('restarts the timer for a new message', () => {
    vi.useFakeTimers()
    const onDismiss = vi.fn()
    const { rerender } = render(<Toast toast={{ id: 1, message: 'First' }} onDismiss={onDismiss} />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 100))
    rerender(<Toast toast={{ id: 2, message: 'Second' }} onDismiss={onDismiss} />)
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 100))
    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Second')
  })
})
