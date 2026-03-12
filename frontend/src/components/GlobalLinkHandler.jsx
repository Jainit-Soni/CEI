"use client";

import { useEffect } from "react";

export default function GlobalLinkHandler() {
    useEffect(() => {
        const handleExternalLinks = (e) => {
            // Find the nearest anchor element
            const anchor = e.target.closest("a");
            
            if (!anchor) return;

            const href = anchor.getAttribute("href");
            
            // Skip if no href or it's an internal fragment
            if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

            try {
                // Check if the URL is absolute
                const url = new URL(anchor.href);
                const isExternal = url.origin !== window.location.origin;

                if (isExternal) {
                    // Force external links to open in a new tab strictly
                    anchor.setAttribute("target", "_blank");
                    anchor.setAttribute("rel", "noopener noreferrer");
                }
            } catch (err) {
                // If URL parsing fails (likely relative path), it's internal
            }
        };

        document.addEventListener("click", handleExternalLinks, { capture: true });
        return () => document.removeEventListener("click", handleExternalLinks, { capture: true });
    }, []);

    return null;
}
