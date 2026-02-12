"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminGuard({ children }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAuthorized, setIsAuthorized] = useState(false);

    // Whitelist from Env (comma separated)
    // Example: "admin@gmail.com,owner@gmail.com"
    const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());

    useEffect(() => {
        if (loading) return;

        // 1. Not Logged In -> 404 behavior (push to home)
        if (!user) {
            // Check for unlock param to show login screen instead of ghosting
            const unlock = searchParams ? searchParams.get("unlock") : null;
            if (unlock === "true") {
                // Allow them to see the login screen
                return;
            }
            router.replace("/"); // Ghost them
            return;
        }

        // 2. Logged In but Not Whitelisted -> 404 behavior
        if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
            router.replace("/");
            return;
        }

        // 3. Success
        setIsAuthorized(true);

    }, [user, loading, router, searchParams]);

    if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Loading...</div>;

    // If no user but unlocking, show children (which should have login form)
    // If user and authorized, show children
    if ((!user && searchParams && searchParams.get("unlock") === "true") || (user && isAuthorized)) {
        return <>{children}</>;
    }

    // Ghost mode (while redirecting)
    return null;
}
