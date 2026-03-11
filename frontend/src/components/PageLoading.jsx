"use client";

import React from 'react';
import "./PageLoading.css";
import { useAuth } from '../lib/AuthContext';

export default function PageLoading() {
    const { loading } = useAuth();

    if (!loading) return null;

    return (
        <div className="page-loading-wrapper">
            <div className="loading-content">
                <div className="loading-logo">
                    <span className="logo-pulse">CEI</span>
                </div>
                <div className="loading-bar-track">
                    <div className="loading-bar-fill"></div>
                </div>
                <p className="loading-text">Intelligence is loading...</p>
            </div>
        </div>
    );
}
