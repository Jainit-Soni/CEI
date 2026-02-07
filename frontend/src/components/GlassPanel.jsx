import "./GlassPanel.css";

/**
 * GlassPanel - Reusable glassmorphism container component
 * Supports multiple variants: default, strong, subtle, dark
 * Use for sections, cards, modals, and overlay panels
 */
export default function GlassPanel({
  children,
  variant = "default",
  className = "",
  glow = false,
  shimmer = false,
  as: Component = "div",
  ...props
}) {
  const classes = [
    "glass-panel",
    `glass-panel--${variant}`,
    glow && "glass-panel--glow",
    shimmer && "glass-panel--shimmer",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {shimmer && <div className="glass-panel-shimmer" aria-hidden="true" />}
      {children}
    </Component>
  );
}
