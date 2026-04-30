import React from 'react';
import UnifiedPredictorDashboard from '@/components/predictor/UnifiedPredictorDashboard';

export const metadata = {
    title: 'National Admission Predictor | CEI',
    description: 'Statistically grounded admission predictions for JEE Main (JoSAA/CSAB) and NEET UG (MCC) counseling. High-fidelity outcome vectors with verified truth data.',
};

export default function PredictorPage() {
    return (
        <div className="min-h-screen bg-white">
            <UnifiedPredictorDashboard />
        </div>
    );
}
