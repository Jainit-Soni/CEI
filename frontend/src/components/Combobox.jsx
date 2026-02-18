"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export default function Combobox({ options, value, onChange, label, placeholder = "Search..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef(null);

    const selectedOption = options.find(o => (o._id || o.id) === value);

    // Filter options
    const filteredOptions = query === ""
        ? options
        : options.filter((option) =>
            option.name.toLowerCase().includes(query.toLowerCase())
        );

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    return (
        <div className="combobox-wrapper" ref={wrapperRef}>
            {label && <label className="block text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'inherit' }}>{label}</label>}

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200 text-left transition-all ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : 'hover:border-slate-300'}`}
                >
                    <span className={`block truncate font-medium ${selectedOption ? 'text-slate-900' : 'text-slate-400'}`}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 rounded-lg pl-9 pr-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Type to filter..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-slate-400 text-center italic">
                                    No results found.
                                </div>
                            ) : (
                                filteredOptions.map((option) => (
                                    <button
                                        key={option._id || option.id}
                                        onClick={() => {
                                            onChange(option._id || option.id);
                                            setIsOpen(false);
                                            setQuery("");
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-colors mb-0.5 ${(option._id || option.id) === value
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                    >
                                        <span className="truncate text-left">{option.name}</span>
                                        {(option._id || option.id) === value && <Check size={14} />}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
