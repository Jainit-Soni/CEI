"use client";

import { useState } from "react";
import ApplicationBoard from "@/components/ApplicationBoard";
import ProfileForm from "@/components/ProfileForm";
import Container from "@/components/Container";
import "./dashboard.css";

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState("tracker");

    return (
        <div className="dashboard-page">
            <Container>
                <div className="dashboard-header">
                    <h1 className="dashboard-title">Student Dashboard</h1>
                    <p className="dashboard-subtitle">Manage your applications and profile in one place 🎓</p>
                </div>

                <div className="dashboard-tabs">
                    <button
                        className={`tab-btn ${activeTab === "tracker" ? "active" : ""}`}
                        onClick={() => setActiveTab("tracker")}
                    >
                        Application Tracker
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "profile" ? "active" : ""}`}
                        onClick={() => setActiveTab("profile")}
                    >
                        My Profile
                    </button>
                </div>

                <div className="dashboard-content">
                    {activeTab === "tracker" ? <ApplicationBoard /> : <ProfileForm />}
                </div>
            </Container>
        </div>
    );
}
