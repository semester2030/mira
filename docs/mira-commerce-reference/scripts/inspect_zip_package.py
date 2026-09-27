#!/usr/bin/env python3
"""Classify every ZIP entry. is_file() alone is not a complete extra=0 check."""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True

import hashlib
import json
import stat
import zipfile
from collections import Counter
from pathlib import Path


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def kind_of(info: zipfile.ZipInfo) -> str:
    mode = (info.external_attr >> 16) & 0xFFFF
    if stat.S_ISLNK(mode):
        return "symlink"
    if info.is_dir() or info.filename.endswith("/"):
        return "directory"
    return "regular"


def unsafe(name: str) -> bool:
    path = Path(name)
    return path.is_absolute() or ".." in path.parts or "\\" in name


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: inspect_zip_package.py <zip> <unpacked-root>", file=sys.stderr)
        return 2
    archive = Path(sys.argv[1])
    root = Path(sys.argv[2]).resolve()
    manifest = json.loads((root / "PACKAGE_MANIFEST.json").read_text(encoding="utf-8"))
    expected = {row["path"]: row for row in manifest["files"]}
    counts: Counter[str] = Counter()
    seen: Counter[str] = Counter()
    missing = []
    mismatches = []
    extra = []
    symlinks = []
    unsafe_paths = []
    with zipfile.ZipFile(archive) as handle:
        for info in handle.infolist():
            name = info.filename
            seen[name] += 1
            if unsafe(name):
                unsafe_paths.append(name)
            kind = kind_of(info)
            counts[kind] += 1
            if kind == "symlink":
                symlinks.append(name)
                extra.append(name)
                continue
            if kind == "directory":
                continue
            rel = name.lstrip("/")
            if rel == "PACKAGE_MANIFEST.json":
                data = handle.read(info)
                disk = (root / "PACKAGE_MANIFEST.json").read_bytes()
                if data != disk:
                    mismatches.append(f"{rel} zip bytes differ from unpacked manifest")
                continue
            row = expected.get(rel)
            if row is None:
                extra.append(rel)
                continue
            data = handle.read(info)
            digest = sha256_bytes(data)
            if len(data) != row["bytes"] or digest != row["sha256"]:
                mismatches.append(rel)
        handle.testzip()
    duplicates = [name for name, count in seen.items() if count > 1]
    for rel, row in expected.items():
        disk = root / rel
        if not disk.is_file() or disk.is_symlink():
            missing.append(rel)
            continue
        if disk.stat().st_size != row["bytes"] or sha256_bytes(disk.read_bytes()) != row["sha256"]:
            mismatches.append(f"{rel} unpacked bytes differ from manifest")
    print(f"regular={counts['regular']} directories={counts['directory']} symlinks={counts['symlink']}")
    print(f"missing={len(set(missing))} mismatches={len(set(mismatches))} extra={len(extra)} duplicates={len(duplicates)} unsafe={len(unsafe_paths)}")
    for label, rows in (("SYMLINK", symlinks), ("EXTRA", extra), ("MISSING", missing), ("MISMATCH", mismatches), ("DUPLICATE", duplicates), ("UNSAFE", unsafe_paths)):
        for row in rows:
            print(f"{label} {row}")
    if symlinks or extra or missing or mismatches or duplicates or unsafe_paths:
        return 1
    print("ZIP_TYPES_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
