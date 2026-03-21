"use client";

import { useState, useMemo } from "react";
import { 
    Calendar, BookOpen, FileText, CheckCircle2, 
    Target, Layout, Award, Shield, Clock, ExternalLink,
    Building2, BarChart3, Globe, Zap, GraduationCap, History,
    ShieldCheck, Search, Info, Download, Book, Youtube, Flame, Play,
    Check
} from "lucide-react";
import { resourceRegistry } from "../utils/resourceRegistry";
import { API_BASE } from "../lib/api";
import "./ExamTabs.css";

export default function ExamTabs({ exam, colleges = [] }) {
    const [activeTab, setActiveTab] = useState("overview");
    const [visiblePapersCount, setVisiblePapersCount] = useState(12);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        if (tabId !== "resources") setVisiblePapersCount(12);
    };

    if (!exam) return null;

    // Resolve Resources from Global Registry
    const examKey = exam.id?.toLowerCase();
    const registryData = resourceRegistry[examKey] || null;

    const examMetadata = {
        conductingBody: exam.conductingBody || "National Testing Agency (NTA)",
        registration: {
            start: exam.dates?.registration || "Information Pending",
            end: exam.dates?.registrationClosing || "Information Pending",
            fee: exam.stats?.fee || "See Official Portal"
        },
        timeline: {
            current: exam.dates?.examWindow || "Active Session",
            lastYear: "Previous Cycle Complete",
            resultDate: exam.dates?.result || "TBA"
        }
    };

    // Syllabus Data normalization
    const syllabusEntries = useMemo(() => {
        if (!exam.syllabus) return null;
        if (Array.isArray(exam.syllabus)) return { "Core Protocol": exam.syllabus };
        return exam.syllabus;
    }, [exam.syllabus]);

    const tabs = [
        { id: "overview", label: "Overview & Registration" },
        { id: "syllabus", label: "Syllabus & Protocol" },
        { id: "timeline", label: "Timeline & History" },
        { id: "resources", label: "Resource Hub (Premium)" },
        { id: "colleges", label: "Accepting Colleges" }
    ];

    return (
        <div style={{ width: '100%' }}>
            
            {/* 1. COMPACT TAB NAVIGATION */}
            <div className="dash-tabs-wrapper">
                <div className="dash-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`d-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. HIGH-DENSITY CONTENT VIEWPORT */}
            <div className="dash-viewport animate-fade-in" style={{ marginTop: '0px' }}>
                
                {activeTab === "overview" && (
                    <div className="overview-grid-v7">
                        <div className="overview-main-v7">
                            <h3 className="tab-heading">Execution Framework</h3>
                            <p className="tab-description-v7" style={{ marginBottom: '24px' }}>
                                {exam.name} is the <strong>national gateway</strong> for elite {exam.type} immersion. 
                                Evaluated by {examMetadata.conductingBody}, it benchmarks candidates across multiple high-stakes intelligence layers.
                            </p>

                            <div className="foundation-grid-v7">
                                <div className="foundation-box-v7">
                                    <div className="flex items-center gap-2 mb-1">
                                        <History size={16} className="text-slate-400" />
                                        <span className="fb-label">REGISTRATION STARTS</span>
                                    </div>
                                    <span className="fb-value text-indigo-600 font-black">{examMetadata.registration.start}</span>
                                </div>
                                <div className="foundation-box-v7">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Flame size={16} className="text-orange-400" />
                                        <span className="fb-label">REGISTRATION ENDS</span>
                                    </div>
                                    <span className="fb-value">{examMetadata.registration.end}</span>
                                </div>
                                <div className="foundation-box-v7">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Target size={16} className="text-slate-400" />
                                        <span className="fb-label">APPLICATION FEE</span>
                                    </div>
                                    <span className="fb-value">{examMetadata.registration.fee}</span>
                                </div>
                                <div className="foundation-box-v7">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Building2 size={16} className="text-slate-400" />
                                        <span className="fb-label">AUTHORITY</span>
                                    </div>
                                    <span className="fb-value truncate">{examMetadata.conductingBody}</span>
                                </div>
                            </div>
                        </div>

                        <div className="program-inventory-v7">
                            <div className="pi-header-v7">
                                <h3 className="tab-heading">Quick Protocol</h3>
                                <div className="pi-count-v7">Live Sync</div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {[
                                    { k: "Mode", v: exam.stats?.mode || "Online CBT" },
                                    { k: "Duration", v: exam.stats?.duration || "180 Mins" },
                                    { k: "Official Site", v: (new URL(exam.officialUrl || "https://google.com")).hostname }
                                ].map((item, i) => (
                                    <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-50 rounded-2xl">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.k}</span>
                                        <span className="text-sm font-bold text-slate-700">{item.v}</span>
                                    </div>
                                ))}
                                <a href={exam.officialUrl} target="_blank" className="flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all mt-2">
                                    <Globe size={14} /> Visit Official Portal
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "syllabus" && (
                    <div className="space-y-12">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-8">
                            <div>
                                <h3 className="tab-heading">Syllabus & Core Protocol</h3>
                                <p className="text-slate-400 font-bold text-xs mt-2 uppercase tracking-widest">Sectional Breakdown for {exam.shortName}</p>
                            </div>
                            <div className="pi-count-v7">Elite Benchmarked</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {syllabusEntries ? (
                                Object.entries(syllabusEntries).map(([sector, topics]) => (
                                    <div key={sector} className="foundation-box-v7">
                                        <div className="flex items-center gap-2 mb-3">
                                            <BookOpen size={18} className="text-indigo-500" />
                                            <span className="fb-value text-lg">{sector}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.isArray(topics) ? topics.map((t, i) => (
                                                <span key={i} className="text-[10px] font-black bg-slate-50 text-slate-500 border border-slate-100 px-3 py-1.5 rounded-lg uppercase tracking-wider">
                                                    {t}
                                                </span>
                                            )) : (
                                                <span className="text-xs text-slate-600 font-medium leading-relaxed">{topics}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full py-20 text-center foundation-box-v7 border-dashed">
                                    <Info size={40} className="text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syllabus Matrix Under Review</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "timeline" && (
                    <div className="space-y-12">
                        <h3 className="tab-heading">Historical & Future Benchmarks</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="foundation-box-v7 bg-indigo-50/30 border-indigo-100">
                                <span className="fb-label text-indigo-500 mb-2">Upcoming Session 2026</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-black text-indigo-900">{examMetadata.timeline.current}</span>
                                    <span className="pmc-tag">Projected</span>
                                </div>
                                <p className="text-xs font-bold text-indigo-400 mt-4 uppercase tracking-widest">Expected Result: {examMetadata.timeline.resultDate}</p>
                            </div>
                            <div className="foundation-box-v7 bg-slate-50/50">
                                <span className="fb-label mb-2">Last Year Reference (2025)</span>
                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-black text-slate-400">{examMetadata.timeline.lastYear}</span>
                                    <span className="pmc-tag bg-slate-200 text-slate-500 border-none">Archived</span>
                                </div>
                                <p className="text-xs font-bold text-slate-300 mt-4 uppercase tracking-widest">Note: Date varied due to NTA scheduling</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "resources" && (
                    <div className="space-y-16">
                        
                        {/* 1. Pedagogy Grid (YouTube) */}
                        <div className="pedagogy-section">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="tab-heading">Elite Pedagogy</h3>
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Verified Expert Video Modules</p>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 rounded-full border border-red-100">
                                    <Youtube size={14} className="text-red-500" />
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">4K Playback</span>
                                </div>
                            </div>

                            <div className="resource-grid-v7">
                                {registryData?.videos ? registryData.videos.map((res, i) => (
                                    <a href={res.url} target="_blank" key={i} className="res-card-v7 group">
                                        <div className="res-thumbnail-v7">
                                            <div className="res-play-overlay">
                                                <Play size={24} fill="white" className="text-white" />
                                            </div>
                                            <img src={`https://img.youtube.com/vi/${res.id}/mqdefault.jpg`} alt="YT" className="w-full h-full object-cover rounded-xl" />
                                            <div className="res-duration-v7">{res.duration || '12:00'}</div>
                                        </div>
                                        <div className="p-4">
                                            <h4 className="font-black text-slate-800 text-sm leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2 mb-2">{res.title}</h4>
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Channel: {res.channel}</span>
                                                <Check size={12} className="text-emerald-500" />
                                            </div>
                                        </div>
                                    </a>
                                )) : (
                                    <div className="col-span-full p-20 text-center foundation-box-v7 border-dashed">
                                        <Youtube size={32} className="text-slate-200 mx-auto mb-3" />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Registry Under Development</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Intelligence archives (Papers) */}
                        <div className="archives-section">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="tab-heading">Intelligence Archives</h3>
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Direct Database Downloads</p>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                                    <Download size={14} className="text-emerald-500" />
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">CEI INTERNAL ASSET</span>
                                </div>
                            </div>

                            <div className="resource-grid-v7">
                                {(() => {
                                    const allPapers = exam.papers && exam.papers.length > 0 ? exam.papers : (registryData?.papers || []);
                                    const visiblePapers = allPapers.slice(0, visiblePapersCount);
                                    const hasMorePapers = visiblePapersCount < allPapers.length;

                                    return (
                                        <>
                                            {visiblePapers.map((paper, i) => {
                                                // Normalize for both backend and legacy (registry) format
                                                const isBackend = !!paper.downloadUrl;
                                                const downloadUrl = isBackend ? `${API_BASE}${paper.downloadUrl}` : paper.url;
                                                const title = paper.title || `${paper.year} Exam Paper`;
                                                const sizeLabel = paper.fileSizeBytes ? `${(paper.fileSizeBytes / 1024 / 1024).toFixed(1)} MB` : "PDF • 3.4 MB";
                                                const isOfficial = paper.isOfficial || paper.isDirect;

                                                return (
                                                    <a 
                                                        href={downloadUrl} 
                                                        download={`${examKey}_paper_${paper.year}.pdf`}
                                                        target="_blank" 
                                                        key={i} 
                                                        className="paper-card-v7 group"
                                                    >
                                                        <div className="p-4 flex flex-col justify-between h-full">
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                                                    <FileText size={20} />
                                                                </div>
                                                                {isOfficial && (
                                                                    <div className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded uppercase tracking-widest">Official</div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-slate-800 text-sm group-hover:text-emerald-600 transition-colors uppercase tracking-tight line-clamp-2">{title}</h4>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                                    {paper.year} • {paper.paperType?.replace('_', ' ') || 'QUESTION PAPER'}
                                                                </p>
                                                                {paper.shift && (
                                                                    <p className="text-[8px] font-bold text-indigo-400 uppercase mt-0.5">{paper.shift}</p>
                                                                )}
                                                            </div>
                                                            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                                                <span className="text-[9px] font-black text-slate-300 uppercase">{sizeLabel}</span>
                                                                <Download size={14} className="text-slate-200 group-hover:text-emerald-500 transition-colors" />
                                                            </div>
                                                        </div>
                                                    </a>
                                                );
                                            })}
                                            
                                            {hasMorePapers && (
                                                <div className="col-span-full flex justify-center mt-6">
                                                    <button 
                                                        onClick={() => setVisiblePapersCount(prev => prev + 12)}
                                                        className="flex items-center gap-2 px-8 py-3 bg-white hover:bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-widest rounded-full transition-colors border border-slate-200 shadow-sm"
                                                    >
                                                        Show More Archives ({allPapers.length - visiblePapersCount} remaining)
                                                    </button>
                                                </div>
                                            )}

                                            {allPapers.length === 0 && (
                                                <div className="col-span-full p-20 text-center foundation-box-v7 border-dashed">
                                                    <FileText size={32} className="text-slate-200 mx-auto mb-3" />
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Archives Being Internalized</p>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "colleges" && (
                    <div className="space-y-12">
                        <div className="flex justify-between items-center">
                            <h3 className="tab-heading">Accepting Institutions</h3>
                            <div className="pi-count-v7">{colleges.length} Verified Nodes</div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {colleges.length > 0 ? colleges.map((col) => (
                                <div key={col.id} className="program-mini-card">
                                    <div className="pmc-name">{col.name}</div>
                                    <div className="pmc-footer">
                                        <span className="pmc-tag">{col.location || "National"}</span>
                                        <span className="pmc-tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                                            {col.ceiScore || 9.2} CEI
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-20 text-center foundation-box-v7 border-dashed">
                                    <Search size={40} className="text-slate-200 mx-auto mb-4" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No Nodes Indexed</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
