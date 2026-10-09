import { Component } from 'react'
import { Button } from './Button.jsx'
import { Icon } from './Icon.jsx'
import styles from './ErrorBoundary.module.css'

/**
 * Catches rendering errors below it and shows a recovery screen instead of a
 * blank page. Saved tasks are unaffected, so reloading is a safe default.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('TaskFlow crashed while rendering', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className={styles.fallback}>
        <div className={styles.card} role="alert">
          <Icon name="alert" size={32} className={styles.icon} />
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.message}>
            TaskFlow hit an unexpected problem. Your saved tasks are safe. Reloading usually fixes this.
          </p>
          <div className={styles.actions}>
            <Button onClick={this.handleReload}>
              <Icon name="refresh" size={16} />
              Reload TaskFlow
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
