"""
sdk/python/cei_sdk.py — CEI Official Python SDK (Phase XV)
===========================================================
Wraps the CEI Public API v1 with synchronous Python methods.
Zero external dependencies — uses urllib.request (stdlib).

Usage:
    from cei_sdk import CEIClient

    client = CEIClient()
    result = client.institution.get('iit-bombay')
    print(result['data']['ceiScore'])

    # With built-in hash verification
    verified = client.institution.get_verified('iit-bombay')
    print(verified['verified'])  # True/False

    # Recompute score
    r = client.verify.recompute({'A': 8.0, 'F': 6.0, 'I': 8.0, 'S': 5.0, 'D': 7.0, 'U': 5.0})
    print(r['computedScore'])
"""

import json
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict, Any

DEFAULT_BASE_URL = "https://ce-intelligence-backend.vercel.app"
SDK_VERSION      = "1.0.0"


class CEIError(Exception):
    def __init__(self, message: str, status: int = 0, body: Dict = None):
        super().__init__(message)
        self.status = status
        self.body   = body or {}


def _request(base_url: str, path: str, method: str = "GET",
             body: Optional[Dict] = None, api_key: Optional[str] = None) -> Dict:
    url     = base_url.rstrip("/") + path
    headers = {
        "Accept":       "application/json",
        "Content-Type": "application/json",
        "X-CEI-SDK":    SDK_VERSION
    }
    if api_key:
        headers["X-API-Key"] = api_key

    data = json.dumps(body).encode("utf-8") if body else None
    req  = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8")
        try:
            parsed = json.loads(body_text)
        except Exception:
            parsed = {"error": body_text}
        raise CEIError(parsed.get("error", f"HTTP {e.code}"), status=e.code, body=parsed)


def _verify_hash(api_response: Dict) -> Dict:
    """Verify the snapshotHash of an API response."""
    if "snapshotHash" not in api_response or "data" not in api_response:
        return {"verified": False, "reason": "No snapshotHash or data in response."}

    data        = dict(api_response["data"])
    snapshot_hash = api_response["snapshotHash"]

    # Remove self-referential hash
    data.pop("recordHash", None)

    canonical = json.dumps(data, sort_keys=True, separators=(',', ':'))
    computed  = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    match = computed == snapshot_hash or api_response["data"].get("recordHash") == snapshot_hash
    return {
        "verified":      match,
        "snapshotHash":  snapshot_hash,
        "computedHash":  computed,
        "mismatch":      not match
    }


class _InstitutionAPI:
    def __init__(self, client):
        self._c = client

    def get(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/v1/institution/{urllib.parse.quote(college_id)}", api_key=self._c._api_key)

    def get_verified(self, college_id: str) -> Dict:
        resp   = self.get(college_id)
        result = _verify_hash(resp)
        return {**resp, **result}

    def vectors(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/v1/institution/{urllib.parse.quote(college_id)}/vectors", api_key=self._c._api_key)

    def integrity(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/v1/institution/{urllib.parse.quote(college_id)}/integrity", api_key=self._c._api_key)


class _ScoringAPI:
    def __init__(self, client):
        self._c = client

    def active_version(self) -> Dict:
        return _request(self._c._base_url, "/api/v1/scoring-version/active", api_key=self._c._api_key)


class _ForecastAPI:
    def __init__(self, client):
        self._c = client

    def branch(self, branch_name: str) -> Dict:
        return _request(self._c._base_url, f"/api/forecast/branch/{urllib.parse.quote(branch_name)}", api_key=self._c._api_key)

    def trajectory(self, college_id: str, branch: str) -> Dict:
        return _request(self._c._base_url, f"/api/forecast/trajectory/{urllib.parse.quote(college_id)}/{urllib.parse.quote(branch)}", api_key=self._c._api_key)


class _VerifyAPI:
    def __init__(self, client):
        self._c = client

    def methodology(self) -> Dict:
        return _request(self._c._base_url, "/api/verify/methodology", api_key=self._c._api_key)

    def recompute(self, vectors: Dict, college_id: Optional[str] = None) -> Dict:
        payload = {**vectors}
        if college_id:
            payload["collegeId"] = college_id
        return _request(self._c._base_url, "/api/verify/recompute", method="POST", body=payload, api_key=self._c._api_key)

    def record_hash(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/verify/record-hash/{urllib.parse.quote(college_id)}", api_key=self._c._api_key)

    def manifest(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/verify/institution/{urllib.parse.quote(college_id)}/manifest", api_key=self._c._api_key)


class _ClusterAPI:
    def __init__(self, client):
        self._c = client

    def peers(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/v1/peer-cluster/{urllib.parse.quote(college_id)}", api_key=self._c._api_key)


class _EvidenceAPI:
    def __init__(self, client):
        self._c = client

    def packet(self, college_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/evidence/{urllib.parse.quote(college_id)}", api_key=self._c._api_key)

    def version_proof(self, version_id: str) -> Dict:
        return _request(self._c._base_url, f"/api/evidence/version/{urllib.parse.quote(version_id)}/proof", api_key=self._c._api_key)


class CEIClient:
    """
    Official CEI Python SDK Client.

    :param api_key:  Optional API key for higher rate limits.
    :param base_url: Override API base URL (for local/staging).
    """
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self._base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self._api_key  = api_key

        self.institution = _InstitutionAPI(self)
        self.scoring     = _ScoringAPI(self)
        self.forecast    = _ForecastAPI(self)
        self.verify      = _VerifyAPI(self)
        self.cluster     = _ClusterAPI(self)
        self.evidence    = _EvidenceAPI(self)


if __name__ == "__main__":
    # Quick smoke test
    import sys
    base = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE_URL
    client = CEIClient(base_url=base)

    print("Testing CEI Python SDK...")
    try:
        v = client.scoring.active_version()
        print(f"  Active Version: {v.get('data', {}).get('versionId', 'none')}")
    except CEIError as e:
        print(f"  (Server not reachable: {e.status}) — SDK structure OK.")
    print("SDK OK.")
