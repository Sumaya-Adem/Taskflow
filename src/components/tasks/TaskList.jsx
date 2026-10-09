import { useId } from 'react'
import { TaskItem } from './TaskItem.jsx'
import styles from './TaskList.module.css'

/**
 * The (possibly filtered) task list with a heading and summary. When
 * `isFiltered`, the summary reports how many of `totalCount` tasks match;
 * otherwise it shows the active/completed split. The heading accepts a ref
 * so focus can be moved to it when a task leaves the filtered view.
 */
export function TaskList({ tasks, totalCount = tasks.length, isFiltered = false, headingRef, now, onToggle, onEdit, onDelete }) {
  const headingId = useId()
  const completedCount = tasks.filter((task) => task.completed).length
  const activeCount = tasks.length - completedCount

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.header}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
          {isFiltered ? 'Matching tasks' : 'All tasks'}
        </h2>
        <p className={styles.summary}>
          {isFiltered
            ? `Showing ${tasks.length} of ${totalCount}`
            : `${activeCount} active · ${completedCount} completed`}
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
