import { useRef } from 'react'
import { Button } from './Button.jsx'
import { Modal } from './Modal.jsx'
import styles from './ConfirmDialog.module.css'

/**
 * Confirmation for destructive actions. Uses role="alertdialog" and puts
 * initial focus on Cancel, so pressing Enter by reflex never destroys data.
 * The confirm action runs at most once.
 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null)
  // Confirm at most once, even if the button is activated again before the dialog closes.
  const confirmedRef = useRef(false)
  const handleConfirm = () => {
    if (confirmedRef.current) return
    confirmedRef.current = true
    onConfirm()
  }

  return (
    <Modal title={title} description={message} onClose={onCancel} initialFocusRef={cancelRef} role="alertdialog">
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
