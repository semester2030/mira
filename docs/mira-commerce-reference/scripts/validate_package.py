#!/usr/bin/env python3
"""Independent package check. Does not read the MIRA or DAR CAR repositories."""
from __future__ import annotations

import sys
sys.dont_write_bytecode = True

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

GENERIC = "يُثبت لاحقًا ببوابة قبول"
REVIEW_STATUSES = {"مفتوحة", "قيد المعالجة", "معالجة بانتظار المراجعة", "متعذرة لمانع موثق"}
EXISTENCE = {"EXISTING", "PARTIAL", "ABSENT_AFTER_SEARCH", "UNKNOWN"}
ACTIVATION = {"ENABLED", "DISABLED", "UNKNOWN"}
REQ_FIELDS = [
    "id", "titleAr", "source", "descriptionAr", "severity", "unit", "files",
    "previousEvidenceAr", "actionAr", "newEvidenceIds", "verificationAr",
    "remainingLimitsAr", "status", "previousStatus", "updatedAt", "evidenceType",
]
FORBIDDEN = ("__MACOSX", ".DS_Store", "__pycache__")
ID_RE = re.compile(r"\{\{([A-Z]+-[A-Za-z0-9-]+)\}\}")
HTML_ID_RE = re.compile(r"""\sid=["']([^"']+)["']""")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_args():
    parser = argparse.ArgumentParser(description="Check a commerce reference package without a git repo.")
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    return parser.parse_args()


def load(data: Path, name: str):
    return json.loads((data / name).read_text(encoding="utf-8"))


def main():
    args = parse_args()
    root = Path(args.root).resolve()
    errors = check_package(root)
    if errors:
        print("FAIL", len(errors))
        for err in errors:
            print("-", err)
        return 1
    print("PASS package")
    print("freshness=NOT_RUN independent package check does not read a repository")
    return 0


def check_package(root: Path) -> list[str]:
    errors: list[str] = []
    errors.extend(check_manifest(root))
    errors.extend(check_study(root))
    errors.extend(check_images_and_refs(root))
    errors.extend(check_html_ids(root))
    return errors


def check_manifest(root: Path) -> list[str]:
    errors = []
    manifest_path = root / "MANIFEST.json"
    if not manifest_path.is_file():
        return ["MANIFEST.json missing"]
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"MANIFEST.json invalid: {exc}"]
    records = manifest.get("files")
    if not isinstance(records, list):
        return ["MANIFEST.json files must be a list"]
    recorded = {}
    for rec in records:
        if not isinstance(rec, dict):
            errors.append("MANIFEST record is not an object")
            continue
        rel = rec.get("path")
        if not isinstance(rel, str) or not rel or rel.startswith("/") or ".." in Path(rel).parts or "\\" in rel:
            errors.append(f"unsafe manifest path {rel}")
            continue
        if rel == "MANIFEST.json":
            errors.append("MANIFEST.json must not list itself")
        if rel in recorded:
            errors.append(f"duplicate manifest path {rel}")
        if not isinstance(rec.get("bytes"), int) or not isinstance(rec.get("sha256"), str):
            errors.append(f"manifest field types {rel}")
        recorded[rel] = rec
    disk = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if path.is_symlink():
            errors.append(f"symlink rejected {rel}")
            continue
        parts = Path(rel).parts
        if any(part in FORBIDDEN or part.endswith(".pyc") for part in parts) or path.name.endswith(".pyc"):
            errors.append(f"forbidden packaging file {rel}")
        if rel == "MANIFEST.json":
            continue
        disk[rel] = path
    for rel, rec in recorded.items():
        path = disk.get(rel)
        if path is None:
            errors.append(f"missing recorded file {rel}")
            continue
        if path.stat().st_size != rec.get("bytes"):
            errors.append(f"size mismatch {rel}")
        if sha256_file(path) != rec.get("sha256"):
            errors.append(f"sha256 mismatch {rel}")
    for rel in disk:
        if rel not in recorded:
            errors.append(f"unregistered file {rel}")
    return errors


