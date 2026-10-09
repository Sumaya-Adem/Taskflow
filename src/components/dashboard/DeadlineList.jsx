import { Badge } from '../ui/Badge.jsx'
import { Icon } from '../ui/Icon.jsx'
import { Panel } from '../ui/Panel.jsx'
import { getDueBadge, getPriorityBadge } from '../tasks/taskPresentation.js'
import styles from './DeadlineList.module.css'

export const DEADLINE_LIST_LIMIT = 5

/**
 * A short list of tasks with deadlines (overdue or upcoming). Shows the first
 * `limit` tasks in the order given; selecting a title opens it for editing,
 * and the footer links to the full task list.
 */
export function DeadlineList({ title, description, tasks, emptyMessage, footerNote, now, tasksHref, onOpenTask, limit = DEADLINE_LIST_LIMIT }) {
  const shown = tasks.slice(0, limit)
  const hiddenCount = tasks.length - shown.length

  return (
    <Panel title={title} description={description}>
      {shown.length === 0 ? (
        <p className={styles.empty}>
          <Icon name="checkCircle" size={18} />
          {emptyMessage}
        </p>
      ) : (
        <ul className={styles.list}>
          {shown.map((task) => {
            const due = getDueBadge(task, now)
            const priority = getPriorityBadge(task.priority)
            return (
              <li key={task.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.titleButton}
                  onClick={() => onOpenTask(task)}
                  aria-label={`Edit "${task.title}"`}
                >
                  {task.title}
                </button>
                <span className={styles.badges}>
                  {due && (
                    <Badge tone={due.tone} icon="calendar">
                      <time dateTime={task.dueDate}>{due.label}</time>
                    </Badge>
                  )}
                  <Badge tone={priority.tone} icon="flag">
                    {priority.label}
                  </Badge>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {(hiddenCount > 0 || footerNote) && (
        <div className={styles.footer}>
          <span>
            {hiddenCount > 0 ? `+${hiddenCount} more` : null}
            {hiddenCount > 0 && footerNote ? ' · ' : null}
            {footerNote}
          </span>
          <a className={styles.link} href={tasksHref}>
            View in My Tasks
          </a>
        </div>
      )}
    </Panel>
  )
}
