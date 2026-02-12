"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import "./admin.css";
import AdminGuard from "@/components/AdminGuard";

function AdminDashboard() {
    const { user, logout } = useAuth();
    const [colleges, setColleges] = useState([]);
    const [view, setView] = useState("list"); // list, form
    const [editingCollege, setEditingCollege] = useState(null);
    const [formData, setFormData] = useState({});
    const [status, setStatus] = useState("");

    // Helper to call our Next.js Proxy
    const secureCall = async (action, endpoint, data = {}) => {
        try {
            const res = await fetch("/api/admin-proxy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action,
                    endpoint,
                    data,
                    userEmail: user.email
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Request failed");
            return json;
        } catch (err) {
            throw err;
        }
    };

    // Load data on mount
    useEffect(() => {
        if (user) fetchColleges();
    }, [user]);

    const fetchColleges = async () => {
        try {
            setStatus("Loading data...");
            const data = await secureCall("GET", "/admin/colleges");
            // API might return { data: [...] } or just [...]
            setColleges(Array.isArray(data) ? data : (data.data || []));
            setStatus("");
        } catch (err) {
            console.error(err);
            setStatus("Error: " + err.message);
        }
    };

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
            await secureCall("DELETE", `/admin/colleges/${id}`);
            fetchColleges();
        } catch (err) {
            alert("Failed to delete: " + err.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await secureCall("POST", "/admin/colleges", formData);
            alert("Saved!");
            setView("list");
            fetchColleges();
        } catch (err) {
            alert("Failed to save: " + err.message);
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-wrapper">
                {/* Header */}
                <div className="admin-header">
                    <div className="admin-brand">
                        <h1>Admin Portal</h1>
                        <span className="admin-badge">Secure Mode</span>
                    </div>
                    <div className="admin-user-info">
                        <div className="user-pill">
                            <span className="status-dot"></span>
                            {user?.email}
                        </div>
                        <button onClick={logout} className="admin-btn btn-danger">Logout</button>
                    </div>
                </div>

                {/* Content */}
                {view === "list" ? (
                    <div className="admin-content card-glass">
                        <div className="admin-toolbar">
                            <h2>College Database</h2>
                            <button onClick={handleAddNew} className="admin-btn btn-primary">
                                + Add College
                            </button>
                        </div>

                        {status && <div className="status-bar">{status}</div>}

                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Location</th>
                                        <th align="right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {colleges.map((c) => (
                                        <tr key={c.id}>
                                            <td>
                                                <div className="fw-500">{c.name}</div>
                                                <div className="sub-text">ID: {c.id}</div>
                                            </td>
                                            <td>{c.city}, {c.state}</td>
                                            <td className="actions-cell">
                                                <button onClick={() => handleEdit(c)} className="icon-btn">Edit</button>
                                                <button onClick={() => handleDelete(c.id)} className="icon-btn text-red">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {colleges.length === 0 && !status && (
                                <div className="empty-state">No colleges found.</div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="admin-content card-glass">
                        <div className="admin-toolbar">
                            <h2>{editingCollege ? "Edit College" : "Add New College"}</h2>
                        </div>
                        <form onSubmit={handleSubmit} className="admin-form">
                            <div className="form-grid-2">
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

                            <div className="form-grid-2">
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
                                <label>Raw JSON Data</label>
                                <textarea
                                    className="admin-input json-editor"
                                    value={JSON.stringify(formData, null, 2)}
                                    onChange={e => {
                                        try { setFormData(JSON.parse(e.target.value)) } catch (err) { }
                                    }}
                                />
                            </div>

                            <div className="form-actions">
                                <button type="button" onClick={() => setView("list")} className="admin-btn btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="admin-btn btn-primary">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}

// Wrap with the Guard
export default function AdminPage() {
    const { user, signInWithGoogle } = useAuth();

    return (
        <AdminGuard>
            {!user ? (
                <div className="admin-login-screen">
                    <div className="admin-card glass-panel">
                        <h2 className="admin-title">Portal Access</h2>
                        <p className="admin-desc">Restricted to authorized personnel.</p>
                        <button onClick={signInWithGoogle} className="admin-btn btn-google">
                            Sign in with Google
                        </button>
                    </div>
                </div>
            ) : (
                <AdminDashboard />
            )}
        </AdminGuard>
    );
}
