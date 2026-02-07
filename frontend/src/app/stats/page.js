"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";
import "./page.css";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function StatsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/stats/aggregate`)
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch stats", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <div className="stats-container">
                <div className="stats-header">
                    <h1>Analytics Dashboard</h1>
                    <p>Loading insights...</p>
                </div>
            </div>
        );
    }

    if (!data) return <div>Error loading data</div>;

    return (
        <div className="stats-container">
            <div className="stats-header">
                <h1>Higher Education Analytics</h1>
                <p>Insights from {data.totalColleges} colleges and {data.totalExams} exams across India</p>
            </div>

            <div className="stats-grid">
                {/* State Distribution */}
                <div className="stats-card">
                    <h2>Colleges by State</h2>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.stateDistribution.slice(0, 10)}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-30} textAnchor="end" height={60} />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Exam Popularity */}
                <div className="stats-card">
                    <h2>Top Entrance Exams</h2>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={data.examPopularity}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {data.examPopularity.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
