/**
 * app/developers/page.js — CEI Developer Portal (Phase XIV)
 * ==========================================================
 * Static documentation page for the CEI Public API v1.
 * Includes: endpoint reference, code samples, verification tool, API key request.
 */

import "./developers.css";

export const metadata = {
    title: "CEI Developer API — Public API v1 Documentation",
    description:
        "CEI Public API v1: Access evaluated institution scores, data provenance, and methodology — all tied to an immutable ScoringVersion. Open, documented, verifiable.",
};

const BASE_URL = "https://ce-intelligence-backend.vercel.app";

const ENDPOINTS = [
    {
        method: "GET",
        path: "/api/v1/institution/:id",
        description: "Institution summary: score, band, integrity, record hash",
        example: `${BASE_URL}/api/v1/institution/iit-bombay`,
    },
    {
        method: "GET",
        path: "/api/v1/institution/:id/vectors",
        description: "CEI vector breakdown (A, F, I, S, D, U) with weights and normalized scores",
        example: `${BASE_URL}/api/v1/institution/iit-bombay/vectors`,
    },
    {
        method: "GET",
        path: "/api/v1/institution/:id/integrity",
        description: "Field-level data provenance — source type, verification status, confidence",
        example: `${BASE_URL}/api/v1/institution/iit-bombay/integrity`,
    },
    {
        method: "GET",
        path: "/api/v1/scoring-version/active",
        description: "Active scoring methodology: weights, dataset hash, chaos certification",
        example: `${BASE_URL}/api/v1/scoring-version/active`,
    },
    {
        method: "GET",
        path: "/api/v1/peer-cluster/:id",
        description: "Peer cluster: same-state, same-tier institutions with score comparisons",
        example: `${BASE_URL}/api/v1/peer-cluster/iit-bombay`,
    },
    {
        method: "GET",
        path: "/api/forecast/branch/:name",
        description: "3-year branch outlook (Growth | Stable | Declining) with risk index",
        example: `${BASE_URL}/api/forecast/branch/Computer%20Science`,
    },
    {
        method: "GET",
        path: "/api/forecast/trajectory/:collegeId/:branch",
        description: "Monte Carlo 5-year salary trajectory (pessimistic / realistic / optimistic)",
        example: `${BASE_URL}/api/forecast/trajectory/iit-bombay/Computer%20Science`,
    },
];

const METHOD_COLORS = { GET: "#34d399", POST: "#fbbf24" };

