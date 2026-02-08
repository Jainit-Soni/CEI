"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import "./admin.css";

export default function AdminPage() {
    const { user, loading, error: authError, signInWithGoogle, logout } = useAuth();
    const [adminKey, setAdminKey] = useState("");
    const [colleges, setColleges] = useState([]);
    const [view, setView] = useState("list"); // list, form
    const [editingCollege, setEditingCollege] = useState(null);
    const [formData, setFormData] = useState({});
    const [status, setStatus] = useState("");
    const router = useRouter();

    const [isUnlocked, setIsUnlocked] = useState(false);

    // Load Admin Key from LocalStorage
    useEffect(() => {
        const stored = localStorage.getItem("admin_key");
        if (stored) {
            setAdminKey(stored);
            // Don't auto-unlock to force re-verification or at least click
            // Actually, auto-unlock is fine if key works.
            // Let's verify key by making a call
            verifyKey(stored);
        }
    }, []);

    // Fetch Colleges on Load (if user & key exist) - This useEffect is now redundant as verifyKey calls fetchColleges
    // useEffect(() => {
    //     if (user && adminKey) {
    //         fetchColleges();
    //     }
    // }, [user, adminKey]);

    const verifyKey = async (key) => {
        try {
            setStatus("Verifying...");
            // Simple check or fetch colleges to verify
            await api.get("/admin/colleges", {
                headers: { "x-admin-secret": key }
            });
            setIsUnlocked(true);
            fetchColleges(key);
            setStatus("");
        } catch (err) {
            setStatus("Invalid Admin Key");
            setIsUnlocked(false);
        }
    };

    const fetchColleges = async (key) => {
        try {
            setStatus("Loading data...");
            const res = await api.get("/admin/colleges", {
                headers: { "x-admin-secret": key || adminKey }
            });
            setColleges(res.data);
            setStatus("");
        } catch (err) {
            console.error(err);
            setStatus("Error loading data.");
        }
    };

    const handleUnlock = (e) => {
        e.preventDefault();
        localStorage.setItem("admin_key", adminKey);
        verifyKey(adminKey);
    };

    // handleSaveKey is no longer needed as handleUnlock handles saving and verifying
    // const handleSaveKey = () => {
    //     localStorage.setItem("admin_key", adminKey);
    //     fetchColleges();
    // };

    const handleEdit = (college) => {
        setEditingCollege(college);
        setFormData(college);
        setView("form");
    };

    const handleAddNew = () => {
        setEditingCollege(null);
        setFormData({
            name: "",
            city: "",
            state: "",
            rating: "",
            ranking: "",
            fees: "",
            placement: "",
            exams: []
        });
        setView("form");
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure?")) return;
        try {
            await api.delete(`/admin/colleges/${id}`, {
                headers: { "x-admin-secret": adminKey }
            });
            fetchColleges();
        } catch (err) {
            alert("Failed to delete");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/admin/colleges", formData, {
                headers: { "x-admin-secret": adminKey }
            });
            alert("Saved!");
            setView("list");
            fetchColleges();
        } catch (err) {
            alert("Failed to save: " + err.response?.data?.error || err.message);
        }
    };

    if (loading) return <div className="status-msg status-loading">Loading auth...</div>;

    if (!user) {
        return (
            <div className="admin-login-screen">
                <div className="admin-card">
                    <h2 className="admin-title">Admin Access</h2>
                    <p style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#666' }}>
                        Sign in to manage colleges and exam data.
                    </p>

                    {authError && (
                        <div className="status-msg status-error" style={{ textAlign: 'left', fontSize: '0.9rem' }}>
                            <strong>Login Failed:</strong> {authError.message || "Unknown error"}
                            <br />
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Code: {authError.code}</span>
                        </div>
                    )}

                    <button
                        onClick={signInWithGoogle}
                        className="admin-btn btn-primary btn-full"
                    >
                        Sign in with Google
                    </button>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#999' }}>
                        Protected Area. Authorized Personnel Only.
                    </div>
                </div>
            </div>
        );
    }

    if (!isUnlocked) {
        return (
            <div className="admin-login-screen">
                <div className="admin-card">
                    <h2 className="admin-title">Enter Admin Key</h2>
                    <p style={{ textAlign: 'center', marginBottom: '1rem', color: '#666' }}>
                        Hello, {user.displayName}. Please verify your privileges.
                    </p>
                    <form onSubmit={handleUnlock}>
                        <input
                            type="password"
                            placeholder="Admin Secret Key"
                            value={adminKey}
                            onChange={(e) => setAdminKey(e.target.value)}
                            className="admin-input"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="admin-btn btn-primary btn-full"
                        >
                            Unlock Dashboard
                        </button>
                    </form>
                    {status && <p className="status-msg status-error">{status}</p>}
                    <button onClick={logout} style={{ marginTop: '1rem', width: '100%', border: 'none', background: 'none', color: '#666', cursor: 'pointer' }}>Logout</button>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div className="admin-header">
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Admin Dashboard</h1>
                    <div className="admin-header-actions">
                        <span style={{ fontSize: '0.9rem', color: '#666' }}>Logged in as {user.displayName}</span>
                        <button onClick={() => {
                            localStorage.removeItem("admin_key");
                            setIsUnlocked(false);
                            setAdminKey("");
                        }} className="admin-btn btn-secondary">Lock</button>
                        <button onClick={logout} className="admin-btn btn-danger">Logout</button>
                    </div>
                </div>

                {/* Status Message */}
                {status && <div className="status-msg status-loading">{status}</div>}

                {/* Content */}
                {view === "list" ? (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                            <button
                                onClick={handleAddNew}
                                className="admin-btn btn-primary"
                            >
                                + Add New College
                            </button>
                        </div>

                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Location</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {colleges.map((c) => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 500 }}>{c.name}</td>
                                            <td style={{ color: '#666' }}>{c.city}, {c.state}</td>
                                            <td className="admin-actions-cell">
                                                <button
                                                    onClick={() => handleEdit(c)}
                                                    className="admin-btn btn-secondary"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(c.id)}
                                                    className="admin-btn btn-danger"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {colleges.length === 0 && !status && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                    No colleges loaded.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="admin-form-container">
                        <h2 className="admin-title" style={{ textAlign: 'left' }}>{editingCollege ? "Edit College" : "Add New College"}</h2>
                        <form onSubmit={handleSubmit}>
                            <div className="form-grid">
                                <div className="form-group">
                                    <label>College Name</label>
                                    <input
                                        className="admin-input"
                                        value={formData.name || ""}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>State</label>
                                    <input
                                        className="admin-input"
                                        value={formData.state || ""}
                                        onChange={e => setFormData({ ...formData, state: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-group">
                                    <label>City</label>
                                    <input
                                        className="admin-input"
                                        value={formData.city || ""}
                                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Fees</label>
                                    <input
                                        className="admin-input"
                                        value={formData.fees || ""}
                                        onChange={e => setFormData({ ...formData, fees: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Raw Data (JSON Edit)</label>
                                <textarea
                                    className="admin-input json-editor"
                                    value={JSON.stringify(formData, null, 2)}
                                    onChange={e => {
                                        try {
                                            setFormData(JSON.parse(e.target.value))
                                        } catch (err) {
                                            // Allow typing
                                        }
                                    }}
                                />
                            </div>

                            <div className="admin-actions-cell" style={{ marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setView("list")}
                                    className="admin-btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="admin-btn btn-primary"
                                >
                                    Save College
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
