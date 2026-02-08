import TrustBadge from "./TrustBadge";
import AddToCompareButton from "./AddToCompareButton";

export default function Card({ title, subtitle, tags = [], meta = [], type = "default", variant, href, trust, badge }) {
  const resolvedType = variant || type;
  const metaList = Array.isArray(meta) ? meta : meta ? [meta] : [];
  const isExternal = href && (href.startsWith('http') || href.startsWith('//'));

  const card = (
    <div className={`card card-${resolvedType}`}>
      {badge && (
        <div className="card-badge" style={{ backgroundColor: badge.color }}>
          {badge.text}
        </div>
      )}
      <div className="card-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <h3>{title}</h3>
          {trust && <TrustBadge {...trust} />}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {tags.length > 0 && (
        <div className="card-tags">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {metaList.length > 0 && (
        <div className="card-meta">
          {metaList.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
      {resolvedType === "college" && (
        <AddToCompareButton college={{ title, subtitle, id: href?.split('/').pop(), name: title, shortName: title }} className="card-compare-btn" />
      )}
    </div>
  );
  return href ? (
    <a
      href={href}
      {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
    >
      {card}
    </a>
  ) : card;
}
