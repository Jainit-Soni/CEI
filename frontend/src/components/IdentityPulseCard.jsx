import React from 'react';
import GlassPanel from './GlassPanel';
import { ShieldCheck, User, Sparkles, Binary } from 'lucide-react';

const IdentityPulseCard = ({ user, intelligence, loading }) => {
    const completeness = intelligence?.identityPulse?.completeness || 0;
    const isEvaluated = true; // Hardcoded for this student persona

    return (
        <GlassPanel className="bento-card large-pulse identity-pulse-card">
            <div className="pulse-orb" />
            <div className="card-glint" />
            
            <div className="pulse-content">
                <div className="pulse-header">
                    <div className="evaluated-badge">
                        <ShieldCheck size={18} className="text-emerald-500" />
                        <span>CEI Indexed</span>
                    </div>
                    <div className="live-sync">
                        <div className="sync-dot" />
                        <span>AI SYNC ACTIVE</span>
                    </div>
                </div>

                <div className="pulse-body">
                    <div className="profile-snapshot">
                        <div className="pulse-avatar">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="User Avatar" />
                            ) : (
                                <div className="avatar-placeholder">
                                    <User size={32} />
                                </div>
                            )}
                            <div className="pulse-ring" />
                        </div>
                        <div className="profile-text">
                            <h2>{user?.displayName || 'Student'}</h2>
                            <div className="elite-badge-row">
                                <span className="elite-role">Student Aspirant</span>
                                <span className="elite-batch">Batch 2026</span>
                            </div>
                        </div>
                    </div>

                    <div className="completeness-module">
                        <div className="completeness-header">
                            <Binary size={14} className="text-indigo-500" />
                            <span>Your Identity Score</span>
                            <span className="percent">{completeness}%</span>
                        </div>
                        <div className="progress-track">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${completeness}%` }}
                            />
                        </div>
                        <p className="pulse-insight">
                            {completeness < 100 
                                ? "Complete your profile to unlock precision matching."
                                : "Identity pulse is optimal. Precision matching active."}
                        </p>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .identity-pulse-card {
                    padding: 0;
                    overflow: hidden;
                }
                .pulse-content {
                    padding: 2rem;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .evaluated-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: rgba(16, 185, 129, 0.1);
                    padding: 0.25rem 0.75rem;
                    border-radius: 99px;
                    width: fit-content;
                }
                .evaluated-badge span {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #059669;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .live-sync {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: var(--color-primary);
                    letter-spacing: 0.08em;
                }
                .sync-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: var(--color-primary);
                    animation: pulse-dot 1.5s infinite;
                }
                @keyframes pulse-dot {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.5); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }
                .elite-badge-row {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                    margin-top: 0.25rem;
                }
                .elite-role {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--color-text-tertiary);
                }
                .elite-batch {
                    font-size: 0.75rem;
                    font-weight: 800;
                    padding: 0.15rem 0.5rem;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    border-radius: 6px;
                    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
                }
                .profile-snapshot {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }
                .pulse-avatar {
                    position: relative;
                    width: 70px;
                    height: 70px;
                }
                .pulse-avatar img, .avatar-placeholder {
                    width: 100%;
                    height: 100%;
                    border-radius: 20px;
                    object-fit: cover;
                }
                .avatar-placeholder {
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6366f1;
                }
                .pulse-ring {
                    position: absolute;
                    inset: -4px;
                    border-radius: 24px;
                    border: 2px solid rgba(99, 102, 241, 0.2);
                    animation: pulse-border 3s infinite;
                }
                @keyframes pulse-border {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.1); opacity: 0; }
                }
                .profile-text h2 {
                    font-family: var(--font-display);
                    font-size: 1.75rem;
                    font-weight: 950;
                    margin: 0;
                    letter-spacing: -0.02em;
                    color: var(--color-text-primary);
                }
                .profile-text p {
                    font-size: 0.95rem;
                    color: var(--color-text-tertiary);
                    margin: 0;
                    font-weight: 600;
                }
                .completeness-module {
                    background: rgba(255, 255, 255, 0.3);
                    padding: 1.5rem;
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(10px);
                }
                .completeness-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.85rem;
                    font-weight: 800;
                    margin-bottom: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .completeness-header .percent {
                    margin-left: auto;
                    color: var(--color-primary);
                    font-size: 1rem;
                }
                .progress-track {
                    height: 10px;
                    background: rgba(0,0,0,0.05);
                    border-radius: 5px;
                    overflow: hidden;
                    margin-bottom: 1rem;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #6366f1, #2dd4bf, #6366f1);
                    background-size: 200% 100%;
                    animation: progress-glow 3s linear infinite;
                    border-radius: 5px;
                    transition: width 1.5s cubic-bezier(0.19, 1, 0.22, 1);
                }
                @keyframes progress-glow {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                }
                .pulse-insight {
                    font-size: 0.85rem;
                    color: var(--color-text-secondary);
                    margin: 0;
                    font-weight: 500;
                    opacity: 0.9;
                }
            `}</style>
        </GlassPanel>
    );
};

export default IdentityPulseCard;
