import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchExams } from "../lib/api";
import "./DecisionEngine.css";

const STREAMS = ["Engineering", "IT & Computer Science", "Management", "Medical", "Design", "Law", "Arts"];
const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh"
];
const BUDGETS = [
    { label: "Under ₹4 Lakhs", value: "0-400000", hint: "Affordable / Value" },
    { label: "₹4 - ₹10 Lakhs", value: "400000-1000000", hint: "Standard Pvt" },
    { label: "Above ₹10 Lakhs", value: "1000000-10000000", hint: "Elite / Global" }
];

export default function DecisionEngine() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [stream, setStream] = useState("");
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState("");
    const [scoreType, setScoreType] = useState("percentile"); // rank | percentile
    const [scoreValue, setScoreValue] = useState("");
    const [budget, setBudget] = useState("");
    const [state, setState] = useState("");

    const EXAM_SHORT_FORMS = {
        "Joint Entrance Examination": "JEE",
        "JEE Main": "JEE Main",
        "JEE Advanced": "JEE Adv",
        "National Eligibility cum Entrance Test": "NEET",
        "Common Management Admission Test": "CMAT",
        "Common Admission Test": "CAT",
        "Management Aptitude Test": "MAT",
        "Graduate Management Admission Test": "GMAT",
        "Xavier Aptitude Test": "XAT",
        "Symbiosis National Aptitude Test": "SNAP",
        "NMIMS Management Aptitude Test": "NMAT",
        "AIMS Test for Management Admissions": "ATMA",
        "Karnataka Management Aptitude Test": "KMAT",
        "NIT MCA Common Entrance Test": "NIMCET",
        "Maharashtra MCA Common Entrance Test": "MAH MCA CET",
        "Symbiosis Entrance Test": "SET"
    };

    const getExamName = (e) => {
        if (e.shortName) return e.shortName;
        if (EXAM_SHORT_FORMS[e.name]) return EXAM_SHORT_FORMS[e.name];
        return e.name;
    };

    useEffect(() => {
        const load = async () => {
            const data = await fetchExams();
            setExams(data.data || data);
        };
        load();
    }, []);

    const getFilteredExams = () => {
        if (!stream) return exams;
        const s = stream.toLowerCase();
        return exams.filter(e => {
            const type = (e.type || "").toLowerCase();
            const courses = (e.courses || []).map(c => c.toLowerCase());

            if (s === "engineering") return type.includes("engineering") || courses.some(c => c.includes("b.tech") || c.includes("b.e."));
            if (s === "it & computer science") return type.includes("it") || courses.some(c => c.includes("bca") || c.includes("mca") || c.includes("b.sc (cs)"));
            if (s === "management") return type.includes("management") || courses.some(c => c.includes("mba") || c.includes("bba") || c.includes("cat") || c.includes("cmat"));
            if (s === "medical") return type.includes("medical") || courses.some(c => c.includes("mbbs") || c.includes("neet"));
            if (s === "design") return type.includes("design");
            if (s === "law") return type.includes("law") || type.includes("legal") || courses.some(c => c.includes("llb") || c.includes("clat"));
            if (s === "arts") return type.includes("arts") || type.includes("humanities");

            return true;
        });
    };

    const nextStep = () => setStep(s => Math.min(s + 1, 4));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const handleFinalSearch = () => {
        const params = new URLSearchParams();
        if (stream) params.set("course", stream);
        if (selectedExam) params.set("exam", selectedExam);
        if (state) params.set("state", state.toLowerCase());
        if (scoreValue) {
            params.set(scoreType, scoreValue);
            params.set("rank", scoreValue);
        }
        if (budget) params.set("budget", budget);

        params.set("mentor", "true");
        router.push(`/colleges?${params.toString()}`);
    };

    const renderProgress = () => (
        <div className="mentor-progress">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className={`progress-dot ${step >= i ? 'active' : ''} ${step === i ? 'current' : ''}`} />
            ))}
        </div>
    );

    return (
        <div className="mentor-container">
            <div className="mentor-sidebar">
                <div className="mentor-intro">
                    <h3>College Matching Engine</h3>
                    <p>Tell me your background, and I'll find your perfect college matches.</p>
                </div>
                {renderProgress()}
            </div>

            <div className="mentor-content">
                {step === 1 && (
                    <div className="mentor-step fadeIn">
                        <span className="step-count">Step 1/4</span>
                        <h2>What's your stream?</h2>
                        <div className="mentor-grid">
                            {STREAMS.map(s => (
                                <button
                                    key={s}
                                    className={`mentor-card ${stream === s ? 'active' : ''}`}
                                    onClick={() => { setStream(s); nextStep(); }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="mentor-step fadeIn">
                        <span className="step-count">Step 2/4</span>
                        <h2>Which exam did you take?</h2>
                        <p className="step-sub">Compulsory to provide accurate college matches for {stream}.</p>
                        <div className="mentor-exam-grid">
                            {getFilteredExams().length > 0 ? (
                                getFilteredExams().map(e => (
                                    <button
                                        key={e.id}
                                        className={`exam-card ${selectedExam === e.name ? 'active' : ''}`}
                                        onClick={() => { setSelectedExam(e.name); nextStep(); }}
                                    >
                                        <div className="e-name">{getExamName(e)}</div>
                                        <div className="e-type">{e.type || "National"}</div>
                                    </button>
                                ))
                            ) : (
                                <div className="loading-exams">No specific exams found for {stream}. Showing some common ones...</div>
                            )}
                        </div>
                        <button className="nav-btn p mt-6" onClick={prevStep}>Back</button>
                    </div>
                )}

                {step === 3 && (
                    <div className="mentor-step fadeIn">
                        <span className="step-count">Step 3/4</span>
                        <h2>Score in {selectedExam || "Exam"}</h2>

                        <div className="mentor-input-container">
                            <div className="score-toggle-row">
                                <button
                                    className={`toggle-tab ${scoreType === 'percentile' ? 'active' : ''}`}
                                    onClick={() => setScoreType('percentile')}
                                >
                                    Percentile
                                </button>
                                <button
                                    className={`toggle-tab ${scoreType === 'rank' ? 'active' : ''}`}
                                    onClick={() => setScoreType('rank')}
                                >
                                    Rank
                                </button>
                            </div>

                            <div className="mentor-input-wrap">
                                <input
                                    type="number"
                                    className="mentor-input"
                                    placeholder={scoreType === 'percentile' ? "e.g. 98.5" : "e.g. 5000"}
                                    value={scoreValue}
                                    onChange={(e) => setScoreValue(e.target.value)}
                                    autoFocus
                                />
                                <div className="mentor-nav-row">
                                    <button className="nav-btn p" onClick={prevStep}>Back</button>
                                    <button className="nav-btn n" onClick={nextStep} disabled={!scoreValue}>Continue</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="mentor-step fadeIn">
                        <span className="step-count">Step 4/4</span>
                        <h2>Your Preferences</h2>

                        <div className="preferences-wrap">
                            <div className="pref-group">
                                <label>Target State</label>
                                <select className="mentor-select" value={state} onChange={(e) => setState(e.target.value)}>
                                    <option value="">All over India</option>
                                    {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="pref-group">
                                <label>Budget (Total Fees)</label>
                                <div className="budget-chips">
                                    {BUDGETS.map(b => (
                                        <button
                                            key={b.value}
                                            className={`budget-chip ${budget === b.value ? 'active' : ''}`}
                                            onClick={() => setBudget(b.value)}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mentor-nav-row mt-12">
                            <button className="nav-btn p" onClick={prevStep}>Back</button>
                            <button className="nav-btn-final" onClick={handleFinalSearch}>
                                Show Matches →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
