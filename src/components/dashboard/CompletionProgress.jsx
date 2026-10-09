import { Panel } from '../ui/Panel.jsx'
import styles from './CompletionProgress.module.css'

/** Overall completion as a large figure and an accessible progress bar. */
export function CompletionProgress({ stats }) {
  const { completed, total, completionPercentage } = stats
  const detail = total === 0 ? 'No tasks yet' : `${completed} of ${total} ${total === 1 ? 'task' : 'tasks'} completed`

  return (
    <Panel title="Completion" description="How much of your list is done.">
      <div className={styles.figure}>
        <p className={styles.percentage}>{completionPercentage}%</p>
        <p className={styles.detail}>{detail}</p>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label="Tasks completed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completionPercentage}
        aria-valuetext={`${completionPercentage}% (${detail})`}
      >
        <div className={styles.fill} style={{ width: `${completionPercentage}%` }} />
      </div>
    </Panel>
  )
}
