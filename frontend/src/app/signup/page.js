"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import { UserPlus, Mail, Lock, User } from "lucide-react";
import "../login/login.css";

export default function SignupPage() {
    const { user, signUpWithEmail, signInWithGoogle, error: authError } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (user) {
            router.push("/dashboard");
        }
    }, [user, router]);

    const handleSignup = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await signUpWithEmail(email, password, name);
            router.push("/dashboard");
        } catch (err) {
            setError(err.message || "Failed to create account.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError("");
        try {
            await signInWithGoogle();
            router.push("/dashboard");
        } catch (err) {
            setError(err.message || "Google sign-up failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <div className="auth-container">
                <GlassPanel className="auth-panel">
                    <div className="auth-header">
                        <div className="auth-kicker">JOIN CEI</div>
                        <h1 className="auth-title">Create an Account</h1>
                        <p className="auth-subtitle">
                            Unlock personalized college tracking, match prediction, and deadline management.
                        </p>
                    </div>

                    {(error || authError) && (
                        <div className="auth-error">
                            {error || authError}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="auth-form">
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <div className="input-wrapper">
                                <User className="input-icon" size={18} />
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Elon Musk"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <div className="input-wrapper">
                                <Mail className="input-icon" size={18} />
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="elon@mars.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-wrapper">
                                <Lock className="input-icon" size={18} />
                                <input
                                    type="password"
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Minimum 6 characters"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full auth-submit-btn" disabled={loading}>
                            {loading ? "Creating account..." : "Create Account"} <UserPlus size={18} />
                        </Button>
                    </form>

                    <div className="auth-divider">
                        <span>OR SIGN UP WITH</span>
                    </div>

                    <div className="auth-social">
                        <button className="social-btn google-btn" onClick={handleGoogleLogin} disabled={loading}>
                            <svg viewBox="0 0 24 24" width="20" height="20">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </button>
                    </div>

                    <div className="auth-footer">
                        Already have an account? <Link href="/login">Sign in here</Link>
                    </div>
                </GlassPanel>
            </div>
        </main>
    );
}
