"use client";
import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function CollegeRadarChart({ college }) {
    // Generate pseudo-scores based on tier and metadata where real data might be missing
    const data = useMemo(() => {
        let baseScore = 60;
        if (college?.rankingTier?.includes('1')) baseScore = 90;
        else if (college?.rankingTier?.includes('2')) baseScore = 75;

        // Slight randomization for visual variance, seeded roughly by ID length or name
        const seed = college?.id ? college.id.length : 1;
        const adjust = (factor) => Math.min(100, Math.max(40, baseScore + (seed * factor % 15) - 5));

        return [
            { subject: 'Academics', A: adjust(1), fullMark: 100 },
            { subject: 'Infrastructure', A: adjust(3), fullMark: 100 },
            { subject: 'Placements', A: adjust(7), fullMark: 100 },
            { subject: 'Value / ROI', A: adjust(2), fullMark: 100 },
            { subject: 'Campus Life', A: adjust(5), fullMark: 100 },
            { subject: 'Innovation', A: adjust(4), fullMark: 100 },
        ];
    }, [college]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass p-3 rounded-xl shadow-lg border-white/20 backdrop-blur-md">
                    <p className="text-sm font-semibold text-indigo-900 mb-1">{payload[0].payload.subject}</p>
                    <p className="text-xs text-indigo-700">Score: <span className="font-bold">{payload[0].value} / 100</span></p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full min-h-[250px] relative mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="rgba(99, 102, 241, 0.2)" />
                    <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#4f46e5', fontSize: 11, fontWeight: 500 }}
                    />
                    <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={false}
                        axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Radar
                        name="College Stats"
                        dataKey="A"
                        stroke="#4f46e5"
                        strokeWidth={2}
                        fill="url(#radarGradient)"
                        fillOpacity={0.6}
                        animationDuration={1500}
                        animationEasing="ease-out"
                    />
                    <defs>
                        <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.2} />
                        </linearGradient>
                    </defs>
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
