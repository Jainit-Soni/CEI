"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Trash2, GripVertical, FileText, Download, Cloud, CloudOff, Share2, Copy, Check } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuth } from "@/lib/AuthContext";
import { fetchUserChoices, saveUserChoices, shareUserChoices } from "@/lib/api";
import AuthModal from "./AuthModal";
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

                if (cloudChoices && cloudChoices.length > 0) {
                    // Cloud wins if it has data
                    setItems(cloudChoices);
                } else if (items.length > 0) {
                    // If cloud is empty but local has data, push local to cloud
                    await saveUserChoices(user.uid, items);
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

    const removeItem = (id) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const clearAll = () => {
        if (window.confirm("Are you sure you want to clear your entire selection list? This cannot be undone.")) {
            setItems([]);
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
            head: [['Sr No.', 'Institution', 'EST. TUITION', 'AVG Pkg', 'Key Exams']],
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
        if (!items || items.length === 0) return;
        setIsSharing(true);
        try {
            const { shareId } = await shareUserChoices(items, user?.displayName || "Anonymous Student");
            const url = `${window.location.origin}/share/${shareId}`;
            setShareUrl(url);
        } catch (err) {
            console.error("Sharing failed", err);
            alert("Failed to generate share link. Please try again.");
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
                        {items.length} {items.length === 1 ? "Institution" : "Institutions"} Selected •
                        {user ? (
                            <span style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
                                <Cloud size={14} style={{ marginBottom: -2, marginRight: 4 }} />
                                Sync: Active
                            </span>
                        ) : (
                            <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>
                                <CloudOff size={14} style={{ marginBottom: -2, marginRight: 4 }} />
                                Sync: Guest Mode
                            </span>
                        )}
                    </p>
                </div>
                <div className="board-actions">
                    <button className="btn-clear-list" onClick={clearAll}>Clear All</button>
                    <button className="btn-download-report" onClick={exportPDF}>
                        <Download size={18} />
                        <span>Export PDF</span>
                    </button>
                    <button className="btn-share-roadmap" onClick={handleShare}>
                        <Share2 size={18} />
                        <span>Share Roadmap</span>
                    </button>
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
                                                            Strategic Choice: Tier {item.rankingTier || "1"}
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

            {/* Premium Share Modal */}
            {shareUrl && (
                <div className="share-modal-overlay">
                    <div className="share-modal">
                        <div className="share-modal-header">
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Share Your Roadmap</h3>
                            <button onClick={() => setShareUrl("")} className="btn-close-share">×</button>
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
                            Anyone with this link can view a read-only snapshot of your strategic priorities.
                        </p>
                        <div className="share-link-box">
                            <input readOnly value={shareUrl} className="share-input" />
                            <button onClick={copyToClipboard} className="btn-copy-share">
                                {copySuccess ? <Check size={18} color="#059669" /> : <Copy size={18} />}
                            </button>
                        </div>
                        {copySuccess && <p className="copy-notif">Link copied to clipboard!</p>}
                    </div>
                </div>
            )}

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
                }
                .rank-num { font-weight: 800; color: #1e3a8a; font-size: 1.1rem; margin-top: 4px; }

                .college-main-modern {
                    flex: 1;
                    padding: 24px;
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

                @media (max-width: 768px) {
                    .report-header { flex-direction: column; align-items: flex-start; }
                    .report-details-grid { grid-template-columns: 1fr; }
                    .detail-item.full-width { grid-column: auto; }
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
            `}</style>
        </div>
    );
}
