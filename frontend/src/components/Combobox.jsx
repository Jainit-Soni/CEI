"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

export default function Combobox({ options, value, onChange, label, placeholder = "Search..." }) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef(null);

    const selectedOption = options.find(o => (o._id || o.id) === value);

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
        <div className="combobox-wrapper w-full" ref={wrapperRef}>
            {label && <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</label>}

            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between py-4 bg-transparent border-b-2 border-slate-200 text-left transition-all hover:border-slate-400 focus:border-slate-900 group"
                >
                    <span className={`text-xl md:text-2xl font-bold truncate ${selectedOption ? 'text-slate-900' : 'text-slate-300 group-hover:text-slate-400'}`}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </span>
                    <ChevronDown size={20} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm font-medium text-slate-900 focus:outline-none ring-1 ring-slate-200 focus:ring-slate-900 transition-all"
                                    placeholder="Type to filter..."
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-8 text-sm text-slate-400 text-center italic">
                                    No matches found.
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
                                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-colors mb-1 ${(option._id || option.id) === value
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                    >
                                        <span className="truncate text-left text-base">{option.name}</span>
                                        {(option._id || option.id) === value && <Check size={16} />}
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
