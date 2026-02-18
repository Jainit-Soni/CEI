"use client";

import { useState } from "react";
import Button from "@/components/Button";
import GlassPanel from "@/components/GlassPanel";
import Container from "@/components/Container";
import { Lock, LayoutDashboard, Newspaper, LogOut, ShieldCheck, Zap, TrendingUp, Users } from "lucide-react";
import { postNews } from "@/lib/api";
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "../colleges/page.css";

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
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
        // Super simple client-side check for MVP
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
            const success = await postNews(newsForm);
            if (success) {
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
            <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-200/30 blur-[120px] rounded-full" />
                </div>

                <RevealOnScroll className="relative z-10 w-full max-w-sm">
                    <GlassPanel className="p-10 text-center" variant="strong">
                        <div className="bg-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-white shadow-xl shadow-indigo-200 rotate-12">
                            <ShieldCheck size={40} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-800 mb-2">Command Center</h1>
                        <p className="text-slate-500 mb-8 font-medium">Restricted Access only</p>

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="password"
                                    placeholder="Security Key"
                                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 placeholder:text-slate-300"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <Button className="w-full justify-center py-4 rounded-2xl text-lg font-bold shadow-lg shadow-indigo-100">
                                Authenticate
                            </Button>
                        </form>
                    </GlassPanel>
                </RevealOnScroll>
            </div>
        );
    }

    return (
        <div className="list-page min-h-screen">
            {/* Admin Header */}
            <div className="bg-white/80 backdrop-blur-md border-bottom border-slate-200 sticky top-0 z-50 py-4 shadow-sm">
                <Container>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-indigo-600 p-2 rounded-lg text-white">
                                <ShieldCheck size={24} />
                            </div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">ADMIN <span className="text-indigo-600">PORTAL</span></h1>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab("overview")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${activeTab === "overview" ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                <LayoutDashboard size={18} /> Overview
                            </button>
                            <button
                                onClick={() => setActiveTab("news")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all ${activeTab === "news" ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                            >
                                <Newspaper size={18} /> News
                            </button>
                            <div className="w-px h-8 bg-slate-200 mx-2 self-center" />
                            <button
                                onClick={() => setIsAuthenticated(false)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-rose-500 hover:bg-rose-50 transition-all"
                            >
                                <LogOut size={18} /> Exit
                            </button>
                        </div>
                    </div>
                </Container>
            </div>

            <section className="py-12">
                <Container>
                    {activeTab === "overview" ? (
                        <div className="space-y-10">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <RevealOnScroll>
                                    <GlassPanel className="p-8 group hover:border-indigo-300 transition-all cursor-default" variant="strong">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                <Zap size={24} />
                                            </div>
                                            <span className="bg-emerald-100 text-emerald-600 text-xs font-black px-2 py-1 rounded-full">+2.4%</span>
                                        </div>
                                        <h3 className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-1">Total Institutions</h3>
                                        <p className="text-4xl font-black text-slate-800">2,140</p>
                                    </GlassPanel>
                                </RevealOnScroll>
                                <RevealOnScroll delay={100}>
                                    <GlassPanel className="p-8 group hover:border-amber-300 transition-all cursor-default" variant="strong">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all">
                                                <TrendingUp size={24} />
                                            </div>
                                            <span className="bg-amber-100 text-amber-600 text-xs font-black px-2 py-1 rounded-full">ACTION REQ</span>
                                        </div>
                                        <h3 className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-1">Pending Reviews</h3>
                                        <p className="text-4xl font-black text-slate-800">12</p>
                                    </GlassPanel>
                                </RevealOnScroll>
                                <RevealOnScroll delay={200}>
                                    <GlassPanel className="p-8 group hover:border-blue-300 transition-all cursor-default" variant="strong">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                <Users size={24} />
                                            </div>
                                            <span className="bg-blue-100 text-blue-600 text-xs font-black px-2 py-1 rounded-full">+128</span>
                                        </div>
                                        <h3 className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-1">Active Candidates</h3>
                                        <p className="text-4xl font-black text-slate-800">845</p>
                                    </GlassPanel>
                                </RevealOnScroll>
                            </div>

                            {/* Content Placeholder */}
                            <RevealOnScroll delay={300}>
                                <GlassPanel className="p-12 text-center border-dashed border-2 border-slate-200" variant="strong">
                                    <div className="max-w-md mx-auto">
                                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                            <LayoutDashboard size={40} />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-700 mb-2">Data Engine Under Construction</h2>
                                        <p className="text-slate-500 font-medium leading-relaxed">
                                            The institutional management matrices are currently being synchronized. Detailed controls will be available in the next release.
                                        </p>
                                    </div>
                                </GlassPanel>
                            </RevealOnScroll>
                        </div>
                    ) : (
                        <RevealOnScroll>
                            <div className="max-w-3xl mx-auto">
                                <GlassPanel className="p-10" variant="strong">
                                    <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
                                        <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100">
                                            <Newspaper size={28} />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Dispatch Live Intel</h2>
                                            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider">Operational Newsroom</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handlePostNews} className="space-y-8">
                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Strategic Headline</label>
                                            <input
                                                type="text"
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-extrabold text-slate-700"
                                                placeholder="e.g. JEE Main Results Declared"
                                                value={newsForm.title}
                                                onChange={e => setNewsForm({ ...newsForm, title: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Intel Summary (Brief)</label>
                                            <textarea
                                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-600"
                                                rows="4"
                                                placeholder="Brief overview of the announcement..."
                                                value={newsForm.summary}
                                                onChange={e => setNewsForm({ ...newsForm, summary: e.target.value })}
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Classification</label>
                                                <select
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700 cursor-pointer appearance-none"
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
                                            <div className="space-y-2">
                                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Source Link (URL)</label>
                                                <input
                                                    type="url"
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-mono text-indigo-600 font-bold"
                                                    placeholder="https://..."
                                                    value={newsForm.url}
                                                    onChange={e => setNewsForm({ ...newsForm, url: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 bg-red-50 p-6 rounded-2xl border border-red-100 group cursor-pointer select-none" onClick={() => setNewsForm({ ...newsForm, urgent: !newsForm.urgent })}>
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${newsForm.urgent ? 'bg-red-600 text-white shadow-lg shadow-red-200 scale-110' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                                {newsForm.urgent ? <Zap size={18} /> : <div className="w-2 h-2 rounded-full bg-slate-200" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-black uppercase text-xs tracking-widest ${newsForm.urgent ? 'text-red-600' : 'text-slate-400'}`}>High Priority Transmission</p>
                                                <p className={`text-sm font-bold ${newsForm.urgent ? 'text-red-700' : 'text-slate-500'}`}>Mark this update as urgent breaking news</p>
                                            </div>
                                        </div>

                                        <Button type="submit" variant="primary" size="lg" className="w-full justify-center py-5 rounded-3xl text-xl font-black shadow-xl shadow-indigo-100 hover:scale-[1.02] transform transition-all" disabled={posting}>
                                            {posting ? "Transmitting..." : "DISPATCH UPDATE"}
                                        </Button>
                                    </form>
                                </GlassPanel>
                            </div>
                        </RevealOnScroll>
                    )}
                </Container>
            </section>
        </div>
    );
}
