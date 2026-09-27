#!/usr/bin/env python3
"""Runs the independent package check only.

Repository freshness is a separate command:
python3 scripts/verify_evidence_freshness.py --repo /path/to/mira
Missing repo returns STATUS BLOCKED and does not change this command's result.
"""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_package import main


if __name__ == "__main__":
    print("check=package")
    print("freshness_command=python3 scripts/verify_evidence_freshness.py --repo <mira>")
    raise SystemExit(main())
