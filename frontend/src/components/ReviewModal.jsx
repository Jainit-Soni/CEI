"use client";

import { useState } from "react";
import GlassPanel from "./GlassPanel";
import Button from "./Button";
import { Star, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "./Toast";
import { postReview } from "@/lib/api";
import { sanitize } from "@/lib/sanitize";

const SENTIMENTS = {
    1: "Terrible 😡",
    2: "Bad 😞",
    3: "Okay 😐",
    4: "Good 🙂",
    5: "Excellent! 🤩"
};

export default function ReviewModal({ isOpen, onClose, collegeId, onReviewSubmitted }) {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!user) {
            addToast("Please login to submit a review", "error");
            return;
        }
        if (rating === 0) {
            addToast("Please select a rating", "error");
            return;
        }
        if (!comment.trim()) {
            addToast("Please write a review", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const cleanComment = sanitize(comment);
            await postReview({
                collegeId,
                userId: user.uid,
                userName: user.displayName || "Student",
                rating,
                comment: cleanComment
            });

            addToast("Review submitted successfully!", "success");
            onReviewSubmitted();
            onClose();
        } catch (error) {
            console.error(error);
            addToast("Failed to submit review", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-lg transform transition-all animate-in fade-in zoom-in-95 duration-200">
                <GlassPanel variant="strong" className="p-8 border-white/40 shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Write a Review</h3>
                            <p className="text-slate-500 font-medium text-sm">Share your experience with the community</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <div className="flex flex-col items-center mb-8 gap-3">
                        <div className="flex gap-3 relative z-10">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform hover:scale-125 focus:outline-none active:scale-95"
                                    type="button"
                                >
                                    <Star
                                        size={42}
                                        className={`transition-colors duration-200 ${star <= (hoverRating || rating)
                                            ? "fill-amber-400 text-amber-400 drop-shadow-md"
                                            : "fill-slate-100 text-slate-200"
                                            }`}
                                        strokeWidth={1.5}
                                    />
                                </button>
                            ))}
                        </div>
                        <div className={`h-6 text-sm font-bold uppercase tracking-widest transition-all duration-300 ${rating || hoverRating ? 'text-indigo-600 opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}>
                            {SENTIMENTS[hoverRating || rating]}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2 block ml-1">Your detailed review</label>
                            <textarea
                                className="w-full h-36 px-5 py-4 bg-white/50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:bg-white transition-all text-slate-700 font-medium resize-none placeholder:text-slate-400"
                                placeholder="Tell us about the campus vibe, faculty quality, placements, and infrastructure..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <Button
                            className="flex-[2] justify-center py-3.5 text-base shadow-xl shadow-indigo-200"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Posting..." : "Post Review"}
                        </Button>
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}