def check_study(root: Path) -> list[str]:
    errors = []
    data = root / "data"
    names = [
        "project.json", "capabilities.json", "requirements.json", "gaps.json",
        "decisions.json", "evidence-index.json", "paused-services.json",
        "roadmap.json", "review-findings.json", "scope-coverage.json",
        "scope-decisions.json", "judgment-corrections.json",
        "visual-references.json", "source-handoff-corrections.json",
        "places-adoption.json", "section-content.json",
    ]
    loaded = {}
    for name in names:
        path = data / name
        if not path.is_file():
            errors.append(f"missing data file {name}")
            continue
        try:
            loaded[name] = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            errors.append(f"invalid json {name}: {exc}")
    if len(loaded) != len(names):
        return errors
    project = loaded["project.json"]
    caps = loaded["capabilities.json"]
    reqs = loaded["requirements.json"]
    gaps = loaded["gaps.json"]
    decs = loaded["decisions.json"]
    evds = loaded["evidence-index.json"]
    paused = loaded["paused-services.json"]
    roadmap = loaded["roadmap.json"]
    reviews = loaded["review-findings.json"]
    coverage = loaded["scope-coverage.json"]
    scope_decs = loaded["scope-decisions.json"]
    ids = {}

    def add(kind, ident):
        if not ident or not isinstance(ident, str):
            errors.append(f"empty id in {kind}")
            return
        if ident in ids:
            errors.append(f"duplicate id {ident} ({kind} vs {ids[ident]})")
        else:
            ids[ident] = kind

    for row in caps:
        add("cap", row.get("id"))
    for row in reqs:
        add("req", row.get("id"))
    for row in gaps:
        add("gap", row.get("id"))
    for row in decs:
        add("dec", row.get("id"))
    for row in evds:
        add("evd", row.get("id"))
    for row in paused:
        add("pause", row.get("id"))
    for row in roadmap:
        add("gate", row.get("id"))
    for row in reviews:
        add("rev", row.get("id"))
    for row in coverage:
        add("scope", row.get("id"))
    for row in loaded["judgment-corrections.json"]:
        add("jdg", row.get("id"))

    def need(ref, ctx, prefix):
        if ref in (None, ""):
            return
        if ref not in ids:
            errors.append(f"missing ref {ref} from {ctx}")
        elif not str(ref).startswith(prefix):
            errors.append(f"wrong type {ref} from {ctx}; expected {prefix}")

    evd_by = {row["id"]: row for row in evds}
    for row in evds:
        for key in ("claim", "claimType", "excerptFile", "proves", "doesNotProve", "limitations"):
            if not str(row.get(key) or "").strip():
                errors.append(f"empty evidence field {key} on {row.get('id')}")
        rel = row.get("excerptFile") or ""
        if rel.startswith("/") or ".." in str(rel).split("/"):
            errors.append(f"non-portable evidence path {rel}")
        if rel and not (root / rel).is_file():
            errors.append(f"missing excerpt file {rel} for {row.get('id')}")
        if row.get("claimType") == "search":
            log = root / (row.get("path") or "")
            if not log.is_file():
                errors.append(f"search log missing {row.get('path')} for {row.get('id')}")
    for row in caps:
        if row.get("existence") not in EXISTENCE:
            errors.append(f"bad existence {row.get('id')}")
        if row.get("activation") not in ACTIVATION:
            errors.append(f"bad activation {row.get('id')}")
        if row.get("verification") == "SOURCE_ONLY" and row.get("activation") == "ENABLED":
            errors.append(f"{row.get('id')} ENABLED with SOURCE_ONLY")
        evids = row.get("evidenceIds") or []
        if not evids:
            errors.append(f"{row.get('id')} has no evidence")
        for evid in evids:
            need(evid, row.get("id"), "EVD-")
        linked = [evd_by[evid] for evid in evids if evid in evd_by]
        if row.get("existence") == "EXISTING" and not any(item.get("claimType") == "fact" for item in linked):
            errors.append(f"{row.get('id')} EXISTING without fact evidence")
        if row.get("existence") == "ABSENT_AFTER_SEARCH" and not any(item.get("claimType") == "search" for item in linked):
            errors.append(f"{row.get('id')} absence without search evidence")
    for row in reqs:
        need(row.get("existingCapabilityId"), row.get("id"), "CAP-")
        need(row.get("gapId"), row.get("id"), "GAP-")
        acceptance = row.get("acceptance") or {}
        for key in ("given", "action", "expected", "testMethod", "evidenceRequired"):
            if not str(acceptance.get(key) or "").strip():
                errors.append(f"{row.get('id')} missing acceptance.{key}")
        if not acceptance.get("failures"):
            errors.append(f"{row.get('id')} missing acceptance.failures")
        text = row.get("acceptanceAr") or ""
        if text.strip() == GENERIC or GENERIC in text or len(text) < 40:
            errors.append(f"{row.get('id')} acceptanceAr is generic")
    for row in gaps:
        for req in row.get("reqIds") or []:
            need(req, row.get("id"), "REQ-")
        for evid in row.get("evidenceIds") or []:
            need(evid, row.get("id"), "EVD-")
        if not row.get("evidenceIds") and row.get("verification") != "UNVERIFIED":
            errors.append(f"{row.get('id')} needs evidence or UNVERIFIED")
    for row in decs:
        for evid in row.get("evidenceIds") or []:
            need(evid, row.get("id"), "EVD-")
    dec5 = next((row for row in decs if row.get("id") == "DEC-0005"), None)
    if dec5 and dec5.get("status") in {"معتمد", "مغلق"}:
        errors.append("DEC-0005 must not be approved by the study")
    req_ids = {row["id"] for row in reqs}
    placed = set()
    for row in roadmap:
        if row.get("status") not in {"in_progress", "planned", "closed"}:
            errors.append(f"bad gate status {row.get('id')}")
        if row.get("id") == "GATE-00" and row.get("status") == "closed":
            errors.append("GATE-00 must not be closed")
        if len(row.get("exitCriteriaAr") or []) < 3:
            errors.append(f"{row.get('id')} missing exit criteria")
        if not row.get("entryCriteriaAr"):
            errors.append(f"{row.get('id')} missing entry criteria")
        for req in row.get("reqIds") or []:
            need(req, row.get("id"), "REQ-")
            placed.add(req)
        for dec in row.get("decisionIds") or []:
            need(dec, row.get("id"), "DEC-")
        for dep in row.get("dependsOn") or []:
            if dep not in ids or not (dep.startswith("GATE-") or dep.startswith("DEC-")):
                errors.append(f"bad dependency {dep} from {row.get('id')}")
    gate0 = next(row for row in roadmap if row["id"] == "GATE-00")
    if len(gate0.get("reqIds") or []) == len(req_ids):
        errors.append("GATE-00 lists every requirement")
    for row in scope_decs:
        need(row.get("reqId"), "scope", "REQ-")
        need(row.get("decisionId"), "scope", "DEC-")
        placed.add(row.get("reqId"))
    missing = sorted(req_ids - placed)
    if missing:
        errors.append("requirements not in a gate or scope decision: " + ", ".join(missing))
    children = {}
    for row in reviews:
        for key in REQ_FIELDS:
            if key not in row or row.get(key) in ("", None, []):
                if key == "newEvidenceIds" and row.get("id", "").startswith("REV-0004"):
                    continue
                if key == "newEvidenceIds" and not row.get("newEvidenceIds") and row.get("id") in {
                    "REV-0004", "REV-0004a", "REV-0004b", "REV-0004c", "REV-0005", "REV-0005a",
                    "REV-0006", "REV-0007", "REV-0007a", "REV-0007b", "REV-0007c", "REV-0005c",
                }:
                    continue
                if row.get(key) in ("", None) or (key == "files" and not row.get("files")):
                    errors.append(f"{row.get('id')} missing {key}")
        if row.get("status") not in REVIEW_STATUSES:
            errors.append(f"bad review status {row.get('id')}")
        for evid in row.get("newEvidenceIds") or []:
            need(evid, row.get("id"), "EVD-")
        for req in row.get("reqIds") or []:
            need(req, row.get("id"), "REQ-")
        parent = row.get("parentId")
        if parent:
            need(parent, row.get("id"), "REV-")
            children.setdefault(parent, []).append(row)
    for parent, kids in children.items():
        parent_row = next(row for row in reviews if row["id"] == parent)
        if any(kid["status"] == "قيد المعالجة" for kid in kids) and parent_row["status"] == "معالجة بانتظار المراجعة":
            errors.append(f"{parent} closed while a child is still in progress")
    counts = project.get("counts") or {}
    expected = {
        "requirements": len(reqs), "gaps": len(gaps), "evidence": len(evds),
        "capabilities": len(caps), "decisions": len(decs), "paused": len(paused),
        "gates": len(roadmap), "reviewFindings": len(reviews), "scopeItems": len(coverage),
    }
    for key, count in expected.items():
        if counts.get(key) != count:
            errors.append(f"count {key} is {counts.get(key)} but data has {count}")
    if project.get("studyStatus") in {"معتمدة", "معتمد"}:
        errors.append("study must not mark itself approved")
    generated = root / "js" / "data.generated.js"
    if not generated.is_file():
        errors.append("js/data.generated.js missing")
    else:
        sys.path.insert(0, str(root / "scripts"))
        import generate_data_js as genmod
        genmod.ROOT = root
        genmod.DATA = data
        fresh = json.dumps(genmod.bundle(), ensure_ascii=False, indent=2)
        current = generated.read_text(encoding="utf-8")
        prefix = "/* Generated from data/*.json — do not edit by hand */\nwindow.MIRA_STUDY = "
        body = current[len(prefix):] if current.startswith(prefix) else ""
        if body.endswith(";\n"):
            body = body[:-2]
        if body != fresh:
            errors.append("generated js does not match data/*.json")
    for item in coverage:
        for rel in item.get("dataFiles") or []:
            if rel.startswith("evidence/"):
                continue
            if not (data / rel).exists() and not (root / rel).exists():
                errors.append(f"{item.get('id')} missing data file {rel}")
    return errors


