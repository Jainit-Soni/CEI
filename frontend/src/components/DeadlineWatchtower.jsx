"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, Calendar, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { parseExamDate, sortTimelineEvents } from "@/utils/dateParser";
import { useAuth } from "@/lib/AuthContext";
// Import static exam data (in a real app, this might come from an API)
import examsData from "@/../backend/models/exams.json";

export default function DeadlineWatchtower() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const [selectedCount, setSelectedCount] = useState(0);

    useEffect(() => {
        const loadTimeline = () => {
            try {
                // 1. Get User's My List from LocalStorage
                const storedList = localStorage.getItem("choice-filling-cart");
                const myList = storedList ? JSON.parse(storedList) : [];
                setSelectedCount(myList.length);

                if (myList.length === 0) {
                    setLoading(false);
                    return;
                }

                // 2. Extract Unique Exam IDs from My List
                const myExamIds = new Set();
                myList.forEach(college => {
                    if (college.acceptedExams && Array.isArray(college.acceptedExams)) {
                        college.acceptedExams.forEach(exam => {
                            const examId = typeof exam === 'string' ? exam : exam.id || exam.code;
                            if (examId) myExamIds.add(examId.toLowerCase());
                        });
                    }
                });

                // 3. Match with Master Exam Data & Extract Dates
                const timelineEvents = [];

                examsData.forEach(exam => {
                    if (myExamIds.has(exam.id.toLowerCase()) && exam.dates) {
                        // Extract Registration
                        if (exam.dates.registration) {
                            const parsed = parseExamDate(exam.dates.registration);
                            if (parsed) {
                                timelineEvents.push({
                                    id: `${exam.id}-reg`,
                                    title: `${exam.shortName} Registration`,
                                    type: "registration",
                                    examName: exam.name,
                                    dateDisplay: exam.dates.registration,
                                    parsedDate: parsed,
                                    color: "blue"
                                });
                            }
                        }

                        // Extract Exam Date
                        if (exam.dates.examWindow) {
                            const parsed = parseExamDate(exam.dates.examWindow);
                            if (parsed) {
                                timelineEvents.push({
                                    id: `${exam.id}-exam`,
                                    title: `${exam.shortName} Exam Date`,
                                    type: "exam",
                                    examName: exam.name,
                                    dateDisplay: exam.dates.examWindow,
                                    parsedDate: parsed,
                                    color: "purple"
                                });
                            }
                        }
                    }
                });

                // 4. Sort Chronologically
                const sorted = sortTimelineEvents(timelineEvents);

                // Filter out past events that are too old (optional, keeps timeline relevant)
                // For now, we show everything to ensure visibility of past deadlines

                setEvents(sorted);
            } catch (err) {
                console.error("Watchtower Error:", err);
            } finally {
                setLoading(false);
            }
        };

        loadTimeline();
        // Listen for storage updates (if user adds college in another tab/component)
        window.addEventListener("local-storage-update", loadTimeline);
        return () => window.removeEventListener("local-storage-update", loadTimeline);
    }, []);

    if (loading) return <div className="watchtower-skeleton">Loading Intelligence...</div>;

    if (selectedCount === 0) {
        return (
            <div className="watchtower-empty">
                <div className="empty-content">
                    <Clock size={32} className="text-slate-400 mb-2" />
                    <h3>No Deadlines Yet</h3>
                    <p>Add colleges to your list to generate your personalized timeline.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="deadline-watchtower">
            <div className="dt-header">
                <div className="dt-title">
                    <Clock className="icon-pulse" size={20} />
                    <h3>Deadline Watchtower</h3>
                </div>
                <div className="dt-badge">
                    {events.filter(e => e.parsedDate.isUrgent).length > 0
                        ? `${events.filter(e => e.parsedDate.isUrgent).length} Urgent Actions`
                        : "On Track"
                    }
                </div>
            </div>

            <div className="dt-timeline">
                {events.length > 0 ? (
                    events.map((event, index) => (
                        <div key={event.id} className={`dt-event ${event.parsedDate.isUrgent ? 'urgent' : ''} ${event.parsedDate.isPast ? 'past' : ''}`}>
                            <div className="dt-time-column">
                                <span className={`month ${event.parsedDate.isUrgent ? 'text-red-600' : ''}`}>
                                    {event.parsedDate.monthName.substring(0, 3)}
                                </span>
                                <span className="year">{event.parsedDate.year}</span>
                            </div>

                            <div className="dt-marker-column">
                                <div className={`marker-dot ${event.type}`}></div>
                                {index !== events.length - 1 && <div className="marker-line"></div>}
                            </div>

                            <div className="dt-content-card">
                                <div className="dt-card-header">
                                    <h4>{event.title}</h4>
                                    {event.parsedDate.isUrgent && <AlertCircle size={14} className="text-red-500" />}
                                </div>
                                <p className="dt-date-text">{event.dateDisplay}</p>
                                <div className="dt-tags">
                                    <span className={`tag ${event.type}`}>{event.type === 'registration' ? 'Form Filling' : 'Exam Day'}</span>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="p-6 text-center text-slate-500 text-sm">
                        No specific dates found for your selected colleges.
                    </div>
                )}
            </div>

            <style jsx>{`
                .deadline-watchtower {
                    background: white;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    box-shadow: var(--shadow-sm);
                }

                .dt-header {
                    padding: 20px;
                    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .dt-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #1e293b;
                }
                .dt-title h3 {
                    font-family: var(--font-display);
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin: 0;
                }
                .icon-pulse {
                    color: #3b82f6;
                    animation: pulse 2s infinite;
                }

                .dt-badge {
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 4px 12px;
                    border-radius: 99px;
                    background: #eff6ff;
                    color: #3b82f6;
                    border: 1px solid #dbeafe;
                }

                .dt-timeline {
                    padding: 20px;
                    overflow-y: auto;
                    flex: 1;
                    /* Custom Scrollbar */
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }

                .dt-event {
                    display: flex;
                    gap: 16px;
                    padding-bottom: 24px;
                    position: relative;
                }
                .dt-event.past {
                    opacity: 0.6;
                    filter: grayscale(1);
                }

                .dt-time-column {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    min-width: 40px;
                    padding-top: 2px;
                }
                .month {
                    font-size: 0.85rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    color: #64748b;
                }
                .year {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    font-weight: 600;
                }

                .dt-marker-column {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .marker-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 0 0 2px #cbd5e1;
                    z-index: 2;
                    background: #cbd5e1;
                    margin-top: 6px;
                }
                .marker-dot.registration { background: #3b82f6; box-shadow: 0 0 0 2px #dbeafe; }
                .marker-dot.exam { background: #8b5cf6; box-shadow: 0 0 0 2px #ede9fe; }
                
                .dt-event.urgent .marker-dot {
                    background: #ef4444;
                    box-shadow: 0 0 0 2px #fee2e2;
                    animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                @keyframes ping {
                    75%, 100% { transform: scale(1.5); opacity: 0; }
                }

                .marker-line {
                    position: absolute;
                    top: 18px;
                    bottom: -24px;
                    width: 2px;
                    background: #e2e8f0;
                    z-index: 1;
                }

                .dt-content-card {
                    flex: 1;
                    background: #fff;
                    border: 1px solid #f1f5f9;
                    border-radius: 12px;
                    padding: 12px 16px;
                    transition: transform 0.2s;
                }
                .dt-content-card:hover {
                    box-shadow: var(--shadow-sm);
                    border-color: #e2e8f0;
                    transform: translateX(4px);
                }
                .dt-event.urgent .dt-content-card {
                    border-left: 3px solid #ef4444;
                    background: #fef2f2;
                }

                .dt-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 4px;
                }
                .dt-card-header h4 {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                    line-height: 1.3;
                }

                .dt-date-text {
                    font-size: 0.85rem;
                    color: #475569;
                    margin: 0 0 8px 0;
                }

                .dt-tags {
                    display: flex;
                    gap: 8px;
                }
                .tag {
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }
                .tag.registration { background: #eff6ff; color: #3b82f6; }
                .tag.exam { background: #f5f3ff; color: #8b5cf6; }

                .watchtower-empty {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f8fafc;
                    border-radius: 20px;
                    border: 2px dashed #e2e8f0;
                    text-align: center;
                    padding: 40px;
                }
                .watchtower-empty h3 {
                    font-family: var(--font-display);
                    font-size: 1.1rem;
                    color: #64748b;
                    margin: 0 0 4px 0;
                }
                .watchtower-empty p {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                @media (max-width: 768px) {
                    .dt-header { padding: 16px; }
                    .dt-timeline { padding: 16px; }
                }
            `}</style>
        </div>
    );
}
