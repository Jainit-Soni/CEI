"use client";

import { useState } from "react";
import GlassPanel from "./GlassPanel";
import Button from "./Button";
import { Star, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "./Toast";

export default function ReviewModal({ isOpen, onClose, collegeId, onReviewSubmitted }) {
    const { user, login } = useAuth(); // Assuming login method or similar triggered from here
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
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    // "Authorization": `Bearer ${token}` // If auth implemented
                },
                body: JSON.stringify({
                    collegeId,
                    userId: user.uid,
                    userName: user.displayName || "Student",
                    rating,
                    comment
                })
            });

            if (!res.ok) throw new Error("Failed to submit");

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md animate-in fade-in zoom-in duration-200">
                <GlassPanel variant="strong" className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-slate-800">Write a Review</h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="flex flex-col items-center mb-6">
                        <span className="text-sm font-medium text-slate-500 mb-2">How would you rate your experience?</span>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                                >
                                    <Star
                                        size={32}
                                        className={`${star <= (hoverRating || rating) ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-300"}`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">Your Review</label>
                        <textarea
                            className="w-full h-32 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                            placeholder="Share details about campus life, faculty, or placements..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </div>

                    <div className="mt-6">
                        <Button
                            className="w-full justify-center"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? "Submitting..." : "Post Review"}
                        </Button>
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}
