import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import { Modal } from './Modal.jsx'

function Harness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  const close = () => {
    onClose()
    setOpen(false)
  }
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal title="Example" description="Some context" onClose={close} initialFocusRef={inputRef}>
          <input ref={inputRef} aria-label="Name" />
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('is named and described by its title and description', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    const dialog = screen.getByRole('dialog', { name: 'Example' })
    expect(dialog).toHaveAccessibleDescription('Some context')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('moves focus into the dialog and returns it to the opener on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Close dialog' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus()
  })

  it('closes on the native cancel event (Escape) without the browser closing it first', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Harness onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const cancel = new Event('cancel', { cancelable: true })
    fireEvent(screen.getByRole('dialog'), cancel)
    expect(cancel.defaultPrevented).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('focuses the dialog itself when no initial focus target is given', () => {
    render(
      <Modal title="Plain" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Plain' })).toHaveFocus()
  })

  it('uses showModal() when the browser supports it', () => {
    const showModal = vi.fn(function () {
      this.setAttribute('open', '')
    })
    const close = vi.fn()
    HTMLDialogElement.prototype.showModal = showModal
    HTMLDialogElement.prototype.close = close
    try {
      const { unmount } = render(<Modal title="Native" onClose={() => {}} />)
      expect(showModal).toHaveBeenCalledTimes(1)
      unmount()
      expect(close).toHaveBeenCalledTimes(1)
    } finally {
      delete HTMLDialogElement.prototype.showModal
      delete HTMLDialogElement.prototype.close
    }
  })
})

describe('ConfirmDialog', () => {
  it('is an alertdialog that focuses Cancel first and reports each choice', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog title="Delete?" message="Gone forever." confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />,
    )

    const dialog = screen.getByRole('alertdialog', { name: 'Delete?' })
    expect(dialog).toHaveAccessibleDescription('Gone forever.')
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
