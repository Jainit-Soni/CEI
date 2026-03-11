import { memo } from "react";
import TrustBadge from "./TrustBadge";
import AddToCompareButton from "./AddToCompareButton";
import FavoriteButton from "./FavoriteButton";
import AddToChoiceButton from "./AddToChoiceButton";
import PredictionBadge from "./PredictionBadge";
import "./Card.css";

function Card({ title, subtitle, tags = [], meta = [], type = "default", variant, href, trust, badge, data = {}, ...props }) {
  const resolvedType = variant || type;
  const metaList = Array.isArray(meta) ? meta : meta ? [meta] : [];
  const isExternal = href && (href.startsWith('http') || href.startsWith('//'));
  const isExam = resolvedType === "exam";
  const isScholarship = resolvedType === "scholarship";

  // Detect tier from tags or data for CSS color-coding
  const tierTag = tags.find(t => /tier\s*\d/i.test(t)) || data?.rankingTier || data?.ranking || "";

  // Common Props for buttons - Merge full data if provided
  const collegeData = {
    ...data,
    id: href?.split('/').pop() || data?.id,
    name: title || data?.name,
    title: title || data?.title,
    subtitle: subtitle || data?.subtitle,
    shortName: data?.shortName || title || data?.name
  };

  const card = (
    <div className={`card card-${resolvedType}`} data-tier={tierTag || undefined} data-type={resolvedType}>
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
          <div className="card-heading-group">
            <h3 className="card-full-name">{title || data?.name || data?.shortName || "Unknown Institute"}</h3>
            {data?.shortName && data.shortName !== title && (
              <span className="card-acronym">{data.shortName}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {data?.ceiScore > 0 && (
              <div
                title={`${data.competitivenessBand || 'Evaluated'} Tier: ${data.ceiScore.toFixed(1)}`}
                style={{
                  background: 'linear-gradient(135deg, #111827, #374151)',
                  color: '#fbbf24',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                  border: '1px solid #4b5563'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  {Math.round(data.ceiScore)} CEI Score
                </div>
                {data.ceiScore >= 80 && (
                  <div className="verification-badge" style={{ fontSize: '9px', color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '8px', border: '1px solid #d1fae5', marginTop: '2px', textAlign: 'center' }}>
                    Verified Elite
                  </div>
                )}
              </div>
            )}
            {trust && <TrustBadge {...trust} />}
            {isExam && data?.registrationDeadline && (
              <div className="exam-status-badge">
                <span className="dot animate-pulse"></span>
                Deadline: {data.registrationDeadline}
              </div>
            )}
            {isScholarship && data?.deadline && (
              <div className="scholarship-status-badge">
                <span className="dot animate-pulse"></span>
                Apply by: {data.deadline}
              </div>
            )}
          </div>
        </div>
        {subtitle || data?.location ? <p className="card-subtitle">{subtitle || data?.location}</p> : null}
      </div>
      <div className="card-refraction-overlay" aria-hidden="true" />
      {tags.length > 0 && (
        <div className="card-tags">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      )}
      {metaList.length > 0 && (
        <div className="card-meta">
          {metaList.map((m, i) => (
            <span key={i}>{m}</span>
          ))}
        </div>
      )}

      {resolvedType === "college" && !props.hideFooter && (
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

  const isValidHref = href && !href.includes("undefined");

  return isValidHref ? (
    <a
      href={href}
      {...(isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
    >
      {card}
    </a>
  ) : card;
}

export default memo(Card, (prevProps, nextProps) => {
  // Strict primitive equality checking to prevent 68k layout thrashing
  return prevProps.data?.id === nextProps.data?.id && prevProps.href === nextProps.href;
});
