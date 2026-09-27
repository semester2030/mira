#!/usr/bin/env python3
"""Write PACKAGE_MANIFEST.json for a full RC release folder (excludes itself)."""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SKIP = {"__MACOSX", "__pycache__", ".DS_Store"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: write_package_manifest.py <release-root>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    files = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        rel = path.relative_to(root)
        if any(part in SKIP or part.endswith(".pyc") for part in rel.parts):
            continue
        if rel.name == "PACKAGE_MANIFEST.json":
            continue
        files.append(
            {
                "path": rel.as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256_file(path),
            }
        )
    now = datetime.now(timezone(timedelta(hours=3))).isoformat()
    manifest = {
        "package": root.name,
        "generatedAt": now,
        "fileCount": len(files),
        "files": files,
    }
    out = root / "PACKAGE_MANIFEST.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out} files={len(files)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
