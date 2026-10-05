#!/usr/bin/env python3
"""Stage MIRA_COMMERCE_MC_FIX_RC7 tree with correct Flutter test paths.

RC6 incorrectly placed test/features/marketplace/*.dart under top-level marketplace/.
This packer always maps those files to test/features/marketplace/ and includes
integration_test/discover_playback_rc2_test.dart when present.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import hashlib
from pathlib import Path

FORBIDDEN_DIR_NAMES = {
    ".git",
    ".dart_tool",
    "build",
    "node_modules",
    ".symlinks",
    "__pycache__",
    ".venv",
    ".venv-face",
    "Pods",
    "DerivedData",
}
FORBIDDEN_FILE_SUFFIXES = {".pyc", ".env", ".DS_Store"}
FORBIDDEN_FILE_NAMES = {".DS_Store", ".env"}


def should_skip(path: Path, root: Path) -> bool:
    rel_parts = path.relative_to(root).parts
    if any(part in FORBIDDEN_DIR_NAMES for part in rel_parts):
        return True
    if path.name in FORBIDDEN_FILE_NAMES:
        return True
    if path.suffix in FORBIDDEN_FILE_SUFFIXES:
        return True
    if path.name.endswith(".zip") or path.name.endswith(".zip.sha256"):
        return True
    return False


def copy_tree(src: Path, dst: Path, root: Path) -> int:
    count = 0
    for path in src.rglob("*"):
        if not path.is_file():
            continue
        if path.is_symlink():
            continue
        if should_skip(path, root):
            continue
        rel = path.relative_to(src)
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        count += 1
    return count


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--stage", required=True)
    args = ap.parse_args()
    repo = Path(args.repo).resolve()
    stage = Path(args.stage).resolve()
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    roots = [
        "lib",
        "android",
        "ios",
        "packages",
        "mira-api",
        "partners-portal",
        "admin-portal",
        "docs/mira-commerce-reference",
        "test/features/marketplace",
        "integration_test",
    ]
    copied = {}
    for rel in roots:
        src = repo / rel
        if not src.exists():
            copied[rel] = 0
            continue
        n = copy_tree(src, stage / rel, repo)
        copied[rel] = n

    for name in ("pubspec.yaml", "pubspec.lock", "analysis_options.yaml"):
        src = repo / name
        if src.is_file():
            shutil.copy2(src, stage / name)
            copied[name] = 1

    # Guard: never leave marketplace tests at package root.
    bad = stage / "marketplace"
    if bad.exists():
        raise SystemExit("refusing stage with top-level marketplace/ (RC6 packaging bug)")

    mp = stage / "test/features/marketplace"
    dart = sorted(mp.glob("*.dart")) if mp.is_dir() else []
    playback = stage / "integration_test/discover_playback_rc2_test.dart"
    report = {
        "stage": str(stage),
        "copied": copied,
        "marketplace_test_dart": len(dart),
        "marketplace_test_files": [p.name for p in dart],
        "integration_playback_present": playback.is_file(),
    }
    (stage / "PACK_STAGE_REPORT.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if len(dart) < 20:
        raise SystemExit(f"expected >=20 marketplace dart tests, got {len(dart)}")
    if not playback.is_file():
        raise SystemExit("missing integration_test/discover_playback_rc2_test.dart")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
