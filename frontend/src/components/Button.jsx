import "./Button.css";

export default function Button({ children, variant = "primary", href, onClick, className = "", external }) {
  const classes = `btn btn-${variant} ${className}`.trim();
  const isExternal = external || (href && (href.startsWith('http') || href.startsWith('//')));

  if (href) {
    return (
      <a
        className={classes}
        href={href}
        {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
      >
        {children}
      </a>
    );
  }
  return (
    <button className={classes} onClick={onClick} suppressHydrationWarning={true}>
      {children}
    </button>
  );
}
