import { useId, useState } from 'react'
import {
  CATEGORIES,
  DEFAULT_FILTERS,
  DUE_FILTER_OPTIONS,
  FILTER_ALL,
  PRIORITIES,
  SORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from '../../config/constants.js'
import { isDefaultSort } from '../../state/taskViewReducer.js'
import { Button } from '../ui/Button.jsx'
import { FormField } from '../ui/FormField.jsx'
import { Icon } from '../ui/Icon.jsx'
import styles from './TaskToolbar.module.css'

const PRIORITY_OPTIONS = [{ value: FILTER_ALL, label: 'All priorities' }, ...PRIORITIES]
const CATEGORY_OPTIONS = [{ value: FILTER_ALL, label: 'All categories' }, ...CATEGORIES]

/** Select-based filters: name in the view state, visible label and options. */
const SELECT_FILTERS = [
  { name: 'priority', label: 'Priority', options: PRIORITY_OPTIONS },
  { name: 'category', label: 'Category', options: CATEGORY_OPTIONS },
  { name: 'due', label: 'Due date', options: DUE_FILTER_OPTIONS },
]

// Chip prefixes; due-date option labels already name the field ("Overdue", "No due date").
const FILTER_LABELS = { status: 'Status', priority: 'Priority', category: 'Category', due: null }
const OPTIONS_BY_FILTER = {
  status: STATUS_FILTER_OPTIONS,
  priority: PRIORITY_OPTIONS,
  category: CATEGORY_OPTIONS,
  due: DUE_FILTER_OPTIONS,
}
const SORT_OPTION_BY_FIELD = new Map(SORT_OPTIONS.map((option) => [option.value, option]))

const optionLabel = (options, value) => options.find((option) => option.value === value)?.label ?? value

/** Human-readable descriptions of every non-default setting, for the removable chips. */
function describeActiveSettings({ query, filters, sort }) {
  const items = []
  const trimmedQuery = query.trim()
  if (trimmedQuery) items.push({ key: 'query', label: `Search: “${trimmedQuery}”` })

  for (const name of Object.keys(DEFAULT_FILTERS)) {
    if (filters[name] !== DEFAULT_FILTERS[name]) {
      const value = optionLabel(OPTIONS_BY_FILTER[name], filters[name])
      items.push({ key: name, label: FILTER_LABELS[name] ? `${FILTER_LABELS[name]}: ${value}` : value })
    }
  }

  if (!isDefaultSort(sort)) {
    const option = SORT_OPTION_BY_FIELD.get(sort.field)
    items.push({ key: 'sort', label: `Sort: ${option.label} (${option.directionLabels[sort.direction]})` })
  }
  return items
}

/**
 * Search, filter and sort controls for the task list. Purely presentational:
 * it shows the current `view` and reports changes through callbacks; the
 * filtering itself is done by the domain selectors.
 */
export function TaskToolbar({
  view,
  resultCount,
  totalCount,
  onQueryChange,
  onFilterChange,
  onSortFieldChange,
  onSortDirectionChange,
  onRemoveSetting,
  onReset,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const panelId = useId()
  const { query, filters, sort } = view
  const sortOption = SORT_OPTION_BY_FIELD.get(sort.field)
  const activeSettings = describeActiveSettings(view)
  const activeFilterCount = Object.keys(DEFAULT_FILTERS).filter((name) => filters[name] !== DEFAULT_FILTERS[name]).length
  const isFiltering = query.trim() !== '' || activeFilterCount > 0
  const toggleLabel = filtersOpen ? 'Hide filters' : 'Show filters'

  const controlClass = (className, isActive) => `${className} ${isActive ? styles.activeControl : ''}`

  return (
    <section className={styles.toolbar} aria-label="Search, filter and sort tasks">
      <div className={styles.topRow}>
        <div className={styles.searchField}>
          <FormField label="Search tasks" showOptional={false}>
            {(fieldProps) => (
              <div className={styles.searchWrap}>
                <Icon name="search" size={18} className={styles.searchIcon} />
                <input
                  {...fieldProps}
                  className={controlClass(`${fieldProps.className} ${styles.searchInput}`, query.trim() !== '')}
                  type="search"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape' && query) {
                      event.preventDefault()
                      onQueryChange('')
                    }
                  }}
                  placeholder="Title or description"
                  autoComplete="off"
                  spellCheck="false"
                />
                {query && (
                  <Button
                    variant="ghost"
                    iconOnly
                    className={styles.clearSearch}
                    onClick={() => onQueryChange('')}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={16} />
                  </Button>
                )}
              </div>
            )}
          </FormField>
        </div>

        <div className={styles.sortField}>
          <FormField label="Sort by" showOptional={false}>
            {(fieldProps) => (
              <select
                {...fieldProps}
                className={controlClass(fieldProps.className, sort.field !== SORT_OPTIONS[0].value)}
                value={sort.field}
                onChange={(event) => onSortFieldChange(event.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <div className={styles.sortField}>
          <FormField label="Order" showOptional={false}>
            {(fieldProps) => (
              <select
                {...fieldProps}
                className={controlClass(fieldProps.className, sort.direction !== sortOption.defaultDirection)}
                value={sort.direction}
                onChange={(event) => onSortDirectionChange(event.target.value)}
              >
                {Object.entries(sortOption.directionLabels).map(([direction, label]) => (
                  <option key={direction} value={direction}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <Button
          variant="secondary"
          className={styles.filterToggle}
          aria-expanded={filtersOpen}
          aria-controls={panelId}
          aria-label={`${toggleLabel}${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ''}`}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Icon name="filter" size={16} />
          {toggleLabel}
          {activeFilterCount > 0 && <span className={styles.toggleCount}>{activeFilterCount}</span>}
        </Button>
      </div>

      <div id={panelId} className={`${styles.filters} ${filtersOpen ? '' : styles.filtersCollapsed}`}>
        <fieldset className={styles.segmented}>
          <legend className={styles.legend}>Status</legend>
          <div className={styles.segments}>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <label key={option.value} className={styles.segment}>
                <input
                  type="radio"
                  name={`${panelId}-status`}
                  value={option.value}
                  checked={filters.status === option.value}
                  onChange={() => onFilterChange('status', option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {SELECT_FILTERS.map(({ name, label, options }) => (
          <FormField key={name} label={label} showOptional={false}>
            {(fieldProps) => (
              <select
                {...fieldProps}
                className={controlClass(fieldProps.className, filters[name] !== DEFAULT_FILTERS[name])}
                value={filters[name]}
                onChange={(event) => onFilterChange(name, event.target.value)}
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        ))}
      </div>

      {activeSettings.length > 0 && (
        <div className={styles.chipsRow}>
          <span className={styles.chipsLabel} id={`${panelId}-chips`}>
            Active:
          </span>
          <ul className={styles.chips} aria-labelledby={`${panelId}-chips`}>
            {activeSettings.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={styles.chip}
                  onClick={() => onRemoveSetting(item.key)}
                  aria-label={`Remove ${item.label}`}
                >
                  <span>{item.label}</span>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" className={styles.resetAll} onClick={onReset}>
            Reset all
          </Button>
        </div>
      )}

      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {isFiltering
          ? `${resultCount} of ${totalCount} ${totalCount === 1 ? 'task' : 'tasks'} shown`
          : `${totalCount} ${totalCount === 1 ? 'task' : 'tasks'}`}
      </p>
    </section>
  )
}
