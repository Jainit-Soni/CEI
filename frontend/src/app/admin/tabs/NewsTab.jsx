"use client";
import { useState } from "react";
import { postNews } from "@/lib/api";
import { CheckCircle } from "lucide-react";

export default function NewsTab({ onDispatch }) {
    const [newsForm, setNewsForm] = useState({
        title: "", summary: "", category: "Exam Alert", url: "", urgent: false
    });
    const [posting, setPosting] = useState(false);

    const handlePostNews = async (e) => {
        e.preventDefault();
        setPosting(true);
        try {
            const success = await postNews(newsForm);
            if (success) {
                alert("Intel Dispatched Successfully.");
                if (onDispatch) onDispatch(`[OP] News Dispatcher broadcast: "${newsForm.title}"`);
                setNewsForm({ title: "", summary: "", category: "Exam Alert", url: "", urgent: false });
            } else {
                alert("Failed to post news");
            }
        } catch (err) {
            alert("Error posting news");
        }
        setPosting(false);
    };

    return (
        <div className="reveal revealed">
            <div className="admin-form-container">
                <h3 className="admin-form-title">Dispatch Live Intel</h3>
                <p className="admin-form-subtitle">Broadcast breaking educational news directly to the student portal.</p>

                <form onSubmit={handlePostNews}>
                    <div className="admin-form-group">
                        <label>Strategic Headline</label>
                        <input
                            type="text"
                            className="admin-input-field"
                            placeholder="e.g. JEE Main Results Declared"
                            value={newsForm.title}
                            onChange={e => setNewsForm({ ...newsForm, title: e.target.value })}
                            required
                        />
                    </div>

                    <div className="admin-form-group">
                        <label>Intel Summary (Brief)</label>
                        <textarea
                            className="admin-textarea"
                            placeholder="Brief overview of the announcement..."
                            value={newsForm.summary}
                            onChange={e => setNewsForm({ ...newsForm, summary: e.target.value })}
                            required
                        />
                    </div>

                    <div className="admin-form-row">
                        <div className="admin-form-group">
                            <label>Classification</label>
                            <select
                                className="admin-select"
                                value={newsForm.category}
                                onChange={e => setNewsForm({ ...newsForm, category: e.target.value })}
                            >
                                <option>Exam Alert</option><option>Results</option><option>Policy</option>
                                <option>Admissions</option><option>General</option>
                            </select>
                        </div>
                        <div className="admin-form-group">
                            <label>Source Link (URL)</label>
                            <input
                                type="url"
                                className="admin-input-field mono"
                                placeholder="https://..."
                                value={newsForm.url}
                                onChange={e => setNewsForm({ ...newsForm, url: e.target.value })}
                            />
                        </div>
                    </div>

                    <div
                        className={`admin-urgent-box ${newsForm.urgent ? 'active' : ''}`}
                        onClick={() => setNewsForm({ ...newsForm, urgent: !newsForm.urgent })}
                    >
                        <div className="admin-urgent-check">
                            {newsForm.urgent && <CheckCircle size={14} />}
                        </div>
                        <div className="admin-urgent-text">
                            <h4>High Priority Transmission</h4>
                            <p>Alert students immediately on homepage</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={posting}
                        className="admin-btn-primary"
                    >
                        {posting ? "Transmitting via Node..." : "DISPATCH UPDATE"}
                    </button>
                </form>
            </div>
        </div>
    );
}
