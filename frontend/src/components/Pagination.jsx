"use client";

import "./Pagination.css";

export default function Pagination({
    page,
    totalPages,
    onPageChange,
    hasNext,
    hasPrev,
    className = "",
}) {
    const getPageNumbers = () => {
        const pages = [];
        const showPages = 5;

        let start = Math.max(1, page - Math.floor(showPages / 2));
        let end = Math.min(totalPages, start + showPages - 1);

        if (end - start + 1 < showPages) {
            start = Math.max(1, end - showPages + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        return pages;
    };

    if (totalPages <= 1) return null;

    const pageNumbers = getPageNumbers();

    return (
        <nav className={`pagination ${className}`} aria-label="Pagination">
            <button
                className="pagination-btn pagination-btn--prev"
                onClick={() => onPageChange(page - 1)}
                disabled={!hasPrev}
                aria-label="Previous page"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
                <span>Prev</span>
            </button>

            <div className="pagination-pages">
                {pageNumbers[0] > 1 && (
                    <>
                        <button className="pagination-page" onClick={() => onPageChange(1)}>1</button>
                        {pageNumbers[0] > 2 && <span className="pagination-ellipsis">...</span>}
                    </>
                )}

                {pageNumbers.map((num) => (
                    <button
                        key={num}
                        className={`pagination-page ${num === page ? "pagination-page--active" : ""}`}
                        onClick={() => onPageChange(num)}
                        aria-current={num === page ? "page" : undefined}
                    >
                        {num}
                    </button>
                ))}

                {pageNumbers[pageNumbers.length - 1] < totalPages && (
                    <>
                        {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                            <span className="pagination-ellipsis">...</span>
                        )}
                        <button className="pagination-page" onClick={() => onPageChange(totalPages)}>
                            {totalPages}
                        </button>
                    </>
                )}
            </div>

            <button
                className="pagination-btn pagination-btn--next"
                onClick={() => onPageChange(page + 1)}
                disabled={!hasNext}
                aria-label="Next page"
            >
                <span>Next</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </button>
        </nav>
    );
}
