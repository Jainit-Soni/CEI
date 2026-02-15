"use client";

import { useState } from "react";
import Button from "@/components/Button";
import GlassPanel from "@/components/GlassPanel";
import { Lock } from "lucide-react";

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");

    const handleLogin = (e) => {
        e.preventDefault();
        // Super simple client-side check for MVP (Replace with real auth later)
        if (password === "admin123") {
            setIsAuthenticated(true);
        } else {
            alert("Invalid Password");
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <GlassPanel className="p-8 w-full max-w-sm text-center">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold mb-6">Admin Access</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="password"
                            placeholder="Enter Admin Password"
                            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <Button className="w-full justify-center">Unlock Dashboard</Button>
                    </form>
                </GlassPanel>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
                    <Button variant="secondary" onClick={() => setIsAuthenticated(false)}>Logout</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-medium text-slate-500">Total Colleges</h3>
                        <p className="text-3xl font-bold text-slate-900 mt-2">2,140</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-medium text-slate-500">Pending Reviews</h3>
                        <p className="text-3xl font-bold text-amber-500 mt-2">12</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-sm font-medium text-slate-500">Users</h3>
                        <p className="text-3xl font-bold text-blue-500 mt-2">845</p>
                    </div>
                </div>

                <GlassPanel variant="strong" className="p-6">
                    <h2 className="text-xl font-bold mb-4">Content Management</h2>
                    <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-slate-400">Content management table coming next...</p>
                    </div>
                </GlassPanel>
            </div>
        </div>
    );
}
