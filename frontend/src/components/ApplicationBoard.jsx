"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Trash2, GripVertical, FileText, Download, Cloud, CloudOff, Share2, Copy, Check, Loader2, Sparkles } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { fetchUserChoices, saveUserChoices, shareUserChoices } from "@/lib/api";
import AuthModal from "./AuthModal";
import GlassPanel from "./GlassPanel";
import "../app/dashboard/dashboard.css";

export default function ApplicationBoard() {
    const [items, setItems] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [shareUrl, setShareUrl] = useState("");
    const [isSharing, setIsSharing] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const { user } = useAuth();

    // Core Ref for Glass Popover
    const shareRef = useRef(null);

    // Handle Click Outside for Popover
    useEffect(() => {
        function handleClickOutside(event) {
            if (shareRef.current && !shareRef.current.contains(event.target)) {
                setShareUrl("");
            }
        }

        if (shareUrl) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [shareUrl]);
    // Load from LocalStorage on Mount
    useEffect(() => {
        const stored = localStorage.getItem("choice-filling-cart");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                }
            } catch (e) {
                console.error("Failed to parse choice-filling-cart", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Cloud Sync Logic
    useEffect(() => {
        if (!isLoaded || !user) return;

        const syncData = async () => {
            setIsSyncing(true);
            try {
                const cloudChoices = await fetchUserChoices(user.uid);
                const localStored = localStorage.getItem("choice-filling-cart");
                const localItems = localStored ? JSON.parse(localStored) : [];

                if (localItems.length > 0) {
                    // Local data takes precedence (Zombie Fix)
                    // If local exists, we push to cloud to ensure cloud matches local reality
                    await saveUserChoices(user.uid, localItems);
                    setItems(localItems);
                } else if (cloudChoices && cloudChoices.length > 0) {
                    // Only fetch from cloud if local is empty (New Device Scenario)
                    setItems(cloudChoices);
                    localStorage.setItem("choice-filling-cart", JSON.stringify(cloudChoices));
                }
            } catch (err) {
                console.error("Sync failed:", err);
            } finally {
                setIsSyncing(false);
            }
        };

        syncData();
    }, [user?.uid, isLoaded]);

    // Persist to LocalStorage whenever items change
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem("choice-filling-cart", JSON.stringify(items));
        window.dispatchEvent(new Event("local-storage-update"));

        // Periodic Cloud Save (if logged in)
        if (user) {
            const timer = setTimeout(() => {
                saveUserChoices(user.uid, items).catch(console.error);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [items, isLoaded, user]);

    const removeItem = async (id) => {
        const newItems = items.filter(item => item.id !== id);
        setItems(newItems);
        // Immediate sync to prevent zombie items
        if (user) {
            try {
                await saveUserChoices(user.uid, newItems);
            } catch (err) {
                console.error("Failed to sync removal:", err);
            }
        }
    };

    const clearAll = async () => {
        if (window.confirm("Are you sure you want to clear your entire selection list? This cannot be undone.")) {
            setItems([]);
            if (user) {
                await saveUserChoices(user.uid, []);
            }
        }
    };

    const onDragEnd = (result) => {
        if (!result.destination) return;

        const newItems = Array.from(items);
        const [reorderedItem] = newItems.splice(result.source.index, 1);
        newItems.splice(result.destination.index, 0, reorderedItem);

        setItems(newItems);
    };

    const exportPDF = (e) => {
        if (e && e.preventDefault) e.preventDefault();

        // Auth Guard
        if (!user) {
            setShowAuthModal(true);
            return;
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;

        // PDF Implementation (Restoring the gorgeous design)
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageWidth, 2, 'F');

        doc.setFontSize(14);
        doc.setTextColor(37, 99, 235);
        doc.setFont("helvetica", "bold");
        doc.text("CEI", 20, 25);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.text("INTELLIGENCE", 30, 25);

        doc.setFontSize(48);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text("Strategic", 20, 85);
        doc.text("Priority List", 20, 102);

        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(2);
        doc.line(20, 112, 55, 112);

        doc.setFontSize(14);
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "normal");
        doc.text("STRATEGIC ADMISSIONS & ROI ANALYSIS", 20, 125);

        // Body Content
        const tableData = items.map((item, index) => [
            `${index + 1}`,
            item.name || item.shortName,
            item.tuition || item.fees || "See Website",
            (item.placements?.averagePackage || "High").toString().replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " "), // Remove non-ASCII/superscripts
            (item.acceptedExams || []).map(e => (typeof e === 'object' ? (e.code || e.name) : e)).join(", ")
        ]);

        // Add premium blue side-stripe
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 8, doc.internal.pageSize.height, 'F');

        autoTable(doc, {
            startY: 140,
            margin: { left: 20 },
            margin: { left: 20 },
            head: [['Sr No.', 'Institution', 'EST. TUITION', 'AVG Pkg', 'Key Exams']],
            body: tableData,
            theme: 'striped',
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 65 },
                2: { cellWidth: 30 },
                3: { cellWidth: 30 },
                4: { cellWidth: 'auto' }
            }
        });

        doc.save(`CEI_Strategic_Priority_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleShare = async () => {
        if (!items || items.length === 0) {
            alert("Your list is empty. Add some colleges first!");
            return;
        }
        setIsSharing(true);
        try {
            console.log("Generating share link...");
            const { shareId } = await shareUserChoices(items, user?.displayName || "Anonymous Student");
            if (shareId) {
                const url = `${window.location.origin}/share/${shareId}`;
                setShareUrl(url);
            } else {
                throw new Error("No share ID returned");
            }
        } catch (err) {
            console.error("Sharing failed", err);
            alert("Failed to generate share link. Please try again or check your connection.");
        } finally {
            setIsSharing(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    if (!isLoaded) return null;

    if (items.length === 0) {
        return (
            <div className="mylist-empty">
                <div className="empty-icon">🎓</div>
                <h3>Your list is empty</h3>
                <p>Start exploring colleges and add them to your list to track them here.</p>
                <Link href="/colleges" className="btn-browse">
                    Browse Colleges
                </Link>
            </div>
        );
    }

    return (
        <div className="application-board">
            <div className="board-header">
                <div className="board-info">
                    <h2>Priority Roadmap</h2>
                    <p className="subtitle">
                        Drag to reorder your selections and export your strategic report 📑
                    </p>
                </div>
                <div className="board-actions">
                    <button className="btn-clear-list" onClick={clearAll}>Clear All</button>

                    <button className="btn-download-report" onClick={exportPDF}>
                        <Download size={18} />
                        <span>Export PDF</span>
                    </button>

                    {/* SHARE BUTTON & POPOVER ANCHOR */}
                    <div className="relative" ref={shareRef}>
                        <button
                            className={`btn-share-roadmap ${shareUrl ? 'active' : ''}`}
                            onClick={handleShare}
                            disabled={isSharing}
                        >
                            {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                            <span>{isSharing ? 'Generating...' : 'Share Roadmap'}</span>
                        </button>

                        {/* PREMIUM GLASS POPOVER (Phase 19 Pivot) */}
                        <AnimatePresence>
                            {shareUrl && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                    className="absolute right-0 top-full mt-4 z-[100] w-[340px] sm:w-[420px]"
                                >
                                    <GlassPanel variant="subtle" className="!p-5 !rounded-3xl border-indigo-100/60 bg-white/95 backdrop-blur-2xl shadow-[0_20px_40px_-15px_rgba(79,70,229,0.2)]">

                                        {/* Header */}
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-10 h-10 shrink-0 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                                                <Sparkles className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-slate-800 tracking-tight leading-tight" style={{ fontFamily: 'var(--font-display)' }}>Share Access</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">Read-only link generated.</p>
                                            </div>
                                        </div>

                                        {/* Pill-Shaped Link Box */}
                                        <div className="flex items-center p-1.5 rounded-[1.25rem] bg-slate-50 border border-slate-200 focus-within:border-indigo-400 focus-within:ring-[3px] focus-within:ring-indigo-100 transition-all">
                                            <div className="flex-1 px-3 overflow-hidden">
                                                <div className="truncate text-xs font-semibold text-slate-600">
                                                    {shareUrl}
                                                </div>
                                            </div>

                                            <button
                                                onClick={copyToClipboard}
                                                className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shrink-0
                                                    ${copySuccess
                                                        ? 'bg-green-500 text-white shadow-md shadow-green-200'
                                                        : 'bg-slate-900 text-white hover:bg-black shadow-md shadow-slate-200'
                                                    }
                                                `}
                                            >
                                                {copySuccess ? <Check size={14} /> : <Copy size={14} />}
                                                <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    </GlassPanel>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            <div className="board-content">
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="colleges">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="colleges-list">
                                {items.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`college-row-card ${snapshot.isDragging ? 'dragging' : ''}`}
                                            >
                                                <div {...provided.dragHandleProps} className="drag-handle">
                                                    <GripVertical size={20} />
                                                    <span className="rank-num">#{index + 1}</span>
                                                </div>

                                                <div className="college-main-modern">
                                                    <div className="report-header">
                                                        <div className="identity">
                                                            <h3 className="name">{item.name || item.shortName}</h3>
                                                            <p className="loc">{item.location}</p>
                                                        </div>
                                                        <div className="tier-badge">
                                                            Strategic Choice: {item.rankingTier && item.rankingTier.toString().toLowerCase().includes('tier') ? item.rankingTier : `Tier ${item.rankingTier || "1"}`}
                                                        </div>
                                                    </div>

                                                    <div className="report-details-grid">
                                                        <div className="detail-item">
                                                            <span className="label">EST. TUITION</span>
                                                            <span className="value">{item.tuition || "See Website"}</span>
                                                        </div>
                                                        <div className="detail-item">
                                                            <span className="label">AVG PACKAGE</span>
                                                            <span className="value green">{item.placements?.averagePackage || "High ROI"}</span>
                                                        </div>
                                                        <div className="detail-item full-width">
                                                            <span className="label">KEY EXAMS</span>
                                                            <span className="value">
                                                                {(item.acceptedExams || []).map(e => (typeof e === 'object' ? (e.code || e.name) : e)).join(", ") || "CAT, CMAT"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="row-actions-modern">
                                                        <Link href={`/college/${item.id}`} className="action-btn-mini" title="View Details">
                                                            <FileText size={16} /> Details
                                                        </Link>
                                                        <button
                                                            className="action-btn-mini remove"
                                                            onClick={() => removeItem(item.id)}
                                                            title="Remove"
                                                        >
                                                            <Trash2 size={16} /> Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </div>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />


            <style jsx>{`
                .application-board {
                    padding: 20px 0;
                }
                .board-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    padding: 24px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    box-shadow: var(--shadow-sm);
                }
                .board-info h2 { 
                    font-family: var(--font-display);
                    font-size: 1.5rem;
                    margin-bottom: 4px;
                }
                .subtitle { color: #64748b; font-size: 0.95rem; }
                .board-actions { display: flex; gap: 12px; }
                
                .btn-download-report {
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-download-report:hover { transform: translateY(-2px); background: #1d4ed8; }

                .btn-share-roadmap {
                    background: #f8fafc;
                    color: #1e3a8a;
                    border: 1px solid #e2e8f0;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-share-roadmap:hover { border-color: #2563eb; background: white; }

                .btn-clear-list {
                    background: #f1f5f9;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                }

                .college-row-card {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 0;
                    margin-bottom: 24px;
                    display: flex;
                    overflow: hidden;
                    transition: all 0.2s;
                }
                .college-row-card.dragging { box-shadow: var(--shadow-lg); border-color: #2563eb; }

                
                /* Large Drag Handle */
                .drag-handle {
                    width: 60px;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    cursor: grab;
                    border-right: 1px solid #f1f5f9;
                    transition: background 0.2s;
                }
                .drag-handle:hover { background: #f1f5f9; color: #64748b; }
                .rank-num { font-weight: 800; color: #1e3a8a; font-size: 1.1rem; margin-top: 4px; }

                /* Mobile Optimizations */
                @media (max-width: 768px) {
                    .drag-handle {
                        width: 100%;
                        height: 48px; /* Taller touch target */
                        flex-direction: row;
                        border-right: none;
                        border-bottom: 1px solid #f1f5f9;
                        gap: 12px;
                        background: #f8fafc;
                    }
                    .drag-handle:active { background: #e2e8f0; cursor: grabbing; }
                    
                    /* Prevent text selection while dragging */
                    .college-row-card { user-select: none; -webkit-user-select: none; }
                }

                .report-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    gap: 16px;
                }
                .identity .name { font-size: 1.4rem; font-weight: 800; color: #1e3a8a; margin: 0 0 4px; }
                .identity .loc { color: #64748b; font-size: 1rem; margin: 0; }

                .tier-badge {
                    background: #eff6ff;
                    color: #2563eb;
                    padding: 6px 16px;
                    border-radius: 99px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    white-space: nowrap;
                }

                .report-details-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .detail-item.full-width { grid-column: span 2; }
                .detail-item .label { font-size: 0.65rem; font-weight: 800; color: #94a3b8; letter-spacing: 0.05em; }
                .detail-item .value { font-size: 1.1rem; font-weight: 700; color: #1e293b; }
                .detail-item .value.green { color: #059669; }

                .row-actions-modern {
                    display: flex;
                    gap: 12px;
                    padding-top: 20px;
                    border-top: 1px solid #f1f5f9;
                }
                .action-btn-mini {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    text-decoration: none;
                    background: #f1f5f9;
                    color: #475569;
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .action-btn-mini:hover { background: #e2e8f0; }
                .action-btn-mini.remove:hover { background: #fef2f2; color: #ef4444; }

                /* Responsive Board Header */
                @media (max-width: 768px) {
                    .board-header {
                        flex-direction: column;
                        gap: 20px;
                        padding: 20px;
                        text-align: center;
                    }

                    .board-info {
                        width: 100%;
                    }

                    .board-actions {
                        width: 100%;
                        display: grid;
                        grid-template-columns: 1fr; /* Stack buttons vertically */
                        gap: 12px;
                    }

                    .btn-download-report, 
                    .btn-share-roadmap, 
                    .btn-clear-list {
                        justify-content: center;
                        width: 100%;
                    }
                }

                @media (max-width: 768px) {
                    .college-row-card {
                        flex-direction: column;
                        position: relative;
                        padding-left: 0;
                        height: auto;
                    }
                    .drag-handle {
                        width: 100%;
                        height: 36px;
                        flex-direction: row;
                        border-right: none;
                        border-bottom: 1px solid #f1f5f9;
                        gap: 8px;
                    }
                    .rank-num { margin-top: 0; font-size: 0.9rem; }
                    
                    .college-main-modern { padding: 16px; }

                    .report-header { 
                        flex-direction: column; 
                        align-items: flex-start; 
                        gap: 8px;
                    }
                    
                    .report-details-grid { 
                        grid-template-columns: 1fr; 
                        gap: 12px;
                    }
                    .detail-item.full-width { grid-column: auto; }

                    .row-actions-modern {
                        flex-direction: column;
                        width: 100%;
                        gap: 8px;
                    }
                    .action-btn-mini {
                        justify-content: center;
                        width: 100%;
                        padding: 12px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                    }
                }

                .mylist-empty {
                    text-align: center;
                    padding: 80px 20px;
                    background: white;
                    border-radius: 24px;
                    border: 2px dashed #e2e8f0;
                }
                .empty-icon { font-size: 4rem; margin-bottom: 16px; }
                .btn-browse {
                    display: inline-block;
                    margin-top: 20px;
                    background: #2563eb;
                    color: white;
                    padding: 12px 32px;
                    border-radius: 999px;
                    font-weight: 600;
                    text-decoration: none;
                }
                .share-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(248, 250, 252, 0.4);
                    backdrop-filter: blur(12px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }
                .share-modal-glass {
                    animation: modal-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes modal-enter {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .btn-share-roadmap.active {
                    background: #e0e7ff;
                    border-color: #818cf8;
                    color: #4338ca;
                }
            `}</style>
        </div>
    );
}
