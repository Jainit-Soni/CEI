"use client";

import React from 'react';
import GlassPanel from './GlassPanel';
import { User, Mail, Shield, Target, MapPin, Wallet, Award, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function ProfileTab({ intelligence, loading }) {
    const { user } = useAuth();

    if (!user) return null;
    if (loading) return <div className="loading-skeleton profile-skeleton" />;

    // Use intelligence score from prop
    const completeness = intelligence?.completeness?.score || 0;
    const isReady = intelligence?.completeness?.isDecisionReady || false;

    const sections = [
        {
            title: "Identity Essentials",
            icon: <Shield size={20} className="text-indigo-500" />,
            fields: [
                { label: "Full Name", value: user.displayName || "Not set", icon: <User size={16} /> },
                { label: "Email Address", value: user.email, icon: <Mail size={16} /> },
            ]
        },
        {
            title: "Decision Parameters",
            icon: <Target size={20} className="text-amber-500" />,
            fields: [
                { label: "Target Course", value: user.targetCourse || "Not defined", icon: <Award size={16} /> },
                { label: "Category", value: user.category || "General", icon: <Shield size={16} /> },
            ]
        },
        {
            title: "Preferences",
            icon: <MapPin size={20} className="text-emerald-500" />,
            fields: [
                { label: "Preferred Regions", value: user.preferredStates?.join(", ") || "Anywhere", icon: <MapPin size={16} /> },
                { label: "Budget (Max)", value: user.budgetRange?.max ? `₹${user.budgetRange.max.toLocaleString()}` : "Not specified", icon: <Wallet size={16} /> },
            ]
        }
    ];

    return (
        <div className="profile-tab">
            {/* Identity HUD */}
            <GlassPanel className="identity-hud mb-8">
                <div className="hud-content">
                    <div className="hud-avatar-section">
                        <div className="large-avatar">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="Avatar" />
                            ) : (
                                <User size={48} className="text-indigo-400" />
                            )}
                            <div className="avatar-edit-overlay">
                                <span>Change Profile Picture</span>
                            </div>
                        </div>
                        <div className="hud-identity-text">
                            <h2>{user.displayName || "Academic Pioneer"}</h2>
                            <p className="hud-role">Student Aspirant • CEI Indexed</p>
                        </div>
                    </div>

                    <div className="hud-completeness">
                        <div className="completeness-dial">
                            <svg viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="45" className="dial-bg" />
                                <circle 
                                    cx="50" cy="50" r="45" 
                                    className="dial-progress" 
                                    strokeDasharray="283"
                                    strokeDashoffset={283 - (completeness / 100) * 283}
                                />
                            </svg>
                            <span className="completeness-value">{completeness}%</span>
                        </div>
                        <div className="completeness-text">
                            <h3>Identity Pulse</h3>
                            <p>{isReady ? "Decision Ready" : "Missing Critical Data"}</p>
                        </div>
                    </div>
                </div>
            </GlassPanel>

            <div className="profile-details-grid">
                {sections.map((section, idx) => (
                    <GlassPanel key={idx} className="details-card">
                        <div className="card-header">
                            {section.icon}
                            <h3>{section.title}</h3>
                        </div>
                        <div className="fields-list">
                            {section.fields.map((field, fIdx) => (
                                <div key={fIdx} className="field-item">
                                    <div className="field-label">
                                        {field.icon}
                                        <span>{field.label}</span>
                                    </div>
                                    <div className="field-value">{field.value}</div>
                                </div>
                            ))}
                        </div>
                    </GlassPanel>
                ))}
            </div>

            {/* Missing Data Warning */}
            {!isReady && (
                <GlassPanel className="status-alert warning mt-8">
                    <AlertCircle size={24} className="text-amber-500 mr-4" />
                    <div className="alert-content">
                        <h4>Intelligence Sparsity Detected</h4>
                        <p>We need more information to calibrate your Fit Scores. Please complete your profile parameters to unlock deep analysis.</p>
                    </div>
                    <button className="alert-action">
                        Update Preferences <ArrowUpRight size={16} />
                    </button>
                </GlassPanel>
            )}

            {isReady && (
                <GlassPanel className="status-alert success mt-8">
                    <CheckCircle2 size={24} className="text-emerald-500 mr-4" />
                    <div className="alert-content">
                        <h4>Identity Calibrated</h4>
                        <p>Your profile is 100% complete. All precision intelligence modules are currently synchronized with your personal goals.</p>
                    </div>
                </GlassPanel>
            )}

            <style jsx>{`
                .profile-tab {
                    animation: fadeIn 0.4s ease;
                }

                .profile-skeleton {
                    height: 400px;
                    border-radius: 32px;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .identity-hud {
                    padding: 32px;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05));
                }

                .hud-content {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 32px;
                }

                .hud-avatar-section {
                    display: flex;
                    align-items: center;
                    gap: 24px;
                }

                .large-avatar {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    border: 4px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
                }

                .large-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-edit-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s;
                    cursor: pointer;
                    padding: 8px;
                    text-align: center;
                }

                .avatar-edit-overlay span {
                    color: white;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .large-avatar:hover .avatar-edit-overlay {
                    opacity: 1;
                }

                .hud-identity-text h2 {
                    font-size: 2rem;
                    margin: 0;
                    font-family: var(--font-display);
                    color: var(--color-ink);
                }

                .hud-role {
                    color: var(--color-ink-secondary);
                    font-weight: 600;
                    font-size: 0.9rem;
                    margin-top: 4px;
                }

                .hud-completeness {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: rgba(255, 255, 255, 0.4);
                    padding: 12px 24px;
                    border-radius: 100px;
                    border: 1px solid rgba(255, 255, 255, 0.6);
                }

                .completeness-dial {
                    position: relative;
                    width: 50px;
                    height: 50px;
                }

                .dial-bg {
                    fill: none;
                    stroke: rgba(0, 0, 0, 0.05);
                    stroke-width: 8;
                }

                .dial-progress {
                    fill: none;
                    stroke: var(--color-primary);
                    stroke-width: 8;
                    stroke-linecap: round;
                    transform: rotate(-90deg);
                    transform-origin: center;
                    transition: stroke-dashoffset 0.8s ease;
                }

                .completeness-value {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: var(--color-ink);
                }

                .completeness-text h3 {
                    font-size: 0.85rem;
                    font-weight: 800;
                    margin: 0;
                }

                .completeness-text p {
                    font-size: 0.7rem;
                    color: var(--color-ink-muted);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .profile-details-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }

                .details-card {
                    padding: 24px;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .card-header h3 {
                    font-size: 0.95rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--color-ink);
                }

                .field-item {
                    margin-bottom: 16px;
                }

                .field-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--color-ink-muted);
                    margin-bottom: 4px;
                }

                .field-value {
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: var(--color-ink);
                    padding-left: 24px;
                }

                .status-alert {
                    display: flex;
                    align-items: center;
                    padding: 24px;
                }

                .alert-content {
                    flex: 1;
                }

                .alert-content h4 {
                    font-size: 1rem;
                    font-weight: 800;
                    margin-bottom: 4px;
                }

                .alert-content p {
                    font-size: 0.85rem;
                    color: var(--color-ink-secondary);
                }

                .alert-action {
                    background: white;
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    padding: 10px 18px;
                    border-radius: 99px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .alert-action:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                    transform: translateX(4px);
                }

                @media (max-width: 1024px) {
                    .profile-details-grid {
                        grid-template-columns: 1fr;
                    }
                    .hud-content {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                }
            `}</style>
        </div>
    );
}
