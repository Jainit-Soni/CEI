"use client";

import { useAuth } from "@/lib/AuthContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Card from "@/components/Card";
import FavoriteButton from "@/components/FavoriteButton";
import { useFavorites } from "@/lib/useFavorites";
import "./page.css";

export default function Dashboard() {
    const { user, loading: authLoading } = useAuth();
    const { favorites, loading: favLoading } = useFavorites();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [user, authLoading, router]);

    if (authLoading || favLoading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user) return null;

    const displayName = user.displayName || user.email?.split("@")[0] || "Student";
    const initials = displayName.charAt(0).toUpperCase();

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "favorites", label: "My Favorites" },
        { id: "profile", label: "Profile Settings" },
    ];

    const favoriteColleges = favorites.colleges || [];
    const favoriteExams = favorites.exams || [];

    return (
        <div className="dashboard-page">
            <Container>
                <div className="dashboard-header">
                    <div className="user-profile-summary">
                        <div className="user-avatar-lg">
                            {user.photoURL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.photoURL} alt={displayName} />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>
                        <div>
                            <h1>Welcome back, {displayName}</h1>
                            <p>{user.email}</p>
                        </div>
                    </div>
                </div>

                <div className="dashboard-content">
                    <GlassPanel className="dashboard-sidebar">
                        <nav className="dashboard-nav">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`dashboard-nav-item ${activeTab === tab.id ? "active" : ""}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </GlassPanel>

                    <div className="dashboard-main">
                        {activeTab === "overview" && (
                            <div className="dashboard-section">
                                <h2>Overview</h2>
                                <div className="stats-grid">
                                    <GlassPanel className="stat-card">
                                        <h3>{favoriteColleges.length}</h3>
                                        <p>Favorite Colleges</p>
                                    </GlassPanel>
                                    <GlassPanel className="stat-card">
                                        <h3>{favoriteExams.length}</h3>
                                        <p>Saved Exams</p>
                                    </GlassPanel>
                                </div>

                                {favoriteColleges.length > 0 && (
                                    <div className="recent-activity">
                                        <h3>Recent Favorites</h3>
                                        <div className="compact-grid">
                                            {favoriteColleges.slice(0, 2).map((college) => (
                                                <div key={college.id} className="card-wrapper">
                                                    <FavoriteButton type="colleges" id={college.id} item={college} size="sm" className="card-favorite" />
                                                    <Card
                                                        type="college"
                                                        title={college.shortName || college.name}
                                                        subtitle={college.location}
                                                        tags={(college.acceptedExams || []).slice(0, 2)}
                                                        meta={[college.rankingTier || college.ranking].filter(Boolean)}
                                                        href={`/college/${college.id}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "favorites" && (
                            <div className="dashboard-section">
                                <h2>My Favorites</h2>

                                {favoriteColleges.length === 0 && favoriteExams.length === 0 ? (
                                    <div className="empty-dashboard">
                                        <p>You haven&apos;t saved any colleges or exams yet.</p>
                                        <a href="/colleges" className="btn-link">Explore Colleges</a>
                                    </div>
                                ) : (
                                    <>
                                        {favoriteColleges.length > 0 && (
                                            <div className="favorites-group">
                                                <h3>Colleges ({favoriteColleges.length})</h3>
                                                <div className="results-grid">
                                                    {favoriteColleges.map((college) => (
                                                        <div key={college.id} className="card-wrapper">
                                                            <FavoriteButton type="colleges" id={college.id} item={college} size="sm" className="card-favorite" />
                                                            <Card
                                                                type="college"
                                                                title={college.shortName || college.name}
                                                                subtitle={college.location}
                                                                tags={(college.acceptedExams || []).slice(0, 3)}
                                                                meta={[college.rankingTier || college.ranking].filter(Boolean)}
                                                                href={`/college/${college.id}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {favoriteExams.length > 0 && (
                                            <div className="favorites-group">
                                                <h3>Exams ({favoriteExams.length})</h3>
                                                <div className="results-grid">
                                                    {favoriteExams.map((exam) => (
                                                        <div key={exam.id} className="card-wrapper">
                                                            <FavoriteButton type="exams" id={exam.id} item={exam} size="sm" className="card-favorite" />
                                                            <Card
                                                                type="exam"
                                                                title={exam.shortName || exam.name}
                                                                subtitle={exam.type}
                                                                tags={(exam.syllabus || []).slice(0, 4)}
                                                                meta={`Accepted by ${exam.acceptedCount || 0} colleges`}
                                                                href={`/exam/${exam.id}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === "profile" && (
                            <div className="dashboard-section">
                                <h2>Profile Settings</h2>
                                <GlassPanel className="profile-card">
                                    <div className="profile-field">
                                        <label>Display Name</label>
                                        <div className="field-value">{displayName}</div>
                                    </div>
                                    <div className="profile-field">
                                        <label>Email</label>
                                        <div className="field-value">{user.email}</div>
                                    </div>
                                    <div className="profile-field">
                                        <label>Account ID</label>
                                        <div className="field-value mono">{user.uid}</div>
                                    </div>
                                    <div className="profile-footer">
                                        <p className="helper-text">To update your profile, please use your Google Account settings.</p>
                                    </div>
                                </GlassPanel>
                            </div>
                        )}
                    </div>
                </div>
            </Container>
        </div>
    );
}
