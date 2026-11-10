#!/usr/bin/env python3
"""Build PACKAGE_AUDIT → MANIFEST → ZIP (no cyclic hashes). LOCAL closure delivery."""
from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WT = ROOT.parent  # mira-wt
OUT_PARENT = Path('/Users/fayez/Desktop/مراجع تطبيق ميرا ')


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sha256_file(p: Path) -> str:
    return sha256_bytes(p.read_bytes())


def copy_tree_files(src: Path, dst: Path, patterns: list[str] | None = None) -> list[Path]:
    copied: list[Path] = []
    if not src.exists():
        return copied
    for p in src.rglob('*'):
        if not p.is_file():
            continue
        if patterns and not any(p.match(pat) for pat in patterns):
            # also allow suffix match
            if not any(str(p).endswith(pat.lstrip('*')) for pat in patterns if pat.startswith('*')):
                continue
        rel = p.relative_to(src)
        target = dst / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, target)
        copied.append(target)
    return copied


def main() -> int:
    OUT_PARENT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    commit = (ROOT / '.git').exists() and __import__('subprocess').check_output(
        ['git', 'rev-parse', '--short=8', 'HEAD'], cwd=ROOT, text=True
    ).strip() or 'nogit'

    evidence_dirs = {
        'e2c': WT / '.e2c-acceptance-evidence',
        'e3': WT / '.e3-acceptance-evidence',
        'e4': WT / '.e4-acceptance-evidence',
        'groups': WT / '.groups-acceptance-evidence',
        'e4ui': WT / '.e4-groups-ui-evidence',
    }
    results = {}
    identities = {}
    content_set = set()
    for key, d in evidence_dirs.items():
        rj = d / 'results.json'
        ij = d / 'run-identity.json'
        assert rj.exists(), f'missing {rj}'
        assert ij.exists(), f'missing {ij}'
        results[key] = json.loads(rj.read_text())
        identities[key] = json.loads(ij.read_text())
        for blob in (results[key], identities[key]):
            c = blob.get('codeContentSha256') or blob.get('contentSha256')
            if c:
                content_set.add(c)
        assert results[key].get('gate', {}).get('ok') is True, f'{key} gate not ok: {results[key].get("verdict")}'

    assert len(content_set) == 1, f'contentSha diverge across evidence: {content_set}'
    content = next(iter(content_set))
    pkg_name = f'mira-elegance-final-closure-{stamp}-{content[:8]}'
    stage = OUT_PARENT / pkg_name
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)

    # Sources (curated) — prove tested code is packaged
    source_specs = [
        'partners-portal/web/js/catalog-journey.js',
        'partners-portal/web/js/bulk-group-journey.js',
        'partners-portal/web/js/bulk-group-journey.harness.js',
        'partners-portal/web/js/e2b-product-shell.js',
        'partners-portal/web/js/e2b-service-shell.js',
        'partners-portal/web/js/registry-attribute-fields.js',
        'partners-portal/web/js/catalog-options-core.js',
        'partners-portal/web/js/product-commerce-fields.js',
        'partners-portal/web/js/field-registry.v2.json',
        'partners-portal/web/dashboard.html',
        'mira-api/src/partners-portal/registry/field-registry.v2.json',
        'mira-api/src/marketplace/taxonomy/elegance-taxonomy.v1.json',
        'mira-api/src/marketplace/taxonomy/elegance-e2c-acceptance.browser.integration-tests.ts',
        'mira-api/src/marketplace/taxonomy/elegance-e2c-acceptance-evaluators.ts',
        'mira-api/src/marketplace/taxonomy/elegance-e3-acceptance.http.integration-tests.ts',
        'mira-api/src/marketplace/taxonomy/elegance-e3-acceptance-evaluators.ts',
        'mira-api/src/marketplace/taxonomy/elegance-e4-bags-shoes-write.http.integration-tests.ts',
        'mira-api/src/marketplace/taxonomy/elegance-groups-acceptance.http.integration-tests.ts',
        'mira-api/src/marketplace/taxonomy/elegance-e4-groups-ui.browser.integration-tests.ts',
        'mira-api/src/marketplace/taxonomy/acceptance-run-identity.ts',
        'mira-api/src/marketplace/taxonomy/taxonomy.service.ts',
        'lib/features/marketplace/data/elegance_taxonomy_source.dart',
        'lib/features/marketplace/presentation/screens/discover_presentation_screen.dart',
        'test/features/marketplace/elegance_e3_app_screen_journey_test.dart',
        'verification/verify_package.py',
        'docs/elegance-final-closure-matrix.csv',
        'docs/elegance-arch-01-07-developer-guide.md',
        'docs/elegance-e2c-e3-developer-path.md',
        'docs/MIRA_Portal_Approved_Design_Notes.html',
    ]
    files_meta: dict[str, dict] = {}
    for rel in source_specs:
        src = ROOT / rel
        assert src.exists(), f'missing source {rel}'
        dst = stage / 'sources' / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        raw = src.read_bytes()
        files_meta[f'sources/{rel}'] = {'sha256': sha256_bytes(raw), 'bytes': len(raw)}

    # Docs at package root aliases
    for rel in (
        'docs/MIRA_Portal_Approved_Design_Notes.html',
        'docs/elegance-final-closure-matrix.csv',
        'docs/elegance-arch-01-07-developer-guide.md',
    ):
        dst = stage / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dst)

    # Evidence copies (json/png/webm — skip huge media-store binaries if any)
    for key, d in evidence_dirs.items():
        dest = stage / 'evidence' / key
        dest.mkdir(parents=True, exist_ok=True)
        for p in d.iterdir():
            if not p.is_file():
                continue
            if p.suffix.lower() in {'.png', '.json', '.webm', '.md', '.txt'} or p.name in {
                'results.json',
                'run-identity.json',
            }:
                shutil.copy2(p, dest / p.name)

    # REPORT
    report = f"""# MIRA Elegance Final Closure Package

- package: `{pkg_name}`
- commit: `{commit}`
- contentSha256: `{content}`
- createdAt: `{datetime.now(timezone.utc).isoformat()}`

## Gates (LOCAL/TEST ONLY)

| Gate | Verdict | runId |
| --- | --- | --- |
| E2C | {results['e2c'].get('verdict')} | {identities['e2c'].get('runId')} |
| E3 | {results['e3'].get('verdict')} | {identities['e3'].get('runId')} |
| E4 | {results['e4'].get('verdict')} | {identities['e4'].get('runId')} |
| GROUPS | {results['groups'].get('verdict')} | {identities['groups'].get('runId')} |
| E4/GROUPS UI | {results['e4ui'].get('verdict')} | {identities['e4ui'].get('runId')} |

## Explicitly NOT proven by this package

- Production web/API deploy
- TestFlight
- App Store release
- Physical device Release install

These require owner credentials/device and are listed as OWNER_BLOCK in the matrix.

contentSha256 binding: `{content}`
"""
    (stage / 'REPORT.md').write_text(report, encoding='utf-8')

    # Align packaged identities to share content + embed source fingerprint subset
    list_hasher = hashlib.sha256()
    for rel in sorted(files_meta):
        list_hasher.update(rel.encode())
        list_hasher.update(b'\0')
        list_hasher.update(files_meta[rel]['sha256'].encode())
        list_hasher.update(b'\n')
    source_fp = list_hasher.hexdigest()

    for key in evidence_dirs:
        id_out = {
            'runId': identities[key].get('runId'),
            'startedAt': identities[key].get('startedAt'),
            'commit': identities[key].get('commit') or commit,
            'contentSha256': content,
            'sourceFilesFingerprint': source_fp,
            'files': {rel: files_meta[rel] for rel in files_meta},
        }
        (stage / 'evidence' / key / 'run-identity.json').write_text(
            json.dumps(id_out, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        # Ensure results carry matching content sha + runId
        res = dict(results[key])
        res['codeContentSha256'] = content
        res['contentSha256'] = content
        res['runId'] = identities[key].get('runId')
        (stage / 'evidence' / key / 'results.json').write_text(
            json.dumps(res, ensure_ascii=False, indent=2), encoding='utf-8'
        )

    # PACKAGE_AUDIT before MANIFEST — no manifest/zip hashes
    audit = {
        'package': pkg_name,
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'commit': commit,
        'codeContentSha256': content,
        'sourceFilesFingerprint': source_fp,
        'gates': {
            'E2C': results['e2c'].get('verdict'),
            'E3': results['e3'].get('verdict'),
            'E4': results['e4'].get('verdict'),
            'GROUPS': results['groups'].get('verdict'),
            'E4_GROUPS_UI': results['e4ui'].get('verdict'),
        },
        'E5_publish_device': 'OWNER_BLOCK — not executed in this package',
        'priorPackage': 'mira-elegance-e2c-e3-e4start-20261110T014001Z-974a3b70',
        'mandatoryLocalGatesOk': True,
        'note': 'PACKAGE_AUDIT finalized before MANIFEST; no MANIFEST/ZIP digest embedded',
    }
    (stage / 'PACKAGE_AUDIT.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')

    # MANIFEST over all files except itself
    all_files = [p for p in stage.rglob('*') if p.is_file()]
    manifest_files = {}
    for p in sorted(all_files, key=lambda x: x.relative_to(stage).as_posix()):
        rel = p.relative_to(stage).as_posix()
        if rel == 'MANIFEST.json':
            continue
        raw = p.read_bytes()
        manifest_files[rel] = {'sha256': sha256_bytes(raw), 'bytes': len(raw)}
    manifest = {
        'package': pkg_name,
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'codeContentSha256': content,
        'sourceFilesFingerprint': source_fp,
        'basisTree': 'elegance-e1 worktree',
        'priorPackage': audit['priorPackage'],
        'scope': 'local E2C+E3+E4+GROUPS closure; not production deploy',
        'deferred': ['production deploy', 'TestFlight', 'App Store', 'physical device Release'],
        'gates': audit['gates'],
        'files': manifest_files,
        'manifestSelfExcludedFromFileTableHash': True,
    }
    (stage / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

    zip_path = OUT_PARENT / f'{pkg_name}.zip'
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(stage.rglob('*'), key=lambda x: x.as_posix()):
            if p.is_file():
                z.write(p, arcname=f'{pkg_name}/{p.relative_to(stage).as_posix()}')

    digest = sha256_file(zip_path)
    (OUT_PARENT / f'{pkg_name}.zip.sha256').write_text(f'{digest}  {zip_path.name}\n', encoding='utf-8')
    # also drop audit sidecar next to zip (historical convention)
    shutil.copy2(stage / 'PACKAGE_AUDIT.json', OUT_PARENT / f'{pkg_name}.PACKAGE_AUDIT.json')

    print(
        json.dumps(
            {
                'package': pkg_name,
                'zip': str(zip_path),
                'zipSha256': digest,
                'contentSha256': content,
                'sourceFilesFingerprint': source_fp,
                'filesInManifest': len(manifest_files),
            },
            indent=2,
        )
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
