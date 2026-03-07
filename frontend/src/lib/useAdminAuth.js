"use client";

/**
 * lib/useAdminAuth.js — CEI Admin Authentication Hook
 * =====================================================
 * Wraps Firebase onAuthStateChanged with:
 *  - Google Sign-In / Sign-Out
 *  - Client-side email whitelist check (secondary guard)
 *  - getIdToken() for attaching to backend API calls
 *  - adminFetch() helper that auto-attaches Authorization header
 *
 * The REAL security check happens server-side in middleware/adminAuth.js.
 * This hook is UX-only.
 */

import { useState, useEffect, useCallback } from "react";
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase.config";

// Client-side whitelist — must match server ADMIN_WHITELIST exactly
const ADMIN_WHITELIST = [
    "jainitsoni07@gmail.com",
    "jainit.developer@gmail.com",
];

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://ce-intelligence-backend.vercel.app";

export function useAdminAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setIsAuthorized(
                firebaseUser
                    ? ADMIN_WHITELIST.includes(firebaseUser.email?.toLowerCase())
                    : false
            );
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const signInWithGoogle = useCallback(async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (err) {
            if (err.code === "auth/popup-closed-by-user") return null;
            throw err;
        }
    }, []);

    const signOut = useCallback(async () => {
        await firebaseSignOut(auth);
    }, []);

    /**
     * Get fresh Firebase ID token (auto-refreshed if near expiry).
     * Always call this before each API request — don't cache the token yourself.
     */
    const getIdToken = useCallback(async () => {
        if (!user) return null;
        return await user.getIdToken();
    }, [user]);

    /**
     * adminFetch(path, options)
     * Drop-in fetch() that auto-attaches Authorization: Bearer <token>.
     * path should start with /api/... (relative, will be prefixed with BACKEND url)
     */
    const adminFetch = useCallback(async (path, options = {}) => {
        const token = await getIdToken();
        if (!token) throw new Error("Not authenticated");

        const url = path.startsWith("http") ? path : `${BACKEND}${path}`;
        return fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`,
            },
        });
    }, [getIdToken]);

    return {
        user,
        loading,
        isAuthorized,
        signInWithGoogle,
        signOut,
        getIdToken,
        adminFetch,
    };
}
