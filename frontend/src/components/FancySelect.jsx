"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./FancySelect.css";

// Custom debounce hook
function useDebouncedValue(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

const MAX_VISIBLE_OPTIONS = 50;

export default function FancySelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = "Select",
  searchable = true,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  // Debounce search query to prevent lag
  const debouncedQuery = useDebouncedValue(query, 150);

  // Memoize filtered and limited options
  const { filtered, totalCount, hasMore } = useMemo(() => {
    let result = options;
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = options.filter((opt) => opt.toLowerCase().includes(q));
    }
    return {
      filtered: result.slice(0, MAX_VISIBLE_OPTIONS),
      totalCount: result.length,
      hasMore: result.length > MAX_VISIBLE_OPTIONS,
    };
  }, [options, debouncedQuery]);

  useEffect(() => {
    const onClick = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSelect = useCallback((opt) => {
    onChange?.(opt);
    setOpen(false);
    setQuery("");
  }, [onChange]);

  const currentLabel = value || placeholder;

  return (
    <div className={`fancy-select ${className}`}>
      {label && <span className="fancy-label">{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        className={`fancy-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{currentLabel}</span>
        <span className="fancy-chevron" />
      </button>

      {open && (
        <div ref={listRef} className="fancy-popover">
          {searchable && (
            <input
              className="fancy-search"
              placeholder={`Search ${label || "options"}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              suppressHydrationWarning={true}
            />
          )}
          <div className="fancy-options">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`fancy-option ${opt === value ? "active" : ""}`}
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </button>
            ))}
            {hasMore && (
              <div className="fancy-more-hint">
                Showing {MAX_VISIBLE_OPTIONS} of {totalCount}. Type to filter.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
