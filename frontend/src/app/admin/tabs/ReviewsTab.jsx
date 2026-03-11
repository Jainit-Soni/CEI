"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, MessageSquare, Star, RefreshCw, User, Search } from "lucide-react";

export default function ReviewsTab({ adminFetch }) {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState({});
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");

    const fetchAllReviews = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            // Since we don't have a global reviews fetch, let's assume we can fetch all or search
            // For now, let's try to fetch a list of colleges and then their reviews, 
            // OR use a proposed new global route /api/admin/reviews
            const res = await adminFetch("/api/admin/reviews?limit=50");
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setReviews(data.reviews || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [adminFetch]);

    useEffect(() => {
        fetchAllReviews();
    }, [fetchAllReviews]);

    const handleDelete = async (reviewId) => {
        if (!confirm("Are you sure you want to delete this review? This action cannot be undone.")) return;

        setDeleting(prev => ({ ...prev, [reviewId]: true }));
        try {
            const res = await adminFetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(await res.text());
            setReviews(prev => prev.filter(r => r._id !== reviewId));
        } catch (err) {
            alert("Failed to delete review: " + err.message);
        } finally {
            setDeleting(prev => ({ ...prev, [reviewId]: false }));
        }
    };

    const filteredReviews = reviews.filter(r =>
        r.userName.toLowerCase().includes(query.toLowerCase()) ||
        r.comment.toLowerCase().includes(query.toLowerCase()) ||
        r.collegeId.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className="reveal revealed">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.25rem' }}>Review Management</h3>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.875rem' }}>Moderate and remove user reviews across the platform</p>
                </div>
                <button
                    onClick={fetchAllReviews}
                    disabled={loading}
                    style={{ background: '#f1f5f9', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontWeight: 600 }}
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            <div style={{ marginBottom: 20, position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                <input
                    type="text"
                    placeholder="Search reviews by user, comment, or college ID..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: 12, border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem' }}
                />
            </div>

            {error && <div style={{ background: '#fee2e2', color: '#be123c', padding: '12px 16px', borderRadius: 12, marginBottom: 20 }}>{error}</div>}

            {loading ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                    <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p>Fetching reviews...</p>
                </div>
            ) : filteredReviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 64, background: '#fff', borderRadius: 24, border: '1px dashed #e2e8f0' }}>
                    <MessageSquare size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                    <p style={{ color: '#64748b', fontWeight: 500 }}>No reviews found matching your search</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {filteredReviews.map(r => (
                        <div key={r._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                                        <User size={16} />
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{r.userName}</h4>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>On {r.collegeId} · {new Date(r.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={14} fill={i < r.rating ? "#fbbf24" : "none"} color={i < r.rating ? "#fbbf24" : "#cbd5e1"} />
                                        ))}
                                    </div>
                                </div>
                                <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>{r.comment}</p>
                            </div>
                            <button
                                onClick={() => handleDelete(r._id)}
                                disabled={deleting[r._id]}
                                style={{ background: '#fff5f5', color: '#ef4444', border: '1px solid #fee2e2', width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                                title="Delete Review"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
