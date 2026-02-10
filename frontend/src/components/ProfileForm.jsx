"use client";

import { useState, useEffect } from "react";
import Button from "./Button";

export default function ProfileForm() {
    const [profile, setProfile] = useState({
        name: "",
        email: "",
        targetDegree: "MBA",
        exams: {
            cat: "",
            cmat: "",
            jee: "",
            gate: ""
        }
    });

    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("student-profile");
        if (stored) {
            setProfile(JSON.parse(stored));
        }
    }, []);

    const handleChange = (field, value) => {
        setProfile(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const handleExamChange = (exam, value) => {
        setProfile(prev => ({
            ...prev,
            exams: { ...prev.exams, [exam]: value }
        }));
        setSaved(false);
    };

    const handleSave = () => {
        localStorage.setItem("student-profile", JSON.stringify(profile));
        setSaved(true);
        window.dispatchEvent(new Event("profile-update"));
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="profile-form-wrapper">
            <h3 className="profile-form-title">Personal Strategy Profile</h3>

            <div className="profile-form-grid">
                <div className="form-group">
                    <label>Full Name</label>
                    <input
                        type="text"
                        className="form-input"
                        value={profile.name}
                        onChange={(e) => handleChange("name", e.target.value)}
                        placeholder="Enter your full name"
                    />
                </div>

                <div className="form-group">
                    <label>Target Degree</label>
                    <select
                        className="form-select"
                        value={profile.targetDegree}
                        onChange={(e) => handleChange("targetDegree", e.target.value)}
                    >
                        <option value="MBA">MBA / PGDM</option>
                        <option value="B.Tech">B.Tech / B.E.</option>
                        <option value="M.Tech">M.Tech</option>
                    </select>
                </div>

                <div className="form-section">
                    <h4>Exam Scores (Percentile/Rank)</h4>
                    <div className="exam-grid">
                        {profile.targetDegree.includes("MBA") && (
                            <>
                                <div className="form-group">
                                    <label>CAT Percentile</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={profile.exams.cat}
                                        onChange={(e) => handleExamChange("cat", e.target.value)}
                                        placeholder="e.g. 99.5"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>CMAT Percentile</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={profile.exams.cmat}
                                        onChange={(e) => handleExamChange("cmat", e.target.value)}
                                        placeholder="e.g. 98.0"
                                    />
                                </div>
                            </>
                        )}

                        {profile.targetDegree.includes("Tech") && (
                            <>
                                <div className="form-group">
                                    <label>JEE Main Rank</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={profile.exams.jee}
                                        onChange={(e) => handleExamChange("jee", e.target.value)}
                                        placeholder="e.g. 1500"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>GATE Score</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={profile.exams.gate}
                                        onChange={(e) => handleExamChange("gate", e.target.value)}
                                        placeholder="e.g. 750"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="form-actions">
                    <Button onClick={handleSave} variant="primary">
                        {saved ? "Profile Saved ✨" : "Save Strategy Profile"}
                    </Button>
                </div>
            </div>

            <style jsx>{`
                .profile-form-wrapper {
                    max-width: 600px;
                    margin: 0 auto;
                }
                .profile-form-title {
                    margin-bottom: 24px;
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #1e368a;
                    letter-spacing: -0.02em;
                }
                .profile-form-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #475569;
                }
                .form-input, .form-select {
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    font-size: 1rem;
                    color: #1e293b;
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                }
                .form-input:focus, .form-select:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                .form-section h4 {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #334155;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .exam-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .form-actions {
                    margin-top: 12px;
                    display: flex;
                    justify-content: flex-end;
                }
            `}</style>
        </div>
    );
}
