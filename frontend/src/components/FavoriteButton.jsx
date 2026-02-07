"use client";

import "./FavoriteButton.css";
import { useFavorites } from "@/lib/useFavorites";

export default function FavoriteButton({ type, id, item, size = "md", className = "" }) {
    const { isFavorite, toggleFavorite } = useFavorites();
    const active = isFavorite(type, id);

    return (
        <button
            type="button"
            className={`favorite-btn favorite-btn--${size} ${active ? "favorite-btn--active" : ""} ${className}`}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // If item is provided use it, otherwise fallback to minimal object
                const itemToSave = item || { id, type };
                toggleFavorite(type, itemToSave);
            }}
            aria-label={active ? "Remove from favorites" : "Add to favorites"}
            title={active ? "Remove from favorites" : "Add to favorites"}
        >
            <svg
                viewBox="0 0 24 24"
                fill={active ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
        </button>
    );
}
