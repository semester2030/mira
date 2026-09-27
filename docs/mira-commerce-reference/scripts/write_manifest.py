#!/usr/bin/env python3
"""Write MANIFEST.json from the package tree. Excludes the manifest itself."""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP_PARTS = {"__MACOSX", "__pycache__"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    project = json.loads((ROOT / "data" / "project.json").read_text(encoding="utf-8"))
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(ROOT)
        if any(part in SKIP_PARTS or part == ".DS_Store" or part.endswith(".pyc") for part in rel.parts):
            continue
        if rel.as_posix() == "MANIFEST.json":
            continue
        files.append({
            "path": rel.as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        })
    now = datetime.now(timezone(timedelta(hours=3))).isoformat()
    manifest = {
        "package": "MIRA_DISCOVER_PHASE1_CORRECTIONS_RC2",
        "studyVersion": project.get("studyVersion"),
        "studyStatus": project.get("studyStatus"),
        "generatedAt": now,
        "baselineSiteZip": "MIRA_ECOMMERCE_REFERENCE_PLACES_PLAN_UPDATE_20260924_0125.zip",
        "baselineSiteSha256": "ad7f070bbc064dcd3153428d6d5ca3712bfaec2e4ddf7da865fc47cfbe7d734d",
        "linkedSourceZip": "DAR_PLACES_TO_MIRA_SOURCE_HANDOFF_RC2_20260924_0125.zip",
        "linkedSourceSha256": "60a8d854eb609e1eef11513a1406fd1e262ac809922e889f2e7beecf76ec48e1",
        "sourceArchiveUnmodified": True,
        "limits": "يثبت اتساق ملفات هذه الحزمة فقط. لا يثبت تشغيل المنتج ولا حداثة أدلة المستودع.",
        "fileCount": len(files),
        "files": files,
    }
    (ROOT / "MANIFEST.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"files={len(files)}")


if __name__ == "__main__":
    main()
