"use client";

import { Star, ThumbsUp, User } from "lucide-react";

export default function ReviewList({ reviews = [] }) {
    if (!reviews.length) {
        return (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-500">
                    <Star size={24} />
                </div>
                <h3 className="text-slate-900 font-medium mb-1">No reviews yet</h3>
                <p className="text-slate-500 text-sm">Be the first to share your experience!</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {reviews.map((review) => (
                <div key={review._id} className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-200 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                                {review.userName?.[0] || "U"}
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-slate-800">{review.userName}</h4>
                                <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={12}
                                            className={`${i < review.rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <span className="text-xs text-slate-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed pl-11">
                        {review.comment}
                    </p>
                </div>
            ))}
        </div>
    );
}
