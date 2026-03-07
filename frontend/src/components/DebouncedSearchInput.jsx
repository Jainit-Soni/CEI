"use client";

import { useState, useEffect } from "react";

export default function DebouncedSearchInput({ initialValue, onChange, placeholder, className }) {
    const [value, setValue] = useState(initialValue || "");
    const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

    // Sync if external query changes (e.g., from URL or clearing filters)
    // Using the "Update state during render" pattern to avoid cascading renders and lint errors
    if (initialValue !== prevInitialValue) {
        setPrevInitialValue(initialValue);
        setValue(initialValue || "");
    }

    // Send the value back to parent ONLY after the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => {
            if (value !== (initialValue || "")) {
                onChange(value);
            }
        }, 400); // 400ms debounce
        return () => clearTimeout(timer);
    }, [value, onChange, initialValue]);

    return (
        <input
            type="search"
            className={className}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
        />
    );
}
