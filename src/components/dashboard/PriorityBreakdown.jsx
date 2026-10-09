import { PRIORITIES } from '../../config/constants.js'
import { sharePercentage } from '../../domain/stats.js'
import { Icon } from '../ui/Icon.jsx'
import { Panel } from '../ui/Panel.jsx'
import styles from './PriorityBreakdown.module.css'

/**
 * Tasks per priority as a compact bar list. Every configured priority is
 * shown, including empty ones; each bar is the priority's share of all
 * tasks and is labelled with its count and percentage, so nothing relies
 * on the bar or its color alone.
 */
export function PriorityBreakdown({ stats }) {
  return (
    <Panel title="Tasks by priority" description="How your tasks are spread across priority levels.">
      <ul className={styles.list}>
        {PRIORITIES.map((priority) => {
          const { total, active } = stats.byPriority[priority.value]
          const share = sharePercentage(total, stats.total)
          return (
            <li key={priority.value} className={styles.row}>
              <span className="visually-hidden">
                {`${priority.label} priority: ${total} ${total === 1 ? 'task' : 'tasks'} (${share}% of all), ${active} active`}
              </span>
              <span className={styles.label} aria-hidden="true">
                <Icon name="flag" size={14} />
                {priority.label}
              </span>
              <div className={styles.track} aria-hidden="true">
                <div className={styles.bar} style={{ width: `${share}%` }} data-testid={`priority-bar-${priority.value}`} />
              </div>
              <span className={styles.value} aria-hidden="true">
                {total} <span className={styles.share}>· {share}%</span>
              </span>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
