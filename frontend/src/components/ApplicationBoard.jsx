"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Trash2, GripVertical, FileText, Download, Share2, Copy, Check, Loader2, Sparkles, BookOpen, MapPin } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { fetchUserChoices, saveUserChoices, shareUserChoices } from "@/lib/api";
import AuthModal from "./AuthModal";

export default function ApplicationBoard() {
    const [items, setItems] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [shareUrl, setShareUrl] = useState("");
    const [isSharing, setIsSharing] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const { user } = useAuth();

    const shareRef = useRef(null);

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
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [shareUrl]);

    useEffect(() => {
        const stored = localStorage.getItem("choice-filling-cart");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setItems(parsed);
            } catch (e) {
                console.error("Failed to parse choice-filling-cart", e);
            }
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded || !user) return;
        const syncData = async () => {
            setIsSyncing(true);
            try {
                const cloudChoices = await fetchUserChoices(user.uid);
                const localStored = localStorage.getItem("choice-filling-cart");
                const localItems = localStored ? JSON.parse(localStored) : [];
                if (localItems.length > 0) {
                    await saveUserChoices(user.uid, localItems);
                    setItems(localItems);
                } else if (cloudChoices && cloudChoices.length > 0) {
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

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem("choice-filling-cart", JSON.stringify(items));
        window.dispatchEvent(new Event("local-storage-update"));
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
        if (user) {
            try { await saveUserChoices(user.uid, newItems); }
            catch (err) { console.error("Failed to sync removal:", err); }
        }
    };

    const clearAll = async () => {
        if (window.confirm("Clear your entire selection list? This cannot be undone.")) {
            setItems([]);
            if (user) await saveUserChoices(user.uid, []);
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
        if (!user) { setShowAuthModal(true); return; }
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageWidth, 2, 'F');
        doc.setFontSize(14); doc.setTextColor(37, 99, 235); doc.setFont("helvetica", "bold");
        doc.text("CEI", 20, 25);
        doc.setFont("helvetica", "normal"); doc.setTextColor(15, 23, 42);
        doc.text("Intelligence", 30, 25);
        doc.setFontSize(48); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
        doc.text("Strategic", 20, 85); doc.text("Priority List", 20, 102);
        doc.setDrawColor(37, 99, 235); doc.setLineWidth(2); doc.line(20, 112, 55, 112);
        doc.setFontSize(14); doc.setTextColor(71, 85, 105); doc.setFont("helvetica", "normal");
        doc.text("STRATEGIC ADMISSIONS & ROI ANALYSIS", 20, 125);
        const tableData = items.map((item, index) => [
            `${index + 1}`,
            item.name || item.shortName,
            item.tuition || item.fees || "See Website",
            (item.placements?.averagePackage || "High").toString().replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " "),
            (item.acceptedExams || []).map(e => (typeof e === 'object' ? (e.code || e.name) : e)).join(", ")
        ]);
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 8, doc.internal.pageSize.height, 'F');
        autoTable(doc, {
            startY: 140,
            margin: { left: 20 },
            head: [['#', 'Institution', 'EST. TUITION', 'Avg. Package', 'Key Exams']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 4 },
            columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 68 }, 2: { cellWidth: 30 }, 3: { cellWidth: 30 } }
        });
        doc.save(`CEI_Strategic_Priority_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleShare = async () => {
        if (!items || items.length === 0) { alert("Your list is empty. Add some colleges first!"); return; }
        setIsSharing(true);
        try {
            const { shareId } = await shareUserChoices(items, user?.displayName || "Anonymous Student");
            if (shareId) {
                setShareUrl(`${window.location.origin}/share/${shareId}`);
            } else { throw new Error("No share ID returned"); }
        } catch (err) {
            console.error("Sharing failed", err);
            alert("Failed to generate share link. Please try again.");
        } finally { setIsSharing(false); }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    if (!isLoaded) return null;

    if (items.length === 0) {
        return (
            <div style={{
                textAlign: 'center', padding: '80px 20px',
                background: 'white', borderRadius: '32px',
                border: '2px dashed #e2e8f0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
            }}>
                <div style={{ fontSize: '4rem' }}>🎓</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Your roadmap is empty</h3>
                <p style={{ color: '#64748b', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>
                    Start exploring colleges and add them to build your strategic priority list.
                </p>
                <Link href="/colleges" style={{
                    marginTop: '8px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    color: 'white', padding: '14px 40px', borderRadius: '999px',
                    fontWeight: 700, textDecoration: 'none', boxShadow: '0 8px 24px rgba(79,70,229,0.35)'
                }}>
                    Browse Colleges
                </Link>
            </div>
        );
    }

    return (
        <div style={{ padding: '0' }}>

            {/* ── CINEMATIC HEADER ── */}
            <div style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(238,242,255,0.9) 50%, rgba(255,255,255,0.95) 100%)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.9)',
                borderRadius: '32px',
                padding: '40px 48px',
                marginBottom: '32px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04), 0 20px 60px -10px rgba(79,70,229,0.08)',
                position: 'relative',
                overflow: 'visible',
            }}>
                {/* Decorative accent */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)',
                    borderRadius: '32px 32px 0 0',
                }} />

                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '32px' }}>
                    {/* Left: Info */}
                    <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <h1 style={{
                                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                                fontWeight: 900,
                                color: '#0f172a',
                                letterSpacing: '-0.04em',
                                margin: 0,
                                fontFamily: 'var(--font-display, system-ui)',
                                lineHeight: 1.1,
                            }}>
                                Priority Roadmap
                            </h1>
                            <span style={{
                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                color: 'white', borderRadius: '999px',
                                padding: '6px 16px',
                                fontSize: '11px', fontWeight: 800,
                                letterSpacing: '0.1em', textTransform: 'uppercase',
                                boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
                                whiteSpace: 'nowrap',
                            }}>
                                {items.length} {items.length === 1 ? 'College' : 'Colleges'}
                            </span>
                        </div>
                        <p style={{
                            color: '#64748b', fontSize: '1rem',
                            lineHeight: 1.7, margin: 0, maxWidth: '540px',
                            fontWeight: 500,
                        }}>
                            Drag cards to reorder your strategic selections. Export a professional PDF or generate a read-only share link for your mentors.
                        </p>
                    </div>

                    {/* Right: Action Cluster */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Reset — subtle danger */}
                        <button onClick={clearAll} style={{
                            padding: '10px 20px', background: 'transparent',
                            border: '1px solid #e2e8f0', borderRadius: '12px',
                            color: '#94a3b8', fontSize: '11px', fontWeight: 800,
                            letterSpacing: '0.08em', textTransform: 'uppercase',
                            cursor: 'pointer', transition: 'all 0.2s',
                            fontFamily: 'inherit',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.background = '#fff5f5'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'transparent'; }}
                        >
                            Reset List
                        </button>

                        <div style={{ width: '1px', height: '36px', background: '#e2e8f0' }} />

                        {/* Export PDF */}
                        <button onClick={exportPDF} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '12px 24px', background: 'white',
                            border: '1px solid #e2e8f0', borderRadius: '16px',
                            color: '#1e293b', fontSize: '12px', fontWeight: 800,
                            letterSpacing: '0.05em', textTransform: 'uppercase',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                            fontFamily: 'inherit',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                            <Download size={15} />
                            <span>Export PDF</span>
                        </button>

                        {/* Share — anchor for popover */}
                        <div ref={shareRef} style={{ position: 'relative' }}>
                            <button onClick={handleShare} disabled={isSharing} style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '12px 24px',
                                background: shareUrl ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                border: 'none', borderRadius: '16px',
                                color: 'white', fontSize: '12px', fontWeight: 800,
                                letterSpacing: '0.05em', textTransform: 'uppercase',
                                cursor: isSharing ? 'not-allowed' : 'pointer',
                                transition: 'all 0.25s',
                                boxShadow: shareUrl
                                    ? '0 6px 20px rgba(5,150,105,0.4)'
                                    : '0 6px 20px rgba(79,70,229,0.4)',
                                opacity: isSharing ? 0.75 : 1,
                                fontFamily: 'inherit',
                            }}
                                onMouseEnter={e => { if (!isSharing) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                                {isSharing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Share2 size={15} />}
                                <span>{isSharing ? 'Generating...' : shareUrl ? 'Link Ready' : 'Share'}</span>
                            </button>

                            {/* ── SHARE POPOVER ── */}
                            <AnimatePresence>
                                {shareUrl && (
                                    <motion.div
                                        key="share-popover"
                                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                                        transition={{ type: "spring", stiffness: 350, damping: 28 }}
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 14px)',
                                            right: 0,
                                            width: '420px',
                                            zIndex: 9999,
                                            background: 'white',
                                            borderRadius: '28px',
                                            border: '1px solid rgba(79,70,229,0.15)',
                                            boxShadow: '0 8px 16px rgba(0,0,0,0.06), 0 24px 64px rgba(79,70,229,0.18)',
                                            padding: '28px',
                                            pointerEvents: 'auto',
                                        }}
                                    >
                                        {/* Accent line */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: '32px', right: '32px', height: '2px',
                                            background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                                            borderRadius: '0 0 4px 4px',
                                        }} />

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '16px', flexShrink: 0,
                                                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 8px 20px rgba(79,70,229,0.35)',
                                                color: 'white',
                                            }}>
                                                <Sparkles size={22} />
                                            </div>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Share Access</h4>
                                                <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', fontWeight: 500, marginTop: '2px' }}>Mentors can view your roadmap via this link.</p>
                                            </div>
                                        </div>

                                        <div style={{
                                            display: 'flex', alignItems: 'center',
                                            background: '#f8fafc', borderRadius: '16px',
                                            border: '1px solid #e2e8f0', overflow: 'hidden',
                                        }}>
                                            <div style={{ flex: 1, padding: '12px 16px', overflow: 'hidden' }}>
                                                <p style={{
                                                    margin: 0, fontSize: '12px', fontWeight: 700,
                                                    color: '#475569', whiteSpace: 'nowrap',
                                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {shareUrl}
                                                </p>
                                            </div>
                                            <button onClick={copyToClipboard} style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '12px 20px', margin: '4px',
                                                background: copySuccess ? '#059669' : '#0f172a',
                                                color: 'white', border: 'none', borderRadius: '12px',
                                                fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em',
                                                textTransform: 'uppercase', cursor: 'pointer',
                                                transition: 'all 0.2s', whiteSpace: 'nowrap',
                                                fontFamily: 'inherit',
                                                boxShadow: copySuccess ? '0 4px 12px rgba(5,150,105,0.4)' : 'none',
                                            }}>
                                                {copySuccess ? <Check size={13} /> : <Copy size={13} />}
                                                <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── COLLEGE CARDS ── */}
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="colleges">
                    {(provided) => (
                        <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {items.map((item, index) => (
                                <Draggable key={item.id} draggableId={item.id} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            style={{
                                                ...provided.draggableProps.style,
                                                background: 'white',
                                                borderRadius: '24px',
                                                border: snapshot.isDragging ? '2px solid #4f46e5' : '1px solid #e8eaf0',
                                                boxShadow: snapshot.isDragging
                                                    ? '0 20px 60px rgba(79,70,229,0.25), 0 8px 20px rgba(0,0,0,0.1)'
                                                    : '0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)',
                                                overflow: 'hidden',
                                                transition: snapshot.isDragging ? 'none' : 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
                                                transform: snapshot.isDragging ? undefined : 'none',
                                                display: 'flex',
                                            }}
                                        >
                                            {/* Drag Handle */}
                                            <div {...provided.dragHandleProps} style={{
                                                width: '64px', minWidth: '64px',
                                                background: snapshot.isDragging ? '#eff6ff' : '#fafbff',
                                                borderRight: '1px solid #f1f4ff',
                                                display: 'flex', flexDirection: 'column',
                                                alignItems: 'center', justifyContent: 'center',
                                                gap: '6px', cursor: 'grab', padding: '20px 0',
                                                transition: 'background 0.2s',
                                            }}>
                                                <GripVertical size={18} style={{ color: '#94a3b8' }} />
                                                <span style={{
                                                    fontWeight: 900, color: '#4f46e5',
                                                    fontSize: '1rem', letterSpacing: '-0.02em',
                                                    lineHeight: 1,
                                                }}>
                                                    #{index + 1}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div style={{ flex: 1, padding: '24px 28px' }}>
                                                {/* Header Row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                                    <div>
                                                        <h3 style={{
                                                            margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800,
                                                            color: '#1e3a8a', letterSpacing: '-0.02em', lineHeight: 1.2,
                                                        }}>
                                                            {item.name || item.shortName}
                                                        </h3>
                                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <MapPin size={13} style={{ flexShrink: 0 }} />
                                                            {item.location}
                                                        </p>
                                                    </div>
                                                    <span style={{
                                                        background: '#eff6ff', color: '#2563eb',
                                                        padding: '6px 14px', borderRadius: '999px',
                                                        fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                                                        border: '1px solid #bfdbfe',
                                                    }}>
                                                        Strategic Choice: {item.rankingTier && item.rankingTier.toString().toLowerCase().includes('tier') ? item.rankingTier : `Tier ${item.rankingTier || "1"}`}
                                                    </span>
                                                </div>

                                                {/* Stats Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                                    <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 16px' }}>
                                                        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>EST. TUITION</p>
                                                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{item.tuition || "See Website"}</p>
                                                    </div>
                                                    <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '14px 16px' }}>
                                                        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AVG PACKAGE</p>
                                                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#059669' }}>{item.placements?.averagePackage || "High ROI"}</p>
                                                    </div>
                                                    <div style={{ background: '#fefce8', borderRadius: '12px', padding: '14px 16px', gridColumn: 'span 1' }}>
                                                        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 800, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.08em' }}>KEY EXAMS</p>
                                                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400e', lineHeight: 1.3 }}>
                                                            {(item.acceptedExams || []).map(e => (typeof e === 'object' ? (e.code || e.name) : e)).join(", ") || "CAT, CMAT"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Action Row */}
                                                <div style={{ display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                                                    <Link href={`/college/${item.id}`} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                        padding: '9px 18px', background: '#f8fafc',
                                                        border: '1px solid #e8eaf0', borderRadius: '10px',
                                                        fontSize: '12px', fontWeight: 700, color: '#334155',
                                                        textDecoration: 'none', transition: 'all 0.15s',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = '#e8eaf0'; }}
                                                    >
                                                        <BookOpen size={14} />
                                                        Details
                                                    </Link>
                                                    <button onClick={() => removeItem(item.id)} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                        padding: '9px 18px', background: '#f8fafc',
                                                        border: '1px solid #e8eaf0', borderRadius: '10px',
                                                        fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                                                        cursor: 'pointer', transition: 'all 0.15s',
                                                        fontFamily: 'inherit',
                                                    }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e8eaf0'; }}
                                                    >
                                                        <Trash2 size={14} />
                                                        Remove
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

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />

            <style jsx>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
