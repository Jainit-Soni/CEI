"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "./Toast";
import { FavoritesProvider } from "@/lib/useFavorites";
import { CompareProvider } from "@/lib/CompareContext";

export default function ClientProviders({ children }) {
    return (
        <ToastProvider>
            <AuthProvider>
                <FavoritesProvider>
                    <CompareProvider>
                        {children}
                    </CompareProvider>
                </FavoritesProvider>
            </AuthProvider>
        </ToastProvider>
    );
}
