import { useId } from 'react'
import { TaskItem } from './TaskItem.jsx'
import styles from './TaskList.module.css'

/** The task list with a heading and an active/completed summary. */
export function TaskList({ tasks, now, onToggle, onEdit, onDelete }) {
  const headingId = useId()
  const completedCount = tasks.filter((task) => task.completed).length
  const activeCount = tasks.length - completedCount

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} className={styles.heading}>
          All tasks
        </h2>
        <p className={styles.summary}>
          {activeCount} active · {completedCount} completed
        </p>
      </div>
      <ul className={styles.list}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} now={now} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )
}
