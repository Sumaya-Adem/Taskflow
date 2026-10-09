import { useId } from 'react'
import { Badge } from '../ui/Badge.jsx'
import { Button } from '../ui/Button.jsx'
import { Icon } from '../ui/Icon.jsx'
import { getCategoryLabel, getCompletedLabel, getDueBadge, getPriorityBadge } from './taskPresentation.js'
import styles from './TaskItem.module.css'

/**
 * One task: completion checkbox, details and edit/delete actions. The
 * checkbox is labelled by the task title, so assistive technology reads
 * "<title>, checkbox, checked".
 */
export function TaskItem({ task, now, onToggle, onEdit, onDelete }) {
  const titleId = useId()
  const dueBadge = getDueBadge(task, now)
  const priorityBadge = getPriorityBadge(task.priority)
  const completedLabel = getCompletedLabel(task, now)

  const stateClass = task.completed ? styles.completed : dueBadge ? styles[dueBadge.state] : ''

  return (
    <li className={`${styles.item} ${stateClass ?? ''}`}>
      <label className={styles.check}>
        <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} aria-labelledby={titleId} />
      </label>

      <div className={styles.content}>
        <h3 id={titleId} className={styles.title}>
          {task.title}
        </h3>
        {task.description && <p className={styles.description}>{task.description}</p>}
      </div>

      <ul className={styles.meta} aria-label="Task details">
        {completedLabel && (
          <li>
            <Badge tone="success" icon="check">
              {completedLabel}
            </Badge>
          </li>
        )}
        {dueBadge && (
          <li>
            <Badge tone={dueBadge.tone} icon="calendar">
              <time dateTime={task.dueDate}>{dueBadge.label}</time>
            </Badge>
          </li>
        )}
        <li>
          <Badge tone={priorityBadge.tone} icon="flag">
            {priorityBadge.label}
          </Badge>
        </li>
        <li>
          <Badge icon="tag">{getCategoryLabel(task.category)}</Badge>
        </li>
      </ul>

      <div className={styles.actions}>
        <Button variant="ghost" iconOnly onClick={() => onEdit(task)} aria-label={`Edit "${task.title}"`} title="Edit">
          <Icon name="edit" size={18} />
        </Button>
        <Button
          variant="ghost"
          iconOnly
          className={styles.deleteButton}
          onClick={() => onDelete(task)}
          aria-label={`Delete "${task.title}"`}
          title="Delete"
        >
          <Icon name="trash" size={18} />
        </Button>
      </div>
    </li>
  )
}
