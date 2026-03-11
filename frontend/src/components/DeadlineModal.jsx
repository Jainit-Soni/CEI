"use client";

import { useState } from "react";
import GlassPanel from "./GlassPanel";
import Button from "./Button";
import { X, Calendar, Type, FileText, AlertCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DeadlineModal({ isOpen, onClose, onAdd }) {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [type, setType] = useState("Exam");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title || !date) {
            setError("Please fill in title and date.");
            return;
        }
        onAdd({ title, date, type, notes });
        // Reset and close
        setTitle("");
        setDate("");
        setType("Exam");
        setNotes("");
        setError("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
            >
                <GlassPanel className="relative p-8 rounded-[32px] border-white/50 shadow-2xl overflow-hidden bg-white/90">
                    {/* Header Decorative */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add Milestone</h2>
                            <p className="text-sm text-slate-500 font-medium">Add a custom deadline to your roadmap</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Type size={12} /> Milestone Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. CMAT Registration Deadline"
                                className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 bg-white/50"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Calendar size={12} /> Target Date
                                </label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 bg-white/50"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles size={12} /> Category
                                </label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 bg-white/50 appearance-none"
                                >
                                    <option>Exam</option>
                                    <option>College</option>
                                    <option>Scholarship</option>
                                    <option>General</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText size={12} /> Strategic Notes
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add context to this deadline..."
                                rows={3}
                                className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium text-slate-700 bg-white/50 resize-none"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 p-3 rounded-xl">
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <Button variant="primary" className="w-full justify-center py-4 text-sm font-bold shadow-xl shadow-indigo-500/20" type="submit">
                                Create Milestone
                            </Button>
                        </div>
                    </form>
                </GlassPanel>
            </motion.div>
        </div>
    );
}
