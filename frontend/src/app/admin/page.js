"use client";

import { useState } from "react";
import Button from "@/components/Button";
import GlassPanel from "@/components/GlassPanel";
import { Lock } from "lucide-react";

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");
    const [newsForm, setNewsForm] = useState({
        title: "",
        summary: "",
        category: "Exam Alert",
        url: "",
        urgent: false
    });
    const [posting, setPosting] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        // Super simple client-side check for MVP (Replace with real auth later)
        if (password === "admin123") {
            setIsAuthenticated(true);
        } else {
            alert("Invalid Password");
        }
    };

    const handlePostNews = async (e) => {
        e.preventDefault();
        setPosting(true);
        try {
            const res = await fetch('/api/news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newsForm)
            });
            if (res.ok) {
                alert("News Posted Successfully! 📰");
                setNewsForm({ title: "", summary: "", category: "Exam Alert", url: "", urgent: false });
            } else {
                alert("Failed to post news");
            }
        } catch (err) {
            console.error(err);
            alert("Error posting news");
        }
        setPosting(false);
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <GlassPanel className="p-8 w-full max-w-sm text-center">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold mb-6">Admin Access</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="Enter Admin Password"
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button className="w-full justify-center">Unlock Dashboard</Button>
                    </form>
                </GlassPanel>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                    <div className="flex gap-4">
                        <Button
                            variant={activeTab === "overview" ? "primary" : "ghost"}
                            onClick={() => setActiveTab("overview")}
                        >
                            Overview
                        </Button>
                        <Button
                            variant={activeTab === "news" ? "primary" : "ghost"}
                            onClick={() => setActiveTab("news")}
                        >
                            News Manager
                        </Button>
                        <Button variant="secondary" onClick={() => setIsAuthenticated(false)}>Logout</Button>
                    </div>
                </div>

                {activeTab === "overview" ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-medium text-slate-500">Total Colleges</h3>
                                <p className="text-3xl font-bold text-slate-900 mt-2">2,140</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-medium text-slate-500">Pending Reviews</h3>
                                <p className="text-3xl font-bold text-amber-500 mt-2">12</p>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-sm font-medium text-slate-500">Users</h3>
                                <p className="text-3xl font-bold text-blue-500 mt-2">845</p>
                            </div>
                        </div>

                        <GlassPanel variant="strong" className="p-6">
                            <h2 className="text-xl font-bold mb-4">Content Management</h2>
                            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                <p className="text-slate-400">Content management table coming next...</p>
                            </div>
                        </GlassPanel>
                    </>
                ) : (
                    <GlassPanel className="p-8 max-w-2xl mx-auto">
                        <h2 className="text-2xl font-bold mb-6 text-slate-800">Post Live News 📢</h2>
                        <form onSubmit={handlePostNews} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Headline</label>
                                <input
                                    type="text"
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g. JEE Main Results Declared"
                                    value={newsForm.title}
                                    onChange={e => setNewsForm({ ...newsForm, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Summary (Max 140 chars)</label>
                                <textarea
                                    className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="3"
                                    placeholder="Short description for the feed..."
                                    value={newsForm.summary}
                                    onChange={e => setNewsForm({ ...newsForm, summary: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                                    <select
                                        className="w-full p-3 border rounded-lg outline-none bg-white"
                                        value={newsForm.category}
                                        onChange={e => setNewsForm({ ...newsForm, category: e.target.value })}
                                    >
                                        <option>Exam Alert</option>
                                        <option>Results</option>
                                        <option>Policy</option>
                                        <option>Admissions</option>
                                        <option>General</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Official Link</label>
                                    <input
                                        type="url"
                                        className="w-full p-3 border rounded-lg outline-none"
                                        placeholder="https://..."
                                        value={newsForm.url}
                                        onChange={e => setNewsForm({ ...newsForm, url: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="urgent"
                                    className="w-5 h-5 text-red-600 rounded"
                                    checked={newsForm.urgent}
                                    onChange={e => setNewsForm({ ...newsForm, urgent: e.target.checked })}
                                />
                                <label htmlFor="urgent" className="text-slate-700 font-medium select-none cursor-pointer">
                                    Mark as Urgent / Breaking 🚨
                                </label>
                            </div>

                            <Button type="submit" variant="primary" size="lg" className="w-full justify-center" disabled={posting}>
                                {posting ? "Posting..." : "Post Live Update"}
                            </Button>
                        </form>
                    </GlassPanel>
                )}
            </div>
        </div>
    );
}
