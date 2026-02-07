"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import "./AuthModal.css";

export default function AuthModal({ isOpen, onClose }) {
    const [mode, setMode] = useState("login"); // login | signup
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, error } = useAuth();

    if (!isOpen) return null;

    const handleGoogleSignIn = async () => {
        try {
            setIsSubmitting(true);
            await signInWithGoogle();
            onClose();
        } catch (err) {
            // Error is handled in AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            if (mode === "login") {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password, name);
            }
            onClose();
        } catch (err) {
            // Error is handled in AuthContext
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleMode = () => {
        setMode((m) => (m === "login" ? "signup" : "login"));
        setEmail("");
        setPassword("");
        setName("");
    };

    return (
        <div className="auth-modal-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <button className="auth-modal-close" onClick={onClose} aria-label="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                <div className="auth-modal-header">
                    <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
                    <p>{mode === "login" ? "Sign in to your account" : "Get started with CEI"}</p>
                </div>

                <button
                    type="button"
                    className="auth-google-btn"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                    </svg>
                    Continue with Google
                </button>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <form onSubmit={handleEmailSubmit} className="auth-form">
                    {mode === "signup" && (
                        <div className="auth-field">
                            <label htmlFor="name">Name</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                required={mode === "signup"}
                            />
                        </div>
                    )}

                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button type="submit" className="auth-submit-btn" disabled={isSubmitting}>
                        {isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                    </button>
                </form>

                <div className="auth-footer">
                    {mode === "login" ? (
                        <p>
                            Don&apos;t have an account?{" "}
                            <button type="button" onClick={toggleMode}>Sign up</button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{" "}
                            <button type="button" onClick={toggleMode}>Sign in</button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
