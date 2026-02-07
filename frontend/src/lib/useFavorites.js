"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useAuth } from "./AuthContext";
import { saveFavorite, removeFavorite as removeFirestoreFavorite, getUserFavorites, syncLocalFavorites, subscribeToFavorites } from "./firestore";
import { useToast } from "@/components/Toast";

const STORAGE_KEY = "cei_favorites";

// Create Context
const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [favorites, setFavorites] = useState({ colleges: [], exams: [] });
    const [loading, setLoading] = useState(true);

    // Sync logic on mount/auth change
    useEffect(() => {
        let unsubscribe = () => { };
        let isMounted = true;

        const load = async () => {
            if (user) {
                // User logged in: Sync local -> Subscribe Firestore
                await syncLocalFavorites(user.uid);

                if (!isMounted) return;

                // subscribeToFavorites is now async
                const unsub = await subscribeToFavorites(user.uid, (data) => {
                    if (isMounted) {
                        setFavorites(data);
                        setLoading(false);
                    }
                });
                unsubscribe = unsub || (() => { });
            } else {
                // Guest: Load localStorage
                const loadLocal = () => {
                    try {
                        const stored = localStorage.getItem(STORAGE_KEY);
                        if (stored) setFavorites(JSON.parse(stored));
                        else setFavorites({ colleges: [], exams: [] });
                    } catch (err) {
                        console.error("Failed to load local favorites:", err);
                    }
                    if (isMounted) setLoading(false);
                };

                loadLocal();

                // Listen for changes in other tabs (Guest Mode Sync)
                const handleStorageChange = (e) => {
                    if (e.key === STORAGE_KEY) {
                        loadLocal();
                    }
                };
                window.addEventListener('storage', handleStorageChange);
                unsubscribe = () => window.removeEventListener('storage', handleStorageChange);
            }
        };
        load();

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [user?.uid]);



    // Clear all favorites
    const clearAllFavorites = useCallback(async () => {
        const emptyFavorites = { colleges: [], exams: [] };

        if (user) {
            // Clear from Firestore
            try {
                const { doc, setDoc } = await import("firebase/firestore");
                const { db } = await import("./firestore");
                const userRef = doc(db, "users", user.uid);
                await setDoc(userRef, {
                    favoriteColleges: [],
                    favoriteExams: []
                }, { merge: true });
                addToast("All favorites cleared", "success");
            } catch (err) {
                console.error("Failed to clear favorites from cloud:", err);
                addToast(`Error: ${err.message}`, "error");
            }
        } else {
            // Clear from localStorage
            localStorage.removeItem(STORAGE_KEY);
            setFavorites(emptyFavorites);
            addToast("All favorites cleared", "success");
        }
    }, [user, addToast]);

    const saveToLocal = (newFavorites) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
    };

    // Helper to normalize type (handle "exams" vs "exam")
    const getCollectionKey = (type) => {
        return (type === "exam" || type === "exams") ? "exams" : "colleges";
    };

    const addFavorite = useCallback(async (type, item) => {
        let isGuest = !user;
        const key = getCollectionKey(type);
        // Ensure item has the type property for Firestore
        const itemWithType = { ...item, type: key === "exams" ? "exam" : "college" };

        // Optimistic update
        let previousFavorites;
        setFavorites((prev) => {
            previousFavorites = prev;
            const list = prev[key] || [];
            // Check by ID (string safe)
            if (list.some(i => String(i.id) === String(item.id))) return prev;

            const newFavorites = {
                ...prev,
                [key]: [...list, itemWithType]
            };

            if (isGuest) {
                saveToLocal(newFavorites);
            }
            return newFavorites;
        });

        // Handle Side Effects
        if (isGuest) {
            addToast("Saved to favorites", "success");
        } else {
            try {
                await saveFavorite(user.uid, itemWithType);
                addToast("Saved to cloud favorites", "success");
            } catch (err) {
                console.error("Failed to save to cloud:", err);
                addToast(`Error: ${err.message}`, "error");
                setFavorites(previousFavorites);
            }
        }
    }, [user, addToast]);

    const removeFavorite = useCallback(async (type, id) => {
        const key = getCollectionKey(type);

        setFavorites((prev) => {
            const list = prev[key] || [];
            const newFavorites = {
                ...prev, // Correctly spread previous state
                [key]: list.filter((i) => String(i.id) !== String(id))
            };

            if (!user) saveToLocal(newFavorites);
            return newFavorites;
        });

        if (user) {
            try {
                // Pass normalized type "exam" or "college" to firestore logic
                const fsType = key === "exams" ? "exam" : "college";
                await removeFirestoreFavorite(user.uid, id, fsType);
            } catch (err) {
                console.error("Failed to remove from cloud:", err);
            }
        }
    }, [user]);

    const isFavorite = useCallback((type, id) => {
        const key = getCollectionKey(type);
        const list = favorites[key] || [];
        return list.some(i => String(i.id) === String(id));
    }, [favorites]);

    const toggleFavorite = useCallback((type, item) => {
        if (isFavorite(type, item.id)) {
            removeFavorite(type, item.id);
        } else {
            addFavorite(type, item);
        }
    }, [isFavorite, addFavorite, removeFavorite]);

    // Auto-remove persistent IIT Tirupati favorite (User Request)
    useEffect(() => {
        if (!loading && favorites.colleges.some(c => c.id === 'iit-tirupati')) {
            removeFavorite('colleges', 'iit-tirupati').catch(console.error);
        }
    }, [loading, favorites.colleges, removeFavorite]);

    const value = {
        favorites,
        loading,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleFavorite,
        clearAllFavorites,
    };

    return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error("useFavorites must be used within a FavoritesProvider");
    }
    return context;
}
