"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import "./Toast.css";

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "info", title = "", action = null) => {
        const id = Math.random().toString(36).substr(2, 9);
        const autoDelete = action ? 8000 : (type === 'success' ? 4000 : 7000); // Give users more time if there's an action
        
        setToasts((prev) => [...prev, { id, message, type, title, action }]);
        
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, autoDelete);
    }, []);

    // Global Interceptor Listener
    useEffect(() => {
        const handleApiError = (e) => {
            const { title, message, type } = e.detail;
            addToast(message, type, title);
        };
        window.addEventListener('api-error', handleApiError);
        return () => window.removeEventListener('api-error', handleApiError);
    }, [addToast]);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="toast-container">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast toast-${toast.type} reveal`} onClick={() => removeToast(toast.id)}>
                        <div className="toast-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {toast.title && <div className="toast-title">{toast.title}</div>}
                            <div className="toast-message">{toast.message}</div>
                            {toast.action && (
                                <Link 
                                    href={toast.action.href} 
                                    className="mt-2 text-[11px] uppercase tracking-widest font-black text-indigo-500 hover:text-indigo-400 bg-white/10 w-max px-3 py-1.5 rounded-full border border-white/5 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {toast.action.label}
                                </Link>
                            )}
                        </div>
                        <div className="toast-progress" style={{ animationDuration: `${toast.action ? 8 : (toast.type === 'success' ? 4 : 7)}s` }} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}
