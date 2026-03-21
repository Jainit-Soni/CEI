import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "./Toast";
import { FavoritesProvider } from "@/lib/useFavorites";
import { ComparatorProvider } from "@/hooks/useComparator";
import { ScoreProvider } from "@/lib/ScoreContext";

export default function ClientProviders({ children }) {
    return (
        <ToastProvider>
            <AuthProvider>
                <FavoritesProvider>
                    <ComparatorProvider>
                        <ScoreProvider>
                            {children}
                        </ScoreProvider>
                    </ComparatorProvider>
                </FavoritesProvider>
            </AuthProvider>
        </ToastProvider>
    );
}
