import { memo } from "react";
import { Sparkles, ExternalLink, FileText, Globe } from "lucide-react";
import TrustBadge from "./TrustBadge";
import AddToCompareButton from "./AddToCompareButton";
import { useAuth } from "@/lib/AuthContext";
import { useComparator } from "@/hooks/useComparator";
import FavoriteButton from "./FavoriteButton";
import AddToChoiceButton from "./AddToChoiceButton";
import PredictionBadge from "./PredictionBadge";
import FitBadge from "./FitBadge";
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

  const { user } = useAuth();
  const { setGhostCollege } = useComparator();
  const isCollege = type === 'college';

  const card = (
    <div
      className={`card card-${resolvedType} ${isCollege ? 'cursor-pointer' : ''}`}
      data-tier={tierTag || undefined}
      data-type={resolvedType}
      onMouseEnter={() => isCollege && setGhostCollege(data)}
      onMouseLeave={() => isCollege && setGhostCollege(null)}
    >
      {/* 1. Intelligent Fit Signal */}
      {resolvedType === "college" && data?.fit && (
        <FitBadge fit={data.fit} compact />
      )}

      {/* 2. Manual Badge (e.g. "Admissions Open" or "Dream/Match") */}
      {badge && (
        <div className="card-badge" style={{ backgroundColor: badge.color || '#6366f1' }}>
          {badge.text}
        </div>
      )}

      <div className="card-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div className="card-heading-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 className="card-full-name" title={data?.displayName || title || data?.name || data?.shortName}>
                {data?.displayName || title || data?.name || data?.shortName || "Unknown Institute"}
              </h3>
              {resolvedType === 'college' && (
                <TrustBadge 
                  source={data?.trustSource || data?.source || trust?.source} 
                  lastUpdated={data?.updatedAt || trust?.lastUpdated}
                />
              )}
              {data?.isCore && (
                <span 
                  title={`Core Institution: ${data?.coreMetadata?.institutionType || 'Target'}`}
                  style={{
                    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                    color: '#fff',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 4px rgba(245,158,11,0.2)'
                  }}
                >
                  <span style={{ fontSize: '0.7rem' }}>🏛️</span> CORE
                </span>
              )}
            </div>
            {data?.shortName && data.shortName !== title && !data?.displayName?.includes(`(${data.shortName})`) && (
              <span className="card-acronym">{data.shortName}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            {/* CEI Strength Badge */}
            {(data?.institutionStrengthScore > 0 || data?.ceiScore > 0) && (
              <div
                className="cc-cei-badge"
                title={`CEI Strength: ${data?.institutionStrengthScore || data?.ceiScore}`}
                style={{
                  position: 'relative',
                  background: (data?.institutionStrengthScore || data?.ceiScore) >= 75 ? 'linear-gradient(135deg, #1e1b4b, #312e81)' : 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
                  color: (data?.institutionStrengthScore || data?.ceiScore) >= 75 ? '#fbbf24' : '#64748b',
                  padding: '4px 8px',
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '54px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: (data?.institutionStrengthScore || data?.ceiScore) >= 75 ? '1.5px solid #fbbf24' : '1px solid #e2e8f0'
                }}
              >
                <div style={{ fontSize: '0.58rem', textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em', marginBottom: '1px' }}>
                  CEI Score
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.85rem', fontWeight: '800' }}>
                   {(data?.ceiScore)?.toFixed(2)}
                </div>

              </div>
            )}
            
            {isExam && props.userScore && (
              <div className="exam-meta-badges">
                <div className="user-score-badge">
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Your Score: {props.userScore}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Subtitle: Only show if there's room */}
        {subtitle && (
          <p className="card-subtitle" title={subtitle} style={{ WebkitLineClamp: 1, lineClamp: 1 }}>
            {subtitle}
          </p>
        )}

        {isScholarship && data?.deadline && (
          <div className="scholarship-status-badge mt-2">
            <span className="dot animate-pulse"></span>
            Apply by: {data.deadline}
          </div>
        )}
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
            m ? <span key={i}>{m}</span> : null
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
            {data?.website && (
              <a 
                href={data.website} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="icon-action-btn" 
                title="Official Website"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe size={16} />
              </a>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {data?.coverage?.coverageBucket && (
              <span
                title={`Data Coverage: ${data.coverage.coverageBucket} (${data.coverage.coverageScore}%)`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: data.coverage.coverageBucket === 'Rich' ? '#059669' :
                         data.coverage.coverageBucket === 'Partial' ? '#d97706' : '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  background: data.coverage.coverageBucket === 'Rich' ? 'rgba(5,150,105,0.08)' :
                              data.coverage.coverageBucket === 'Partial' ? 'rgba(217,119,6,0.08)' : 'rgba(148,163,184,0.1)',
                }}
              >
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: data.coverage.coverageBucket === 'Rich' ? '#059669' :
                               data.coverage.coverageBucket === 'Partial' ? '#d97706' : '#cbd5e1',
                  display: 'inline-block',
                }} />
                {data.coverage.coverageBucket}
              </span>
            )}
            <AddToChoiceButton college={collegeData} />
          </div>
        </div>
      )}

      {isExam && !props.hideFooter && (
        <div
          className="card-footer card-footer--exam"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="card-footer-left">
            {data.officialUrl && (
              <a 
                href={data.officialUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="icon-action-btn" 
                title="Official Website"
              >
                <Globe size={16} />
              </a>
            )}
            {data.pastPapers?.length > 0 && (
              <a 
                href={data.pastPapers[0].url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="icon-action-btn" 
                title="Past Papers"
              >
                <FileText size={16} />
              </a>
            )}
          </div>
          <a href={href} className="view-details-btn">
            View Details
          </a>
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

export default memo(Card);
