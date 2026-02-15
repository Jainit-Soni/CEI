"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "./Toast";
import { FavoritesProvider } from "@/lib/useFavorites";
import { CompareProvider } from "@/lib/CompareContext";
import { ScoreProvider } from "@/lib/ScoreContext";

export default function ClientProviders({ children }) {
    return (
        <ToastProvider>
            <AuthProvider>
                <FavoritesProvider>
                    <CompareProvider>
                        <ScoreProvider>
                            {children}
                        </ScoreProvider>
                    </CompareProvider>
                </FavoritesProvider>
            </AuthProvider>
        </ToastProvider>
    );
}
