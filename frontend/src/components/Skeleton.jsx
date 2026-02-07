"use client";

import "./Skeleton.css";

export function CardSkeleton({ count = 1 }) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="card-skeleton skeleton">
                    <div className="skeleton-line skeleton-title" />
                    <div className="skeleton-line skeleton-subtitle" />
                    <div className="skeleton-tags">
                        <div className="skeleton-tag" />
                        <div className="skeleton-tag" />
                        <div className="skeleton-tag" />
                    </div>
                    <div className="skeleton-line skeleton-meta" />
                </div>
            ))}
        </>
    );
}

export function DetailSkeleton() {
    return (
        <div className="detail-skeleton">
            <div className="detail-skeleton-hero skeleton">
                <div className="skeleton-line skeleton-kicker" />
                <div className="skeleton-line skeleton-heading" />
                <div className="skeleton-line skeleton-subheading" />
                <div className="skeleton-stats">
                    <div className="skeleton-stat" />
                    <div className="skeleton-stat" />
                    <div className="skeleton-stat" />
                </div>
            </div>
            <div className="detail-skeleton-grid">
                <div className="detail-skeleton-panel skeleton" />
                <div className="detail-skeleton-panel skeleton" />
            </div>
        </div>
    );
}
