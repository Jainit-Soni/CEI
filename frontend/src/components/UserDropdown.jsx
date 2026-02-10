"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import "./UserDropdown.css";

export default function UserDropdown() {
    const { user, logout } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!user) return null;

    const displayName = user.displayName || user.email?.split("@")[0] || "User";
    const initial = displayName.charAt(0).toUpperCase();

    const handleLogout = async () => {
        try {
            await logout();
            setIsOpen(false);
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    return (
        <div className="user-dropdown" ref={dropdownRef}>
            <button
                className="user-dropdown-trigger"
                onClick={() => setIsOpen((v) => !v)}
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                {user.photoURL ? (
                    <img
                        src={user.photoURL}
                        alt={displayName}
                        className="user-avatar"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <span className="user-avatar-placeholder">{initial}</span>
                )}
                <svg
                    className={`user-dropdown-arrow ${isOpen ? "open" : ""}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {isOpen && (
                <div className="user-dropdown-menu">
                    <div className="user-dropdown-info">
                        <span className="user-dropdown-name">{displayName}</span>
                        <span className="user-dropdown-email">{user.email}</span>
                    </div>
                    <div className="user-dropdown-divider" />

                    <Link href="/dashboard" className="user-dropdown-item" onClick={() => setIsOpen(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Dashboard
                    </Link>

                    <Link href="/profile" className="user-dropdown-item" onClick={() => setIsOpen(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                        </svg>
                        Edit Profile
                    </Link>

                    <div className="user-dropdown-divider" />

                    <button className="user-dropdown-item" onClick={handleLogout}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}
