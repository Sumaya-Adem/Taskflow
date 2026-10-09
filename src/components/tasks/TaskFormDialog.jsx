import { useRef } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { TaskForm } from './TaskForm.jsx'

/** The task form inside a modal dialog, for creating (no `task`) or editing a task. */
export function TaskFormDialog({ task, onSubmit, onClose }) {
  const titleInputRef = useRef(null)
  const isEditing = Boolean(task)

  return (
    <Modal
      title={isEditing ? 'Edit task' : 'New task'}
      description={isEditing ? 'Update the details of this task.' : 'Add a task to your list.'}
      onClose={onClose}
      initialFocusRef={titleInputRef}
    >
      <TaskForm
        task={task}
        submitLabel={isEditing ? 'Save changes' : 'Create task'}
        onSubmit={onSubmit}
        onCancel={onClose}
        titleInputRef={titleInputRef}
      />
    </Modal>
  )
}
