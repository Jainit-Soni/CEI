import TrustBadge from "./TrustBadge";
import AddToCompareButton from "./AddToCompareButton";
import FavoriteButton from "./FavoriteButton";
import AddToChoiceButton from "./AddToChoiceButton";
import PredictionBadge from "./PredictionBadge"; // New
import "./Card.css";

export default function Card({ title, subtitle, tags = [], meta = [], type = "default", variant, href, trust, badge, data = {} }) {
  const resolvedType = variant || type;
  const metaList = Array.isArray(meta) ? meta : meta ? [meta] : [];
  const isExternal = href && (href.startsWith('http') || href.startsWith('//'));

  // Detect tier from tags or data for CSS color-coding
  const tierTag = tags.find(t => /tier\s*\d/i.test(t)) || data?.rankingTier || data?.ranking || "";

  // Common Props for buttons - Merge full data if provided
  const collegeData = {
    ...data,
    id: href?.split('/').pop() || data?.id,
    name: title || data?.name,
    title: title || data?.title,
    subtitle: subtitle || data?.subtitle,
    shortName: title || data?.shortName || data?.name
  };

  const card = (
    <div className={`card card-${resolvedType}`} data-tier={tierTag || undefined}>
      {/* 1. AI Prediction Badge (Top Priority) */}
      {resolvedType === "college" && <PredictionBadge college={collegeData} />}

      {/* 2. Manual Badge (e.g. "Admissions Open") */}
      {badge && !(<PredictionBadge college={collegeData} />) && (
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
        <div
          className="card-footer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="card-footer-left">
            <FavoriteButton type="colleges" id={collegeData.id} item={collegeData} size="sm" />
            <AddToCompareButton college={collegeData} />
          </div>
          <AddToChoiceButton college={collegeData} />
        </div>
      )}
    </div>
  );
  return href ? (
    <a
      href={href}
      {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      {card}
    </a>
  ) : card;
}
