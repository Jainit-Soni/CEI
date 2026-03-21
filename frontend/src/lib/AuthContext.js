"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Lazy-loaded Firebase instances
let firebaseApp = null;
let firebaseAuth = null;
let initPromise = null;

const AuthContext = createContext({
    user: null,
    loading: true,
    error: null,
    signInWithGoogle: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
});

// Lazy initialize Firebase with singleton lock
async function getFirebaseAuth() {
    if (firebaseAuth) return firebaseAuth;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        try {
            const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
                import("firebase/app"),
                import("firebase/auth")
            ]);

            const firebaseConfig = (await import("./firebase.config")).default;

            firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
            firebaseAuth = getAuth(firebaseApp);
            return firebaseAuth;
        } catch (err) {
            initPromise = null; // Reset on failure so it can retry
            throw err;
        }
    })();

    return initPromise;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    const syncUserWithBackend = useCallback(async (firebaseUser) => {
        try {
            const { API_BASE } = await import("./api");
            const axios = (await import("axios")).default;
            const idToken = await firebaseUser.getIdToken(true);
            const res = await axios.get(`${API_BASE}/api/auth/sync`, {
                headers: { Authorization: `Bearer ${idToken}` }
            });

            const userData = res.data.user;
            setUser(prev => {
                const merged = {
                    ...firebaseUser,
                    ...prev,
                    ...userData,
                    uid: firebaseUser.uid
                };
                if (merged.avatarUrl && !merged.photoURL) {
                    merged.photoURL = merged.avatarUrl;
                }
                return merged;
            });
        } catch (syncErr) {
            console.error("[Auth] Sync failed:", syncErr.message);
        }
    }, []);

    // Initialize auth listener lazily
    useEffect(() => {
        let unsubscribe = () => { };

        const initAuth = async () => {
            try {
                const auth = await getFirebaseAuth();
                const { onAuthStateChanged } = await import("firebase/auth");

                unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                    if (firebaseUser) {
                        setUser(prev => ({ ...firebaseUser, ...prev, uid: firebaseUser.uid }));
                        setLoading(false);
                        await syncUserWithBackend(firebaseUser);
                    } else {
                        setUser(null);
                        setLoading(false);
                    }
                    setAuthInitialized(true);
                });
            } catch (err) {
                console.error("[Auth] Failed to initialize:", err);
                setLoading(false);
                setAuthInitialized(true);
            }
        };

        initAuth();
    }, [syncUserWithBackend]);

    const signInWithGoogle = useCallback(async () => {
        try {
            setError(null);
            const auth = await getFirebaseAuth();
            const { signInWithPopup, GoogleAuthProvider } = await import("firebase/auth");
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            return result.user;
        } catch (err) {
            console.error("Google sign-in error:", err);
            const msg = getErrorMessage(err.code);
            setError(msg);
            throw err;
        }
    }, []);

    const signInWithEmail = useCallback(async (email, password) => {
        try {
            setError(null);
            const auth = await getFirebaseAuth();
            const { signInWithEmailAndPassword } = await import("firebase/auth");
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (err) {
            console.error("Email sign-in error:", err);
            setError(getErrorMessage(err.code));
            throw err;
        }
    }, []);

    const signUpWithEmail = useCallback(async (email, password, displayName) => {
        try {
            setError(null);
            const auth = await getFirebaseAuth();
            const { createUserWithEmailAndPassword, updateProfile: fireUpdate } = await import("firebase/auth");
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (displayName) {
                await fireUpdate(result.user, { displayName });
            }
            return result.user;
        } catch (err) {
            console.error("Sign-up error:", err);
            setError(getErrorMessage(err.code));
            throw err;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            setError(null);
            const auth = await getFirebaseAuth();
            const { signOut } = await import("firebase/auth");
            await signOut(auth);
        } catch (err) {
            console.error("Logout error:", err);
            setError(err.message);
            throw err;
        }
    }, []);

    // Intelligence Spine Profile Update
    const updateProfile = useCallback(async (updates) => {
        if (!user) return;
        try {
            const { API_BASE } = await import("./api");
            const axios = (await import("axios")).default;
            const auth = await getFirebaseAuth();
            const idToken = await auth.currentUser.getIdToken(true);
            
            const response = await axios.post(`${API_BASE}/api/auth/profile`, updates, {
                headers: { Authorization: `Bearer ${idToken}` }
            });
            
            await syncUserWithBackend(auth.currentUser);
            return response.data;
        } catch (err) {
            console.error("[Auth] Profile update failed:", err);
            throw err;
        }
    }, [user, syncUserWithBackend]);

    // Deadline Management
    const addDeadline = useCallback(async (deadlineData) => {
        const newDeadline = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            ...deadlineData,
            status: 'upcoming'
        };

        setUser(prev => {
            if (!prev) return prev;
            return { ...prev, deadlines: [...(prev.deadlines || []), newDeadline] };
        });

        if (user?.uid) {
            try {
                const { API_BASE } = await import("./api");
                const axios = (await import("axios")).default;
                const idToken = await (await getFirebaseAuth()).currentUser.getIdToken();
                await axios.post(`${API_BASE}/api/auth/deadlines`, deadlineData, {
                    headers: { Authorization: `Bearer ${idToken}` }
                });
            } catch (err) {
                console.error("[Auth] Deadline sync failed:", err);
            }
        }
    }, [user?.uid]);

    const removeDeadline = useCallback(async (deadlineId) => {
        setUser(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                deadlines: (prev.deadlines || []).filter(d => d.id !== deadlineId)
            };
        });

        if (user?.uid) {
            try {
                const { API_BASE } = await import("./api");
                const axios = (await import("axios")).default;
                const idToken = await (await getFirebaseAuth()).currentUser.getIdToken();
                await axios.delete(`${API_BASE}/api/user/deadlines/${deadlineId}`, {
                    headers: { Authorization: `Bearer ${idToken}` }
                });
            } catch (err) {
                console.error("[Auth] Deadline removal sync failed:", err);
            }
        }
    }, [user?.uid]);

    const value = {
        user,
        loading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
        addDeadline,
        removeDeadline,
        updateProfile,
        isAuthenticated: !!user,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

// Helper to get user-friendly error messages
function getErrorMessage(code) {
    switch (code) {
        case "auth/email-already-in-use":
            return "This email is already registered. Please sign in.";
        case "auth/invalid-email":
            return "Invalid email address.";
        case "auth/weak-password":
            return "Password should be at least 6 characters.";
        case "auth/user-not-found":
            return "No account found with this email.";
        case "auth/wrong-password":
            return "Incorrect password.";
        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";
        case "auth/popup-closed-by-user":
            return "Sign-in cancelled.";
        default:
            return "An error occurred. Please try again.";
    }
}

// Export lazy getters for other modules that need auth
export { getFirebaseAuth };
