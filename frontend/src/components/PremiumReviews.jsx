"use client";

import { useState, useEffect } from "react";
import { Star, User, ThumbsUp, MessageSquare, X, Send } from "lucide-react";
import GlassPanel from "./GlassPanel"; // Assuming you have this
import Button from "./Button"; // Assuming you have this
import { formatDistanceToNow } from 'date-fns';
import "./PremiumReviews.css";

export default function PremiumReviews({
    reviews = [],
    collegeName,
    collegeId,
    onAddReview
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sort: Newest first
    const sortedReviews = [...reviews].sort((a, b) =>
        new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) return alert("Please select a rating!");

        setIsSubmitting(true);
        // Simulate API call for smoother UX before actual prop call
        await new Promise(resolve => setTimeout(resolve, 800));

        if (onAddReview) {
            await onAddReview({ rating, text: reviewText });
        }

        setIsSubmitting(false);
        setIsModalOpen(false);
        setRating(0);
        setReviewText("");
    };

    return (
        <div className="premium-reviews-container">
            {/* Header Section */}
            <div className="reviews-header">
                <div>
                    <h2 className="reviews-title">Student Voices</h2>
                    <p className="reviews-subtitle">Real experiences from the {collegeName} community</p>
                </div>
                <Button
                    className="write-review-btn"
                    onClick={() => setIsModalOpen(true)}
                >
                    <MessageSquare size={16} />
                    Write a Review
                </Button>
            </div>

            {/* Reviews Grid */}
            {sortedReviews.length === 0 ? (
                <div className="no-reviews-state">
                    <div className="empty-icon-wrapper">
                        <MessageSquare size={48} />
                    </div>
                    <h3>Be the First</h3>
                    <p>Share your insights and help thousands of students make the right choice.</p>
                    <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                        Start Writing
                    </Button>
                </div>
            ) : (
                <div className="reviews-grid">
                    {sortedReviews.map((review, idx) => (
                        <div key={review.id || idx} className="review-card-glass">
                            <div className="review-header">
                                <div className="reviewer-avatar">
                                    <User size={20} />
                                </div>
                                <div className="reviewer-info">
                                    <span className="reviewer-name">{review.userName || "Anonymous Student"}</span>
                                    <span className="review-date">
                                        {review.date ? formatDistanceToNow(new Date(review.date), { addSuffix: true }) : "Recently"}
                                    </span>
                                </div>
                                <div className="review-rating-badge">
                                    <Star size={12} fill="currentColor" />
                                    <span>{review.rating}.0</span>
                                </div>
                            </div>

                            <div className="review-body">
                                <p>"{review.text}"</p>
                            </div>

                            <div className="review-footer">
                                <button className="helpful-btn">
                                    <ThumbsUp size={14} />
                                    <span>Helpful ({Math.floor(Math.random() * 10)})</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Sliding Modal */}
            <div className={`review-modal-overlay ${isModalOpen ? 'open' : ''}`} onClick={() => setIsModalOpen(false)}>
                <div className="review-modal-glass" onClick={e => e.stopPropagation()}>
                    <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                        <X size={24} />
                    </button>

                    <div className="modal-content">
                        <h3>Rate your experience</h3>
                        <p className="modal-subtitle">How likely are you to recommend {collegeName}?</p>

                        <form onSubmit={handleSubmit}>
                            {/* Star Rating */}
                            <div className="star-rating-input">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        type="button"
                                        key={star}
                                        className={`star-btn ${star <= (hoverRating || rating) ? 'active' : ''}`}
                                        onClick={() => setRating(star)}
                                        onMouseEnter={() => setHoverRating(star)}
                                        onMouseLeave={() => setHoverRating(0)}
                                    >
                                        <Star size={32} fill={star <= (hoverRating || rating) ? "currentColor" : "none"} />
                                    </button>
                                ))}
                            </div>
                            <p className="rating-label">
                                {rating === 5 ? "Excellent! 🤩" :
                                    rating === 4 ? "Very Good 🙂" :
                                        rating === 3 ? "Average 😐" :
                                            rating === 2 ? "Poor 🙁" :
                                                rating === 1 ? "Terrible 😡" : "Select a rating"}
                            </p>

                            {/* Text Area */}
                            <div className="input-group">
                                <textarea
                                    className="review-textarea"
                                    placeholder="What did you like or dislike? (e.g. Campus life, Faculty, Placements)"
                                    value={reviewText}
                                    onChange={(e) => setReviewText(e.target.value)}
                                    required
                                    minLength={10}
                                    rows={5}
                                />
                            </div>

                            <Button
                                type="submit"
                                className={`submit-review-btn ${isSubmitting ? 'loading' : ''}`}
                                disabled={isSubmitting || rating === 0}
                            >
                                {isSubmitting ? "Posting..." : (
                                    <>
                                        Post Review <Send size={16} />
                                    </>
                                )}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
