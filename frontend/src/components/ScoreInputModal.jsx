
"use client";

import { useState } from "react";
import GlassPanel from "./GlassPanel";
import Button from "./Button";
import { X, Trophy, Save } from "lucide-react";

export default function ScoreInputModal({ isOpen, onClose, currentScores, onSave }) {
    // Local state for the form
    const [scores, setScores] = useState(currentScores || {});

    if (!isOpen) return null;

    const exams = ["CAT", "CMAT", "XAT", "MAT", "GMAT", "NMAT"];

    const handleChange = (exam, value) => {
        // validate percentile 0-100
        let val = parseFloat(value);
        if (isNaN(val)) val = "";
        if (val > 100) val = 100;
        if (val < 0) val = 0;

        setScores(prev => ({
            ...prev,
            [exam]: val
        }));
    };

    const handleSave = () => {
        onSave(scores);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-200">
                <GlassPanel variant="strong" className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <Trophy size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Your Exam Scores</h3>
                                <p className="text-sm text-slate-500">Unlock admission predictions</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {exams.map(exam => (
                            <div key={exam} className="flex items-center gap-4">
                                <div className="w-16 font-mono font-bold text-slate-700 bg-slate-50 py-2 text-center rounded">
                                    {exam}
                                </div>
                                <div className="flex-1 relative">
                                    <input
                                        type="number"
                                        placeholder="Percentile (0-100)"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                        value={scores[exam] || ""}
                                        onChange={(e) => handleChange(exam, e.target.value)}
                                        max="100"
                                        min="0"
                                        step="0.1"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                        %ile
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex gap-3">
                        <Button variant="ghost" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button className="flex-1 gap-2" onClick={handleSave}>
                            <Save size={18} />
                            Save Scores
                        </Button>
                    </div>

                    <p className="mt-4 text-xs text-center text-slate-400">
                        *Scores are stored locally and effectively used to predict SAFE, TARGET, or DREAM colleges.
                    </p>
                </GlassPanel>
            </div>
        </div>
    );
}
