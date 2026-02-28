"""
phase3_verify.py — CEI Scoring Engine Verification Tool
=========================================================
Cryptographically verify that a scored CSV was produced by a specific
engine run and has not been tampered with since generation.

Usage:
    python src/phase3_verify.py
    python src/phase3_verify.py --csv output/scoring/master_scored_20260228_141000.csv
                                --manifest output/scoring/scoring_run_manifest_20260228_141000.json
"""

import hashlib
import json
import sys
import os
import argparse
import pandas as pd


def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def verify(csv_path: str, manifest_path: str) -> bool:
    print(f"\n{'='*60}")
    print(f"  CEI Scoring Engine Verifier")
    print(f"{'='*60}\n")

    # 1. Load Manifest
    if not os.path.exists(manifest_path):
        print(f"❌  Manifest not found: {manifest_path}")
        return False
    with open(manifest_path) as f:
        manifest = json.load(f)

    print(f"📋  Manifest:")
    print(f"    Engine Version : {manifest.get('engine_version')}")
    print(f"    Run Timestamp  : {manifest.get('run_timestamp')}")
    print(f"    Total Records  : {manifest.get('total_records'):,}")
    print(f"    Input SHA-256  : {manifest.get('input_sha256')}")
    print(f"    Expected Output: {manifest.get('output_sha256')}\n")

    # 2. Verify CSV existence
    if not os.path.exists(csv_path):
        print(f"❌  CSV not found: {csv_path}")
        return False

    # 3. Compute current SHA-256 of CSV
    actual_hash = sha256_file(csv_path)
    expected_hash = manifest.get('output_sha256')

    print(f"🔍  Computed Output SHA-256: {actual_hash}")
    print(f"    Expected SHA-256        : {expected_hash}\n")

    if actual_hash == expected_hash:
        print(f"✅  VERIFIED — The CSV matches the manifest. Data is intact and unmodified.")
        print(f"    Engine v{manifest.get('engine_version')} | Run {manifest.get('run_timestamp')}")

        # 4. Record count sanity check
        df = pd.read_csv(csv_path, low_memory=False)
        actual_count = len(df)
        expected_count = manifest.get('total_records')
        if actual_count != expected_count:
            print(f"\n⚠️  WARNING: Record count mismatch!")
            print(f"    CSV has {actual_count:,} records but manifest says {expected_count:,}.")
            return False
        else:
            print(f"    Record Count: {actual_count:,} ✓")
        print(f"\n{'='*60}\n")
        return True
    else:
        print(f"❌  VERIFICATION FAILED — CSV has been modified after generation!")
        print(f"    The file at '{csv_path}' does not match the manifest record.")
        print(f"    This indicates possible data tampering or corruption.")
        print(f"\n{'='*60}\n")
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='CEI Scoring Engine Verifier')
    parser.add_argument('--csv',      default='output/scoring/master_scored_institutions.csv')
    parser.add_argument('--manifest', default='output/scoring/scoring_run_manifest.json')
    args = parser.parse_args()

    success = verify(args.csv, args.manifest)
    sys.exit(0 if success else 1)
