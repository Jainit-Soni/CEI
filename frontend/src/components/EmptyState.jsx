"use client";

import "./EmptyState.css";
import Button from "./Button";

export default function EmptyState({
    icon = "🔍",
    title = "No results found",
    description = "Try adjusting your search or filters",
    actionLabel,
    actionHref,
    onAction,
}) {
    return (
        <div className="empty-state">
            <span className="empty-state-icon" aria-hidden="true">{icon}</span>
            <h3>{title}</h3>
            <p>{description}</p>
            {(actionLabel && (actionHref || onAction)) && (
                <Button
                    variant="secondary"
                    href={actionHref}
                    onClick={onAction}
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
