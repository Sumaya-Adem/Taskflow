import styles from './Button.module.css'

const VARIANT_CLASSES = {
  primary: styles.primary,
  secondary: styles.secondary,
  ghost: styles.ghost,
  danger: styles.danger,
}

/**
 * Button with consistent styling. Renders an `<a>` when `href` is given, so
 * navigation stays a real link. Icon-only buttons (`iconOnly`) need an
 * `aria-label`.
 */
export function Button({ variant = 'primary', iconOnly = false, href, className, type = 'button', ...props }) {
  const classes = [styles.button, VARIANT_CLASSES[variant], iconOnly && styles.icon, className]
    .filter(Boolean)
    .join(' ')

  if (href !== undefined) return <a href={href} className={classes} {...props} />
  return <button type={type} className={classes} {...props} />
}
