import React from 'react';
import GlassPanel from './GlassPanel';
import Button from './Button';
import { ArrowRight, Sparkles, AlertCircle, Calendar, UserPlus } from 'lucide-react';
import Link from 'next/link';

const NextBestAction = ({ action }) => {
    if (!action) return null;

    const { actionKey, title, description, actionUrl, urgency, reason } = action;

    const getIcon = () => {
        switch (actionKey) {
            case 'COMPLETE_PROFILE': return <UserPlus className="text-blue-500" size={24} />;
            case 'URGENT_DEADLINE': return <AlertCircle className="text-red-500" size={24} />;
            case 'EXPLORE_COLLEGES': return <Sparkles className="text-purple-500" size={24} />;
            case 'ADD_SAFE_OPTIONS': return <Sparkles className="text-emerald-500" size={24} />;
            case 'ADD_SCORES': return <Sparkles className="text-orange-500" size={24} />;
            default: return <Sparkles className="text-indigo-500" size={24} />;
        }
    };

    return (
        <GlassPanel className="bento-card wide-action next-best-action-card">
            <div className="card-glint" />
            <div className="action-content">
                <div className="action-header">
                    <div className="action-icon-wrapper">
                        {getIcon()}
                    </div>
                    <div className="action-meta">
                        <span className={`urgency-badge ${urgency.toLowerCase()}`}>
                            {urgency} Priority
                        </span>
                        <div className="insight-pill">
                            <div className="ready-orb" />
                            <span>READY FOR ACTION</span>
                        </div>
                    </div>
                </div>
                
                <div className="action-text">
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>

                <div className="action-footer">
                    <Link href={actionUrl} className="w-full">
                        <Button className="w-full group action-btn-glow" variant={urgency === 'High' ? 'primary' : 'outline'}>
                            Take Action
                            <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </div>

            <style jsx>{`
                .next-best-action-card {
                    padding: 0;
                    overflow: hidden;
                }
                .action-content {
                    padding: 2rem;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .action-header {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    margin-bottom: 2rem;
                }
                .action-icon-wrapper {
                    width: 54px;
                    height: 54px;
                    border-radius: 16px;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 20px rgba(0,0,0,0.04);
                }
                .action-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .urgency-badge {
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    padding: 4px 10px;
                    border-radius: 6px;
                }
                .urgency-badge.high { background: #fee2e2; color: #ef4444; }
                .urgency-badge.medium { background: #ffedd5; color: #f59e0b; }
                .urgency-badge.low { background: #f3f4f6; color: #6b7280; }
                
                .insight-pill {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(99, 102, 241, 0.1);
                    color: #6366f1;
                    font-size: 0.75rem;
                    font-weight: 800;
                    padding: 4px 12px;
                    border-radius: 99px;
                    letter-spacing: 0.05em;
                }
                .ready-orb {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #6366f1;
                    animation: ready-pulse 1.5s infinite;
                }
                @keyframes ready-pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.6); opacity: 0.4; }
                    100% { transform: scale(1); opacity: 1; }
                }
                
                .action-text h3 {
                    font-family: var(--font-display);
                    font-size: 1.5rem;
                    font-weight: 900;
                    margin-bottom: 0.75rem;
                    letter-spacing: -0.02em;
                }
                .action-text p {
                    font-size: 0.95rem;
                    color: var(--color-text-secondary);
                    margin-bottom: 2.5rem;
                    line-height: 1.6;
                }
                .action-footer {
                    margin-top: auto;
                }
                :global(.action-btn-glow) {
                    box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
                }
            `}</style>
        </GlassPanel>
    );
};

export default NextBestAction;
