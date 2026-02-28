/**
 * sdk/index.js — CEI Official JavaScript SDK (Phase XV)
 * =======================================================
 * Publishable NPM package: @cei/sdk
 * Wraps the CEI Public API v1 with typed methods & built-in hash verification.
 *
 * Usage:
 *   const CEI = require('@cei/sdk');
 *   const client = new CEI.Client();
 *   const result = await client.institution.getVerified('iit-bombay');
 *   console.log(result.data.ceiScore, result.verified);
 *
 * No dependencies required — uses built-in https module.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const DEFAULT_BASE_URL = 'https://ce-intelligence-backend.vercel.app';
const SDK_VERSION = '1.0.0';

// ── HTTP Helper ────────────────────────────────────────────────────────────

function request(baseUrl, path, method = 'GET', body = null, apiKey = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, baseUrl);
        const isHttps = url.protocol === 'https:';
        const lib = isHttps ? https : http;

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-CEI-SDK': SDK_VERSION
        };
        if (apiKey) headers['X-API-Key'] = apiKey;

        const bodyStr = body ? JSON.stringify(body) : null;
        if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

        const req = lib.request(url.toString(), { method, headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    let parsed;
                    try { parsed = JSON.parse(data); } catch { parsed = { error: data }; }
                    reject(Object.assign(new Error(parsed.error || `HTTP ${res.statusCode}`), { status: res.statusCode, body: parsed }));
                    return;
                }
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('Invalid JSON response from CEI API')); }
            });
        });

        req.on('error', reject);
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

// ── Hash Verification ──────────────────────────────────────────────────────

/**
 * Verifies that a CEI API response has not been tampered with.
 * Returns { verified: true } if snapshotHash matches the recomputed hash.
 */
function verifyResponseHash(apiResponse) {
    if (!apiResponse?.snapshotHash || !apiResponse?.data) {
        return { verified: false, reason: 'No snapshotHash or data in response.' };
    }

    const { data, apiVersion, generatedAt, scoringVersion, snapshotHash, ...rest } = apiResponse;
    const { recordHash: _rh, ...hashableData } = data; // exclude self-referential hash

    // Recompute
    const computed = crypto
        .createHash('sha256')
        .update(JSON.stringify(hashableData, Object.keys(hashableData).sort()))
        .digest('hex');

    const match = computed === snapshotHash || data.recordHash === snapshotHash;
    return {
        verified: match,
        snapshotHash,
        computedHash: computed,
        mismatch: !match
    };
}

// ── CEI Client ─────────────────────────────────────────────────────────────

class CEIClient {
    /**
     * @param {object} options
     * @param {string} [options.apiKey]    - Optional API key for higher rate limits
     * @param {string} [options.baseUrl]   - Override API base URL (for local development)
     */
    constructor(options = {}) {
        this._baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
        this._apiKey = options.apiKey || null;

        this.institution = {
            /**
             * Get institution summary.
             * @param {string} collegeId
             */
            get: (collegeId) =>
                request(this._baseUrl, `/api/v1/institution/${encodeURIComponent(collegeId)}`, 'GET', null, this._apiKey),

            /**
             * Get institution summary with built-in hash verification.
             * Returns the API response plus `{ verified, mismatch }`.
             */
            getVerified: async (collegeId) => {
                const res = await request(this._baseUrl, `/api/v1/institution/${encodeURIComponent(collegeId)}`, 'GET', null, this._apiKey);
                const hashResult = verifyResponseHash(res);
                return { ...res, ...hashResult };
            },

            /** CEI vector breakdown (A, F, I, S, D, U with weights). */
            vectors: (collegeId) =>
                request(this._baseUrl, `/api/v1/institution/${encodeURIComponent(collegeId)}/vectors`, 'GET', null, this._apiKey),

            /** Field-level data provenance. */
            integrity: (collegeId) =>
                request(this._baseUrl, `/api/v1/institution/${encodeURIComponent(collegeId)}/integrity`, 'GET', null, this._apiKey)
        };

        this.scoring = {
            /** Active ScoringVersion with weights, hashes, and chaos certification. */
            activeVersion: () =>
                request(this._baseUrl, '/api/v1/scoring-version/active', 'GET', null, this._apiKey)
        };

        this.forecast = {
            /**
             * 3-year branch outlook.
             * @param {string} branchName
             */
            branch: (branchName) =>
                request(this._baseUrl, `/api/forecast/branch/${encodeURIComponent(branchName)}`, 'GET', null, this._apiKey),

            /**
             * 5-year Monte Carlo salary trajectory.
             * @param {string} collegeId
             * @param {string} branch
             */
            trajectory: (collegeId, branch) =>
                request(this._baseUrl, `/api/forecast/trajectory/${encodeURIComponent(collegeId)}/${encodeURIComponent(branch)}`, 'GET', null, this._apiKey)
        };

        this.verify = {
            /** Machine-readable scoring methodology. */
            methodology: () =>
                request(this._baseUrl, '/api/verify/methodology', 'GET', null, this._apiKey),

            /**
             * Recompute a CEI score from raw vectors.
             * @param {object} vectors - { A, F, I, S, D, U }
             * @param {string} [collegeId] - Optional: compare against stored score
             */
            recompute: (vectors, collegeId) =>
                request(this._baseUrl, '/api/verify/recompute', 'POST', { ...vectors, collegeId }, this._apiKey),

            /**
             * Get record hash for an institution.
             * @param {string} collegeId
             */
            recordHash: (collegeId) =>
                request(this._baseUrl, `/api/verify/record-hash/${encodeURIComponent(collegeId)}`, 'GET', null, this._apiKey),

            /**
             * Get full input vector manifest for a college.
             * @param {string} collegeId
             */
            manifest: (collegeId) =>
                request(this._baseUrl, `/api/verify/institution/${encodeURIComponent(collegeId)}/manifest`, 'GET', null, this._apiKey)
        };

        this.cluster = {
            /**
             * Peer cluster for an institution (same state + tier).
             * @param {string} collegeId
             */
            peers: (collegeId) =>
                request(this._baseUrl, `/api/v1/peer-cluster/${encodeURIComponent(collegeId)}`, 'GET', null, this._apiKey)
        };

        this.evidence = {
            /**
             * Public regulatory evidence packet.
             * @param {string} collegeId
             */
            packet: (collegeId) =>
                request(this._baseUrl, `/api/evidence/${encodeURIComponent(collegeId)}`, 'GET', null, this._apiKey),

            /**
             * ScoringVersion proof (freeze window, chaos certification).
             * @param {string} versionId
             */
            versionProof: (versionId) =>
                request(this._baseUrl, `/api/evidence/version/${encodeURIComponent(versionId)}/proof`, 'GET', null, this._apiKey)
        };
    }
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = {
    Client: CEIClient,
    verifyResponseHash,
    SDK_VERSION,
    DEFAULT_BASE_URL
};