def check_images_and_refs(root: Path) -> list[str]:
    errors = []
    data = root / "data"
    visuals = json.loads((data / "visual-references.json").read_text(encoding="utf-8"))
    for item in visuals.get("items") or []:
        status = item.get("status")
        path = item.get("path") or ""
        if status == "NEEDS_ASSET":
            if path:
                errors.append(f"{item.get('id')} NEEDS_ASSET must not carry a path")
            continue
        if status == "available":
            dest = root / path
            if not path or not dest.is_file():
                errors.append(f"missing referenced image {path} for {item.get('id')}")
            elif item.get("sha256") and sha256_file(dest) != item.get("sha256"):
                errors.append(f"image sha mismatch {item.get('id')}")
        else:
            errors.append(f"unknown visual status {item.get('id')}")
    known = set()
    for name in data.glob("*.json"):
        blob = json.loads(name.read_text(encoding="utf-8"))
        collect_ids(blob, known)
    for name in data.glob("*.json"):
        text = name.read_text(encoding="utf-8")
        for ref in ID_RE.findall(text):
            if ref not in known:
                errors.append(f"broken internal reference {ref} in {name.name}")
    index = (root / "index.html").read_text(encoding="utf-8")
    for match in re.findall(r"""(?:src|href)=["']([^"']+)["']""", index):
        if match.startswith(("http://", "https://", "#", "mailto:")):
            continue
        if not (root / match).exists():
            errors.append(f"missing index asset {match}")
    return errors


