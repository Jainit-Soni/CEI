"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Trash2, GripVertical, FileText, Download } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import "../app/dashboard/dashboard.css";

export default function ApplicationBoard() {
    const [items, setItems] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from LocalStorage on Mount
    useEffect(() => {
        const stored = localStorage.getItem("choice-filling-cart");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                } else {
                    setItems([]);
                }
            } catch (e) {
                console.error("Failed to parse choice-filling-cart", e);
                setItems([]);
            }
        }
        setIsLoaded(true);
    }, []);

    // Persist to LocalStorage whenever items change
    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem("choice-filling-cart", JSON.stringify(items));
        window.dispatchEvent(new Event("local-storage-update"));
    }, [items, isLoaded]);

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
        // Prevent default to avoid any page refresh/navigation race conditions on first click
        if (e && e.preventDefault) e.preventDefault();

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;

        // --- 1. THE COVER: Clean Modern Minimalism ---
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

        const drawMetric = (x, y, label, val) => {
            doc.setFillColor(255, 255, 255);
            doc.circle(x, y, 22, 'F');
            doc.setDrawColor(241, 245, 249);
            doc.setLineWidth(0.8);
            doc.circle(x, y, 22, 'S');

            doc.setFontSize(18);
            doc.setTextColor(37, 99, 235);
            doc.setFont("helvetica", "bold");
            doc.text(val.toString(), x, y, { align: "center", baseline: "middle" });

            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.setFont("helvetica", "bold");
            doc.text(label, x, y + 10, { align: "center" });
        };

        drawMetric(pageWidth / 2 - 50, 175, "COLLEGES", items.length);
        drawMetric(pageWidth / 2, 175, "EST. ROI", "98%");
        drawMetric(pageWidth / 2 + 50, 175, "CONSULT", "READY");

        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text("Personal Selection | Official CEI Report " + new Date().getFullYear(), pageWidth / 2, pageHeight - 15, { align: "center" });

        // --- 2. DATA PAGES: Dashboard ---
        doc.addPage();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.setFont("helvetica", "bold");
        doc.text("STRATEGIC PRIORITY VIEW", 20, 16);

        const sanitize = (val, type) => {
            if (!val) return "-";
            let s = val.toString().trim();

            if (type === 'tuition') {
                if (s.toLowerCase().includes("verify") || s.toLowerCase().includes("official") || s.length > 25) {
                    return "See Website";
                }
                // Convert symbols to "INR" for better PDF font support
                s = s.replace(/Rs\.|INR|¹|~|₹|\(Approx\)/gi, '').trim();
                if (s === "-" || !s) return "See Website";
                return s.toLowerCase().includes("lakh") ? s : `INR ${s}`;
            }

            if (type === 'package') {
                s = s.replace(/LPA|INR|Rs\.|¹|~|₹|\(Approx\)/gi, '').trim();
                if (s === "-" || !s) return "N/A";
                return `${s} LPA`;
            }

            // For names/locations, allow basic extended Latin but strip exotic control chars
            return s.replace(/[^\x20-\x7E\s]/g, (char) => {
                // Map common characters if needed, otherwise ignore exotic ones for PDF stability
                const map = { '₹': 'Rs' };
                return map[char] || '';
            });
        };

        const tableData = items.map((item) => [item]);

        autoTable(doc, {
            startY: 30,
            body: tableData,
            theme: 'plain',
            rowPageBreak: 'avoid', // Page Stability Fix for IIM Nagpur etc.
            styles: { minCellHeight: 48 },
            margin: { left: 15, right: 15 },
            didDrawCell: (data) => {
                if (data.section === 'body') {
                    const item = data.cell.raw;
                    const pos = data.cell;

                    doc.setFillColor(255, 255, 255);
                    doc.setDrawColor(226, 232, 240);
                    doc.setLineWidth(0.3);
                    doc.roundedRect(pos.x, pos.y + 2, pos.width, pos.height - 4, 3, 3, 'FD');

                    doc.setFillColor(37, 99, 235);
                    doc.rect(pos.x, pos.y + 2, 4, pos.height - 4, 'F');

                    doc.setFontSize(14);
                    doc.setTextColor(15, 23, 42);
                    doc.setFont("helvetica", "bold");
                    doc.text(`${data.row.index + 1}. ${item.shortName || item.name}`, pos.x + 12, pos.y + 12);

                    doc.setFontSize(9);
                    doc.setTextColor(100, 116, 139);
                    doc.text(item.location || "India", pos.x + 12, pos.y + 18);

                    const drawPill = (px, py, lbl, val, color) => {
                        const pillW = 52;
                        // NO Fill - Clean mode
                        doc.setDrawColor(241, 245, 249);
                        doc.setLineWidth(0.2);
                        doc.roundedRect(px, py, pillW, 16, 2, 2, 'S');

                        doc.setFontSize(7);
                        doc.setTextColor(color[0], color[1], color[2]);
                        doc.setFont("helvetica", "bold");
                        doc.text(lbl, px + 4, py + 5);

                        doc.setFontSize(9);
                        doc.setTextColor(15, 23, 42);
                        doc.setFont("helvetica", "bold");
                        let cleanVal = val;
                        if (cleanVal.length > 20) cleanVal = cleanVal.substring(0, 17) + "...";
                        doc.text(cleanVal, px + 4, py + 11);
                    };

                    const fees = sanitize(item.tuition, 'tuition');
                    const pkg = sanitize(item.placements?.average || item.placements?.averagePackage, 'package');
                    const firstExam = (item.acceptedExams || [])[0] || "N/A";

                    drawPill(pos.x + 12, pos.y + 26, "EST. TUITION", fees, [37, 99, 235]);
                    drawPill(pos.x + 68, pos.y + 26, "AVG PACKAGE", pkg, [22, 163, 74]);
                    drawPill(pos.x + 124, pos.y + 26, "KEY EXAMS", firstExam.toUpperCase(), [147, 51, 234]);

                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.setFont("helvetica", "italic");
                    doc.text("Strategic Choice: Tier " + (item.rankingTier || "A"), pos.width - 5, pos.y + 12, { align: "right" });
                }
            },
            didDrawPage: () => {
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(`Strategic Priority List | Page ${doc.internal.getNumberOfPages()}`, pageWidth / 2, pageHeight - 8, { align: "center" });
            }
        });

        // Trigger download with a clean unique name
        const filename = `Strategic_Priority_Report_${new Date().getTime()}.pdf`;
        doc.save(filename);
    };

    if (!isLoaded) return null;

    return (
        <div className="mylist-container">
            {/* Report Hero Section */}
            {items.length > 0 && (
                <div className="report-hero">
                    <div className="report-content">
                        <div className="report-icon-wrapper">
                            <FileText size={32} className="report-icon-svg" />
                        </div>
                        <div className="report-text">
                            <h2>Your Strategic Priority List</h2>
                            <p>Drag rows to reorder. Download your finalized preference list.</p>
                        </div>
                    </div>
                    <div className="report-actions-wrapper">
                        <button onClick={clearAll} className="btn-clear-list" title="Clear entire list">
                            <Trash2 size={18} /> Clear List
                        </button>
                        <button onClick={(e) => exportPDF(e)} className="btn-download-report">
                            Download Priority Report <Download size={18} />
                        </button>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {items.length === 0 ? (
                <div className="mylist-empty">
                    <div className="empty-icon">🎓</div>
                    <h3>Your list is empty</h3>
                    <p>Start exploring colleges and add them to your list to track them here.</p>
                    <Link href="/colleges" className="btn-browse">
                        Browse Colleges
                    </Link>
                </div>
            ) : (
                /* Draggable Rows View */
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="college-list">
                        {(provided) => (
                            <div
                                className="mylist-rows"
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                            >
                                <div className="list-header-row">
                                    <div className="col-rank">#</div>
                                    <div className="col-info">Institute</div>
                                    <div className="col-stats">Key Stats</div>
                                    <div className="col-actions">Actions</div>
                                </div>

                                {items.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`mylist-row ${snapshot.isDragging ? 'dragging' : ''}`}
                                            >
                                                <div
                                                    className="row-handle"
                                                    {...provided.dragHandleProps}
                                                >
                                                    <GripVertical size={20} />
                                                    <span className="rank-badge">{index + 1}</span>
                                                </div>

                                                <div className="row-content">
                                                    <div className="row-main">
                                                        <h3 className="row-title">{item.shortName || item.name}</h3>
                                                        <div className="row-meta">
                                                            <span className="meta-tag tier">{item.rankingTier || "Unranked"}</span>
                                                            <span className="meta-tag loc">{item.location?.split(',')[0]}</span>
                                                        </div>
                                                    </div>

                                                    <div className="row-stats">
                                                        <div className="stat-pill">
                                                            <span className="lbl">Pkg:</span>
                                                            <span className="val">
                                                                {(item.placements?.average || item.placements?.averagePackage) ? (
                                                                    item.placements.average || item.placements.averagePackage
                                                                ) : item.website ? (
                                                                    <a href={item.website} target="_blank" rel="noopener noreferrer" className="official-link">Visit Site</a>
                                                                ) : "N/A"}
                                                            </span>
                                                        </div>
                                                        <div className="stat-pill">
                                                            <span className="lbl">Exam:</span>
                                                            <span className="val">
                                                                {(item.acceptedExams && item.acceptedExams.length > 0)
                                                                    ? item.acceptedExams[0].replace(/\d+/, '').replace(/-/g, ' ').toUpperCase()
                                                                    : item.website ? (
                                                                        <a href={item.website} target="_blank" rel="noopener noreferrer" className="official-link">Check Site</a>
                                                                    ) : "N/A"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="row-actions">
                                                    <Link href={`/college/${item.id}`} className="btn-icon view" title="View Details">
                                                        ↗
                                                    </Link>
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="btn-icon remove"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
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
            )}

            <style jsx>{`
                .mylist-container {
                    padding: 20px 0;
                    margin-top: -20px;
                }

                .report-hero {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 40px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
                }

                .report-content {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .report-icon-wrapper {
                    width: 64px;
                    height: 64px;
                    background: #eff6ff;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #3b82f6;
                }

                .report-text h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1e3a8a;
                    margin: 0 0 4px 0;
                }

                .report-text p {
                    color: #64748b;
                    margin: 0;
                    font-size: 0.95rem;
                }

                .btn-download-report {
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                }

                .btn-clear-list {
                    background: #f1f5f9;
                    color: #64748b;
                    border: 1px solid #e2e8f0;
                    padding: 12px 20px;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }

                .btn-clear-list:hover {
                    background: #fee2e2;
                    color: #ef4444;
                    border-color: #fca5a5;
                }

                .report-actions-wrapper {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }

                .btn-download-report:hover {
                    background: #1d4ed8;
                    transform: translateY(-2px);
                    box-shadow: 0 8px 12px -3px rgba(37, 99, 235, 0.3);
                }

                @media (max-width: 768px) {
                    .report-hero {
                        flex-direction: column;
                        text-align: center;
                        gap: 24px;
                        padding: 24px;
                    }
                    .report-content {
                        flex-direction: column;
                    }
                }

                .list-header-row, .mylist-row {
                    display: grid;
                    grid-template-columns: 48px minmax(0, 1fr) 100px;
                    gap: 8px;
                    align-items: center;
                }

                @media (min-width: 768px) {
                    .list-header-row, .mylist-row {
                        grid-template-columns: 60px minmax(0, 2.5fr) minmax(0, 1.2fr) 100px;
                        gap: 20px;
                    }
                }

                .list-header-row {
                    padding: 0 20px 12px 20px;
                    color: #94a3b8;
                    font-size: 0.8rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    border-bottom: 2px solid #f1f5f9;
                    margin-bottom: 16px;
                }

                .list-header-row .col-stats {
                    display: none;
                }

                @media (min-width: 768px) {
                    .list-header-row .col-stats {
                        display: block;
                    }
                }

                .mylist-row {
                    background: white;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    padding: 12px;
                    margin-bottom: 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .mylist-row:hover {
                    border-color: #dbeafe;
                    background: #f8faff;
                    transform: translateX(4px);
                }

                .row-handle {
                    color: #94a3b8;
                    cursor: grab;
                    gap: 8px;
                    display: flex;
                    align-items: center;
                }
                .row-handle:hover { color: #2563eb; }

                .rank-badge {
                    font-weight: 800;
                    color: #1e3a8a;
                    font-size: 1.15rem;
                    width: 28px;
                    text-align: center;
                }

                .row-main {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                }

                .row-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1e40af;
                    margin: 0 0 4px 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    line-height: 1.25;
                }

                .row-meta {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .meta-tag {
                    font-size: 0.75rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: 500;
                }
                .meta-tag.tier { background: #ecfdf5; color: #059669; }
                .meta-tag.loc { background: #f1f5f9; color: #64748b; }

                .row-stats {
                    display: none;
                }
                @media (min-width: 768px) {
                    .row-stats {
                        display: flex;
                        gap: 16px;
                    }
                }

                .stat-pill {
                    background: white;
                    padding: 6px 14px;
                    border-radius: 12px;
                    font-size: 0.9rem;
                    color: #475569;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border: 1px solid #e2e8f0;
                    min-width: 140px; 
                }
                .stat-pill .lbl { 
                    color: #2563eb; 
                    font-size: 0.75rem; 
                    font-weight: 800; 
                    width: 45px;
                    text-transform: uppercase;
                }
                .stat-pill .val { 
                    font-weight: 700; 
                }

                .row-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                }

                .btn-icon.view {
                    color: #3b82f6;
                    background: #eff6ff;
                    font-size: 1.2rem;
                }
                .btn-icon.view:hover { background: #dbeafe; }

                .btn-icon.remove {
                    color: #94a3b8;
                    background: transparent;
                }
                .btn-icon.remove:hover {
                    color: #ef4444;
                    background: #fef2f2;
                }

                .mylist-empty {
                    text-align: center;
                    padding: 80px 20px;
                    background: white;
                    border-radius: 24px;
                    border: 2px dashed #e2e8f0;
                }
                .empty-icon {
                    font-size: 4rem;
                }
                .mylist-empty h3 {
                    color: #1e3a8a;
                    font-size: 1.75rem;
                }
                .btn-browse {
                    display: inline-block;
                    background: #2563eb;
                    color: white;
                    padding: 14px 32px;
                    border-radius: 999px;
                    font-weight: 600;
                    text-decoration: none;
                }
            `}</style>
        </div>
    );
}
