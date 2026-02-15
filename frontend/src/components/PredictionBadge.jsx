"use client";

import { useScores } from "@/lib/ScoreContext";
import { Shield, Target, Sparkles, AlertCircle } from "lucide-react";

export default function PredictionBadge({ college }) {
    const { getPrediction } = useScores();

    // If no college cutoffs available, don't render anything
    if (!college?.pastCutoffs?.length) return null;

    const prediction = getPrediction(college);

    if (!prediction) return null;

    const config = {
        "Safe 🛡️": {
            bg: "bg-emerald-100",
            text: "text-emerald-700",
            border: "border-emerald-200",
            icon: <Shield size={14} className="fill-emerald-200" />
        },
        "Target 🎯": {
            bg: "bg-amber-100",
            text: "text-amber-700",
            border: "border-amber-200",
            icon: <Target size={14} />
        },
        "Dream ✨": {
            bg: "bg-indigo-100",
            text: "text-indigo-700",
            border: "border-indigo-200",
            icon: <Sparkles size={14} className="fill-indigo-200" />
        }
    };

    const style = config[prediction.status] || config["Dream ✨"];

    return (
        <div className={`score-badge flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold shadow-sm ${style.bg} ${style.text} ${style.border}`}>
            {style.icon}
            <span>{prediction.status.split(" ")[0]}</span>
            <span className="text-[10px] opacity-75 font-medium ml-0.5">
                ({prediction.exam}: {prediction.cutoff})
            </span>
        </div>
    );
}
