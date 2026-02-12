"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import "./AuthModal.css";

export default function AuthModal({ isOpen, onClose }) {
    const [mode, setMode] = useState("login"); // login | signup
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [localError, setLocalError] = useState("");

    // Canvas Refs
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0, active: false });

    const { signInWithGoogle, signInWithEmail, signUpWithEmail, error: authError } = useAuth();

    // Particle Text System
    useEffect(() => {
        if (!isOpen || !canvasRef.current || !containerRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let animationFrameId;
        let particles = [];
        let width, height;

        const initParticles = () => {
            width = containerRef.current.clientWidth;
            height = containerRef.current.clientHeight;
            canvas.width = width;
            canvas.height = height;

            // 1. Draw Text to Offscreen Canvas to get pixels
            const offCanvas = document.createElement('canvas');
            offCanvas.width = width;
            offCanvas.height = height;
            const offCtx = offCanvas.getContext('2d');

            offCtx.font = '900 120px Inter, sans-serif';
            offCtx.fillStyle = 'white';
            offCtx.textAlign = 'center';
            offCtx.textBaseline = 'middle';
            offCtx.fillText('CEI', width / 2, height / 2);

            // 2. Scan Pixels
            const imageData = offCtx.getImageData(0, 0, width, height).data;
            particles = [];

            const density = 4; // Lower = more particles

            for (let y = 0; y < height; y += density) {
                for (let x = 0; x < width; x += density) {
                    const index = (y * width + x) * 4;
                    const alpha = imageData[index + 3];

                    if (alpha > 128) {
                        particles.push({
                            x: Math.random() * width, // Start random
                            y: Math.random() * height,
                            targetX: x,
                            targetY: y,
                            vx: 0,
                            vy: 0,
                            baseX: x,
                            baseY: y,
                            size: Math.random() * 1.5 + 0.5,
                            color: Math.random() > 0.8 ? '#4f46e5' : '#1e293b' // Indigo or Slate
                        });
                    }
                }
            }
        };

        const draw = () => {
            // Soft clear for trails? No, clean clear for crisp text
            ctx.clearRect(0, 0, width, height);

            particles.forEach(p => {
                // Physics to return to target
                let dx = p.targetX - p.x;
                let dy = p.targetY - p.y;

                // Interaction
                if (mouseRef.current.active) {
                    const mdx = mouseRef.current.x - p.x;
                    const mdy = mouseRef.current.y - p.y;
                    const dist = Math.sqrt(mdx * mdx + mdy * mdy);
                    const force = 100; // Repulsion radius

                    if (dist < force) {
                        const angle = Math.atan2(mdy, mdx);
                        const move = (force - dist) / 5;
                        p.vx -= Math.cos(angle) * move;
                        p.vy -= Math.sin(angle) * move;
                    }
                }

                // Spring back
                p.vx += dx * 0.05;
                p.vy += dy * 0.05;

                // Friction
                p.vx *= 0.85;
                p.vy *= 0.85;

                p.x += p.vx;
                p.y += p.vy;

                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(draw);
        };

        initParticles();
        draw();

        const handleResize = () => {
            initParticles();
        };

        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current.x = e.clientX - rect.left;
            mouseRef.current.y = e.clientY - rect.top;
            mouseRef.current.active = true;
        };

        const handleMouseLeave = () => {
            mouseRef.current.active = false;
        };

        window.addEventListener("resize", handleResize);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            window.removeEventListener("resize", handleResize);
            canvas.removeEventListener("mousemove", handleMouseMove);
            canvas.removeEventListener("mouseleave", handleMouseLeave);
            cancelAnimationFrame(animationFrameId);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSuccess = () => {
        setIsSuccess(true);
        setTimeout(() => {
            onClose();
            // Reset state
            setTimeout(() => {
                setIsSuccess(false);
                setLocalError("");
            }, 500);
        }, 1200);
    };

    const handleGoogleSignIn = async () => {
        setIsSubmitting(true);
        setLocalError("");
        try {
            await signInWithGoogle();
            handleSuccess();
        } catch (err) {
            setLocalError("Google sign-in failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setLocalError("");
        try {
            if (mode === "login") {
                await signInWithEmail(email, password);
            } else {
                await signUpWithEmail(email, password, name);
            }
            handleSuccess();
        } catch (err) {
            setLocalError(authError || "Authentication failed. Check your credentials.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleMode = () => {
        setMode((m) => (m === "login" ? "signup" : "login"));
        setLocalError("");
    };

    const activeError = localError || authError;

    return (
        <div className={`auth-overlay-glass ${isOpen ? "active" : ""} ${isSuccess ? "success-exit" : ""}`} onClick={onClose}>
            <div className={`auth-modal-glass ${isOpen ? "open" : ""} ${isSuccess ? "warp-drive" : ""}`} onClick={(e) => e.stopPropagation()}>

                {/* Left Side: Particle Brand */}
                <div className="auth-brand-glass" ref={containerRef}>
                    <canvas ref={canvasRef} className="particle-canvas" />
                    <div className="brand-copy-glass">
                        <h3>Selection Intelligence</h3>
                        <p>Experimental Particle Engine</p>
                    </div>
                </div>

                {/* Right Side: Clean Light Form */}
                <div className="auth-form-glass">
                    <button className="auth-close-glass" onClick={onClose} aria-label="Close">✕</button>

                    <div className="auth-fixed-content">
                        <div className="auth-header-glass">
                            <h2>{mode === "login" ? "Welcome Back" : "Get Started"}</h2>
                            <p>{mode === "login" ? "Access your personalized dashboard" : "Create your student account"}</p>
                        </div>

                        <button
                            type="button"
                            className="auth-btn-google-glass"
                            onClick={handleGoogleSignIn}
                            disabled={isSubmitting || isSuccess}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.22 2.58 5.6 4.84l3.12 2.4c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>

                        <div className="auth-divider-glass">
                            <span>or with email</span>
                        </div>

                        <form onSubmit={handleEmailSubmit} className="auth-form-stack">
                            {mode === "signup" && (
                                <div className="glass-field-group">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Full Name"
                                        required={mode === "signup"}
                                        className="glass-input"
                                    />
                                </div>
                            )}

                            <div className="glass-field-group">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Email Address"
                                    required
                                    className="glass-input"
                                />
                            </div>

                            <div className="glass-field-group">
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password"
                                    required
                                    minLength={6}
                                    className="glass-input"
                                />
                            </div>

                            {activeError && <div className="auth-error-glass">{activeError}</div>}

                            <button type="submit" className="auth-btn-main-glass" disabled={isSubmitting || isSuccess}>
                                {isSuccess ? "Success! 🎉" : isSubmitting ? "Loading..." : mode === "login" ? "Sign In" : "Create Account"}
                            </button>
                        </form>

                        <div className="auth-footer-glass">
                            {mode === "login" ? (
                                <p>New here? <button type="button" onClick={toggleMode}>Create account</button></p>
                            ) : (
                                <p>Already registered? <button type="button" onClick={toggleMode}>Sign in</button></p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
