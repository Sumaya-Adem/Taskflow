import { Icon } from '../ui/Icon.jsx'
import styles from './StatCards.module.css'

/**
 * Headline counts as stat cards. Values come straight from computeStats();
 * this component only formats them. Rendered as a description list so each
 * number is announced with its label.
 */
export function StatCards({ stats }) {
  const cards = [
    {
      key: 'total',
      label: 'Total tasks',
      value: stats.total,
      icon: 'tasks',
      tone: 'primary',
      caption: stats.dueToday > 0 ? `${stats.dueToday} due today` : 'Nothing due today',
    },
    { key: 'active', label: 'Active', value: stats.active, icon: 'inbox', caption: 'Still to do' },
    {
      key: 'completed',
      label: 'Completed',
      value: stats.completed,
      icon: 'checkCircle',
      tone: 'success',
      caption: `${stats.completionPercentage}% of all tasks`,
    },
    {
      key: 'overdue',
      label: 'Overdue',
      value: stats.overdue,
      icon: 'alert',
      tone: stats.overdue > 0 ? 'danger' : undefined,
      caption: stats.overdue > 0 ? 'Needs attention' : 'All on track',
      captionIcon: stats.overdue > 0 ? 'alert' : 'check',
    },
  ]

  return (
    <section aria-label="Task summary">
      <dl className={styles.grid}>
        {cards.map((card) => (
          <div key={card.key} className={`${styles.card} ${card.tone ? styles[card.tone] : ''}`}>
            <dt className={styles.label}>
              {card.label}
              <span className={styles.icon} aria-hidden="true">
                <Icon name={card.icon} size={18} />
              </span>
            </dt>
            <dd className={styles.value}>{card.value}</dd>
            <dd className={styles.caption}>
              {card.captionIcon && <Icon name={card.captionIcon} size={14} />}
              {card.caption}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
