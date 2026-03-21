import React from 'react';
import { Shield, ExternalLink, Target, ArrowRightLeft, ShieldCheck, Award, Globe, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import './PrestigeHero.css';

/**
 * ExamPrestigeHero - Universal Data-Driven Framework
 */
const ExamPrestigeHero = ({ exam }) => {
    if (!exam) return null;

    const authority = exam.conductingBody || "National Testing Agency (NTA)";
    const examName = exam.name || "National Intelligence Assessment";
    const officialUrl = exam.officialUrl || "https://nta.ac.in";
    const maxScore = exam.totalMarks || "100";
    const scoreLabel = exam.type?.toLowerCase().includes('management') ? "Max Evaluation Score" : "Maximum Potential";

    return (
        <>
            {/* Command Bar */}
            <div className="dash-cmd-bar">
                <Link href="/exams" className="dash-back">
                    <ArrowLeftIcon size={16} /> Back to Search
                </Link>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 bg-white/5 text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all shadow-sm">
                        <ArrowRightLeft size={14} /> Pin to Compare
                    </button>
                    {exam.officialUrl && (
                        <a 
                            href={exam.officialUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-6 py-2 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-600/40 transition-all"
                        >
                            <ExternalLink size={14} /> Registration Portal
                        </a>
                    )}
                </div>
            </div>

            {/* Bento Grid */}
            <div className="bento-grid">
                <div className="bento-tile bento-identity">
                    <div className="college-brand">
                        <div className="logo-box">
                            <Target size={42} strokeWidth={2.5} color="#6366f1" />
                        </div>
                        <div className="brand-text">
                            <h1 className="hero-name-v5">{examName}</h1>
                            <div className="brand-meta">
                                <span className="univ-v5">
                                    <Globe size={12} /> {authority}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bento-signals">
                        <span className="b-sig evaluated">
                            <ShieldCheck size={13} strokeWidth={3} /> Official Data Partner
                        </span>
                        <span className="b-sig elite">
                            <Award size={13} strokeWidth={3} /> {exam.type || 'National'} Tier Exam
                        </span>
                    </div>
                </div>

                <div className="bento-tile bento-score">
                    <div className="sb-ring">
                        <div className="sb-val">{maxScore}</div>
                    </div>
                    <div className="sb-label">{scoreLabel}</div>
                    <p className="text-[10px] opacity-80 mt-3 font-semibold px-8 leading-relaxed uppercase tracking-wider text-center">
                        Verified {exam.shortName || 'Assessment'} framework for the {new Date().getFullYear() + 1} session.
                    </p>
                </div>
            </div>
        </>
    );
};

export default ExamPrestigeHero;
