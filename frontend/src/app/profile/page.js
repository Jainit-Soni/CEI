"use client";

import ProfileForm from "@/components/ProfileForm";
import Container from "@/components/Container";
import "./profile.css";

export default function ProfilePage() {
    return (
        <div className="profile-page">
            <Container>
                <div className="profile-header">
                    <h1 className="profile-title">Student Profile</h1>
                    <p className="profile-subtitle">Manage your academic details and exam scores for personalized AI insights.</p>
                </div>

                <div className="profile-container">
                    <ProfileForm />
                </div>
            </Container>
        </div>
    );
}