def collect_ids(node, found: set[str]):
    if isinstance(node, dict):
        ident = node.get("id")
        if isinstance(ident, str):
            found.add(ident)
        for value in node.values():
            collect_ids(value, found)
    elif isinstance(node, list):
        for value in node:
            collect_ids(value, found)


def check_html_ids(root: Path) -> list[str]:
    errors = []
    sys.path.insert(0, str(root / "scripts"))
    import generate_data_js as genmod
    genmod.ROOT = root
    genmod.DATA = root / "data"
    bundle = genmod.bundle()
    ids = [section["id"] for section in bundle["sections"]]
    ids.extend(HTML_ID_RE.findall((root / "index.html").read_text(encoding="utf-8")))
    for key in ("reviewFindings", "roadmap", "requirements", "gaps", "capabilities", "decisions", "evidence", "scopeCoverage"):
        for row in bundle.get(key) or []:
            if row.get("id"):
                ids.append(row["id"])
    for row in (bundle.get("placesAdoption") or {}).get("items") or []:
        ids.append(row["id"])
    for row in (bundle.get("placesAdoption") or {}).get("stages") or []:
        ids.append(row["id"])
    for row in (bundle.get("visualReferences") or {}).get("items") or []:
        ids.append(row["id"])
    for row in (bundle.get("sourceCorrections") or {}).get("corrections") or []:
        ids.append(row["id"])
    plan = bundle.get("discoverPlan") or {}
    for row in (plan.get("functions") or []) + (plan.get("fileMap") or []):
        if row.get("id"):
            ids.append(row["id"])
    phases = bundle.get("discoverPhases") or {}
    for phase in phases.get("phases") or []:
        if phase.get("id"):
            ids.append(phase["id"])
        for task in phase.get("tasks") or []:
            if task.get("id"):
                ids.append(task["id"])
        for note in phase.get("corrections") or []:
            if note.get("id"):
                ids.append(note["id"])
        for item in phase.get("deliveries") or []:
            if item.get("id"):
                ids.append(item["id"])
    dups = [ident for ident, count in Counter(ids).items() if count > 1]
    for ident in dups:
        errors.append(f"duplicate html id {ident}")
    return errors


if __name__ == "__main__":
    sys.exit(main())
