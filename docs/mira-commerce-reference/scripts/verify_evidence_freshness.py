#!/usr/bin/env python3
"""Compare fact evidence with a MIRA checkout. Absence of the repo is not a package failure."""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True

import argparse
import hashlib
import json
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Freshness check for fact evidence. Requires --repo.")
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument("--repo", default="")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    evidence = json.loads((root / "data" / "evidence-index.json").read_text(encoding="utf-8"))
    facts = [row for row in evidence if row.get("claimType") == "fact"]
    print(f"fact_checks={len(facts)}")
    for row in facts:
        print(f"FACT {row.get('id')} {row.get('path')}")
    repo = Path(args.repo).expanduser() if args.repo else None
    if repo is None or not str(args.repo).strip() or not repo.is_dir():
        print("STATUS BLOCKED")
        print("REASON repository path was not provided or does not exist")
        print("package check is independent and is not failed by this status")
        return 2
    baseline_drift = baseline_unhashed = baseline_match = baseline_missing = 0
    current_match = current_mismatch = current_unverified = unclassified = 0
    for row in facts:
        role = row.get("freshnessRole") or ""
        evidence_id = row.get("id")
        rel = row.get("path") or ""
        path = repo / rel
        expected = row.get("fileSha256") or ""
        if role not in ("baseline", "current"):
            print(f"UNCLASSIFIED {evidence_id} {rel}")
            unclassified += 1
            continue
        prefix = "BASELINE" if role == "baseline" else "CURRENT"
        if not path.is_file():
            print(f"{prefix}_MISSING {evidence_id} {rel}")
            if role == "baseline":
                baseline_missing += 1
            else:
                current_mismatch += 1
            continue
        actual = sha256_file(path)
        if role == "baseline":
            if not expected:
                print(f"BASELINE_UNHASHED {evidence_id} {rel}")
                baseline_unhashed += 1
            elif actual != expected:
                print(f"BASELINE_DRIFT {evidence_id} {rel}")
                baseline_drift += 1
            else:
                print(f"BASELINE_MATCH {evidence_id} {rel}")
                baseline_match += 1
            continue
        if not expected:
            print(f"CURRENT_UNVERIFIED {evidence_id} {rel}")
            current_unverified += 1
        elif actual != expected:
            print(f"CURRENT_MISMATCH {evidence_id} {rel}")
            current_mismatch += 1
        else:
            print(f"CURRENT_MATCH {evidence_id} {rel}")
            current_match += 1
    print(
        "STATUS CURRENT_RECORDED "
        f"baseline_match={baseline_match} baseline_drift={baseline_drift} "
        f"baseline_unhashed={baseline_unhashed} baseline_missing={baseline_missing} "
        f"current_match={current_match} current_mismatch={current_mismatch} "
        f"current_unverified={current_unverified} unclassified={unclassified}"
    )
    print("baseline drift is recorded and is not a current-state pass")
    print("NOT_RUN is not PASS. CURRENT_RECORDED is not a pass of baseline pins")
    if current_mismatch or current_unverified or unclassified or baseline_missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
