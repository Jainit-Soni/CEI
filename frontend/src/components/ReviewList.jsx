"use client";

import { Star } from "lucide-react";
import "./ReviewList.css";

export default function ReviewList({ reviews = [] }) {
    if (!reviews.length) {
        return (
            <div className="reviews-empty">
                <div className="reviews-empty-icon">
                    <Star size={24} />
                </div>
                <h3 className="reviews-empty-title">No reviews yet</h3>
                <p className="reviews-empty-desc">Be the first to share your experience!</p>
            </div>
        );
    }

    return (
        <div className="reviews-list">
            {reviews.map((review) => (
                <div key={review._id} className="review-card">
                    <div className="review-header">
                        <div className="review-author">
                            <div className="review-avatar">
                                {review.userName?.[0] || "U"}
                            </div>
                            <div className="review-author-info">
                                <h4 className="review-name">{review.userName}</h4>
                                <div className="review-stars">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            size={13}
                                            className={i < review.rating ? "star-filled" : "star-empty"}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <span className="review-date">
                            {new Date(review.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", year: "numeric"
                            })}
                        </span>
                    </div>
                    <p className="review-body">{review.comment}</p>
                </div>
            ))}
        </div>
    );
}
