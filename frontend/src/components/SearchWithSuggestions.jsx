"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./SearchWithSuggestions.css";

export default function SearchWithSuggestions({
  placeholder = "Search colleges or exams...",
  onSearch,
  className = "",
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("All");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiBase}/api/suggest?q=${encodeURIComponent(searchQuery)}&type=${scope.toLowerCase()}`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setIsOpen((data || []).length > 0);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, scope]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setActiveIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 200);
  };

  const handleScopeChange = (newScope) => {
    setScope(newScope);
    if (query.trim()) {
      fetchSuggestions(query);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      if (onSearch) {
        onSearch(query, scope);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        const selected = suggestions[activeIndex];
        if (selected && typeof selected === "object") {
          const href = selected.type === "college" ? `/college/${selected.id}` : `/exam/${selected.id}`;
          window.location.href = href;
        } else if (typeof selected === "string") {
          setQuery(selected);
          setIsOpen(false);
        } else if (query.trim()) {
          handleSubmit(e);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const highlightMatch = (text, q) => {
    if (!q.trim()) return text;
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target) &&
        listRef.current &&
        !listRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[activeIndex];
      activeItem?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), []);

  const scopes = ["All", "Colleges", "Exams"];

  return (
    <div className={`search-with-suggestions ${className}`}>
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-scope-toggle" role="radiogroup" aria-label="Search scope">
          {scopes.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scope === s}
              className={`scope-button ${scope === s ? "scope-button--active" : ""}`}
              onClick={() => handleScopeChange(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="search-input-wrapper">
          <svg
            className="search-icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <input
            ref={inputRef}
            type="search"
            className="search-input"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query.trim() && suggestions.length > 0 && setIsOpen(true)}
            placeholder={placeholder}
            autoComplete="off"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="search-suggestions"
            aria-expanded={isOpen}
          />

          {isLoading && (
            <div className="search-spinner" aria-label="Loading">
              <div className="spinner" />
            </div>
          )}

          <button type="submit" className="search-submit-button">
            Search
          </button>
        </div>
      </form>

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id="search-suggestions"
          className="search-suggestions"
          role="listbox"
        >
          {suggestions.map((item, index) => {
            if (typeof item === "string") {
              return (
                <li key={`${item}-${index}`} role="option" aria-selected={index === activeIndex}>
                  <button
                    className={`suggestion-item ${index === activeIndex ? "suggestion-item--active" : ""}`}
                    onClick={() => {
                      setQuery(item);
                      setIsOpen(false);
                    }}
                  >
                    <span className="suggestion-title">{highlightMatch(item, query)}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={`${item.type}-${item.id}`} role="option" aria-selected={index === activeIndex}>
                <Link
                  href={item.type === "college" ? `/college/${item.id}` : `/exam/${item.id}`}
                  className={`suggestion-item ${index === activeIndex ? "suggestion-item--active" : ""}`}
                  onClick={() => setIsOpen(false)}
                >
                  <div className="suggestion-content">
                    <span className="suggestion-title">
                      {highlightMatch(item.name, query)}
                    </span>
                    <span className="suggestion-meta">
                      {item.subtitle || item.location || item.type}
                    </span>
                  </div>
                  <span className={`suggestion-badge suggestion-badge--${item.type}`}>
                    {item.type === "college" ? "College" : "Exam"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
