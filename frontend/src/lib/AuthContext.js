"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Lazy-loaded Firebase instances
let firebaseApp = null;
let firebaseAuth = null;

const AuthContext = createContext({
    user: null,
    loading: true,
    error: null,
    signInWithGoogle: async () => { },
    signInWithEmail: async () => { },
    signUpWithEmail: async () => { },
    logout: async () => { },
});

// Lazy initialize Firebase
async function getFirebaseAuth() {
    if (firebaseAuth) return firebaseAuth;

    const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth")
    ]);

    const firebaseConfig = (await import("./firebase.config")).default;

    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    firebaseAuth = getAuth(firebaseApp);
    return firebaseAuth;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [authInitialized, setAuthInitialized] = useState(false);

    // Initialize auth listener lazily
    useEffect(() => {
        let unsubscribe = () => { };

        const initAuth = async () => {
            try {
                const auth = await getFirebaseAuth();
                const { onAuthStateChanged } = await import("firebase/auth");

                unsubscribe = onAuthStateChanged(auth, (user) => {
                    setUser(user);
                    setLoading(false);
                    setAuthInitialized(true);
                });
            } catch (err) {
                console.error("Failed to initialize auth:", err);
                setLoading(false);
                setAuthInitialized(true);
            }
        };

        // Small delay to not block initial render
        const timer = setTimeout(initAuth, 100);

        return () => {
            clearTimeout(timer);
            unsubscribe();
        };
    }, []);

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
            setError(err.message);
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
            const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (displayName) {
                await updateProfile(result.user, { displayName });
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

    const value = {
        user,
        loading,
        error,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        logout,
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
