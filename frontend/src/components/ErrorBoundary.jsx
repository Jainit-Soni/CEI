"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                    <div className="bg-red-500/10 p-6 rounded-full mb-6 animate-pulse">
                        <AlertTriangle size={48} className="text-red-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 font-display">Something went wrong.</h1>
                    <p className="text-slate-400 mb-8 max-w-md">
                        Our team has been notified. We are working to fix this immediately.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold flex items-center transition-all"
                    >
                        <RefreshCw size={20} className="mr-2" /> Reload Page
                    </button>

                    {/* Dev Only Details */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-4 bg-black/50 rounded-lg text-left max-w-2xl overflow-auto text-xs text-red-300 font-mono w-full">
                            {this.state.error && this.state.error.toString()}
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
