"use client";

import { useState, useEffect } from "react";
import GlassPanel from "./GlassPanel"; // Assuming this exists or use a div
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
        // Dispatch event for other components if needed
        window.dispatchEvent(new Event("profile-update"));

        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
                    Student Profile
                </h3>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#475569' }}>Full Name</label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            placeholder="Enter your name"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#475569' }}>Target Degree</label>
                        <select
                            value={profile.targetDegree}
                            onChange={(e) => handleChange("targetDegree", e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                        >
                            <option value="MBA">MBA / PGDM</option>
                            <option value="B.Tech">B.Tech / B.E.</option>
                            <option value="M.Tech">M.Tech</option>
                        </select>
                    </div>

                    <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#334155' }}>Exam Scores (Percentile/Rank)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {profile.targetDegree.includes("MBA") && (
                                <>
                                    <div>
                                        <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>CAT %ile</label>
                                        <input
                                            type="number"
                                            value={profile.exams.cat}
                                            onChange={(e) => handleExamChange("cat", e.target.value)}
                                            placeholder="99.5"
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>CMAT %ile</label>
                                        <input
                                            type="number"
                                            value={profile.exams.cmat}
                                            onChange={(e) => handleExamChange("cmat", e.target.value)}
                                            placeholder="98.0"
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        />
                                    </div>
                                </>
                            )}

                            {profile.targetDegree.includes("Tech") && (
                                <>
                                    <div>
                                        <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>JEE Main Rank</label>
                                        <input
                                            type="number"
                                            value={profile.exams.jee}
                                            onChange={(e) => handleExamChange("jee", e.target.value)}
                                            placeholder="Rank"
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' }}>GATE Score</label>
                                        <input
                                            type="number"
                                            value={profile.exams.gate}
                                            onChange={(e) => handleExamChange("gate", e.target.value)}
                                            placeholder="Score"
                                            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <Button onClick={handleSave} variant="primary">
                            {saved ? "Saved ✨" : "Save Profile"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
