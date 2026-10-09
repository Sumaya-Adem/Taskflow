import { useRef } from 'react'
import { Button } from './Button.jsx'
import { Modal } from './Modal.jsx'
import styles from './ConfirmDialog.module.css'

/**
 * Confirmation for destructive actions. Uses role="alertdialog" and puts
 * initial focus on Cancel, so pressing Enter by reflex never destroys data.
 */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = useRef(null)

  return (
    <Modal title={title} description={message} onClose={onCancel} initialFocusRef={cancelRef} role="alertdialog">
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
