import "./Card.css";
import AddToCompareButton from "./AddToCompareButton";

export default function Card({ title, subtitle, tags = [], meta = [], type = "default", variant, href }) {
  const resolvedType = variant || type;
  const metaList = Array.isArray(meta) ? meta : meta ? [meta] : [];
  const isExternal = href && (href.startsWith('http') || href.startsWith('//'));

  const card = (
    <div className={`card card-${resolvedType}`}>
      <div className="card-top">
        <h3>{title}</h3>
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