export default function DevelopersPage() {
    return (
        <main className="dev-page">
            {/* Hero */}
            <section className="dev-hero">
                <div className="dev-hero-badge">Public API v1</div>
                <h1 className="dev-hero-title">CEI Developer API</h1>
                <p className="dev-hero-sub">
                    Build on verifiable, version-locked education intelligence data.<br />
                    Every response is tied to an immutable{" "}
                    <code>ScoringVersion</code> with a{" "}
                    <code>snapshotHash</code> for public audit.
                </p>
                <div className="dev-hero-pills">
                    <span className="dev-pill">🔒 Immutable Versions</span>
                    <span className="dev-pill">🔍 Data Provenance</span>
                    <span className="dev-pill">📊 Monte Carlo Stability</span>
                    <span className="dev-pill">⚡ 100 req/15min</span>
                </div>
            </section>

            {/* Base URL */}
            <section className="dev-section">
                <h2 className="dev-section-title">Base URL</h2>
                <div className="dev-code-block">
                    <code>{BASE_URL}</code>
                </div>
                <p className="dev-caption">
                    All responses include: <code>apiVersion</code>, <code>scoringVersion</code>,{" "}
                    <code>snapshotHash</code>, <code>generatedAt</code>.
                </p>
            </section>

            {/* Response Envelope */}
            <section className="dev-section">
                <h2 className="dev-section-title">Response Envelope</h2>
                <div className="dev-code-block">
                    <pre>{`{
  "apiVersion": "v1",
  "generatedAt": "2026-02-28T10:30:00.000Z",
  "scoringVersion": "2026.02.28-v1",
  "snapshotHash": "a3f9c2...",
  "data": { ... }
}`}</pre>
                </div>
            </section>

            {/* Endpoints */}
            <section className="dev-section">
                <h2 className="dev-section-title">Endpoints</h2>
                <div className="dev-endpoints">
                    {ENDPOINTS.map((ep, i) => (
                        <div key={i} className="dev-endpoint-card">
                            <div className="dev-ep-header">
                                <span
                                    className="dev-method"
                                    style={{ color: METHOD_COLORS[ep.method] || "#94a3b8" }}
                                >
                                    {ep.method}
                                </span>
                                <code className="dev-path">{ep.path}</code>
                            </div>
                            <p className="dev-ep-desc">{ep.description}</p>
                            <div className="dev-ep-example">
                                <span className="dev-ex-label">Example</span>
                                <a
                                    href={ep.example}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="dev-ex-link"
                                >
                                    {ep.example}
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Code Sample */}
            <section className="dev-section">
                <h2 className="dev-section-title">Quick Start — JavaScript</h2>
                <div className="dev-code-block">
                    <pre>{`const BASE = "https://ce-intelligence-backend.vercel.app";

async function getInstitution(collegeId) {
  const res = await fetch(\`\${BASE}/api/v1/institution/\${collegeId}\`);
  const { data, scoringVersion, snapshotHash } = await res.json();

  console.log("Score:", data.ceiScore);
  console.log("Scoring Version:", scoringVersion);
  console.log("Record Hash:",    snapshotHash);  // Verifiable!
}

getInstitution("iit-bombay");`}</pre>
                </div>
            </section>

            {/* Curl sample */}
            <section className="dev-section">
                <h2 className="dev-section-title">Quick Start — cURL</h2>
                <div className="dev-code-block">
                    <pre>{`# Get institution summary
curl ${BASE_URL}/api/v1/institution/iit-bombay

# Get branch forecasting
curl "${BASE_URL}/api/forecast/branch/Computer%20Science"

# Get active scoring methodology
curl ${BASE_URL}/api/v1/scoring-version/active`}</pre>
                </div>
            </section>

            {/* Verify Hash */}
            <section className="dev-section">
                <h2 className="dev-section-title">Verify a Record Hash</h2>
                <p className="dev-caption">
                    Every institution record includes a <code>snapshotHash</code> — a{" "}
                    SHA-256 hash of the canonical sorted JSON of that record. You can
                    recompute it locally to verify the API hasn&apos;t been tampered with.
                </p>
                <div className="dev-code-block">
                    <pre>{`// Node.js verification
const crypto = require("crypto");

// 1. Fetch the record
const res  = await fetch("https://ce-intelligence-backend.vercel.app/api/v1/institution/iit-bombay");
const { data, snapshotHash } = await res.json();

// 2. Recompute — sort keys canonically, exclude envelope fields
const { apiVersion, generatedAt, scoringVersion, ...record } = data;
const computedHash = crypto
  .createHash("sha256")
  .update(JSON.stringify(record, Object.keys(record).sort()))
  .digest("hex");

// 3. Compare
console.log(computedHash === snapshotHash ? "✅ EVALUATED" : "❌ MISMATCH");`}</pre>
                </div>
            </section>

            {/* Rate Limits */}
            <section className="dev-section">
                <h2 className="dev-section-title">Rate Limits</h2>
                <table className="dev-table">
                    <thead>
                        <tr>
                            <th>Tier</th>
                            <th>Limit</th>
                            <th>Window</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Anonymous</td>
                            <td>100 requests</td>
                            <td>15 minutes</td>
                        </tr>
                        <tr>
                            <td>API Key (Free)</td>
                            <td>1,000 requests</td>
                            <td>15 minutes</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            {/* Footer note */}
            <section className="dev-section dev-footer-note">
                <p>
                    CEI is deterministic, constitutionally versioned infrastructure.
                    Data never changes silently — every scoring version is immutable once activated.
                    Build with confidence.
                </p>
            </section>
        </main>
    );
}
