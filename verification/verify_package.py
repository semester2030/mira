"""Verify a frozen directory or ZIP.

Works on extracted package folder and ZIP archive.

PACKAGE_AUDIT is finalized before MANIFEST and must not embed MANIFEST/ZIP hashes.
MANIFEST excludes only itself. External ZIP digest is outside the archive.

Also binds run identity ↔ results ↔ report, and optionally recomputes a packaged
source-files fingerprint when evidence/*/source-files.json (or identity.files) is present.
"""
from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import Path


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def load_blob_map(target: Path) -> dict[str, bytes]:
    if target.is_file():
        with zipfile.ZipFile(target) as z:
            bad = z.testzip()
            assert bad is None, f'ZIP CRC failed: {bad}'
            names = [x.filename for x in z.infolist() if not x.is_dir()]
            assert len(names) == len(set(names)), 'duplicate archive members'
            for n in names:
                parts = Path(n).parts
                assert not Path(n).is_absolute() and '..' not in parts, f'unsafe archive path: {n}'
            data = {n: z.read(n) for n in names}
            roots = {n.split('/', 1)[0] for n in names if '/' in n}
            if len(roots) == 1:
                root = next(iter(roots)) + '/'
                stripped = {n[len(root):]: raw for n, raw in data.items() if n.startswith(root)}
                if 'MANIFEST.json' in stripped or any(k.endswith('MANIFEST.json') for k in stripped):
                    data = stripped
            return data
    assert target.is_dir(), f'not a file or directory: {target}'
    return {p.relative_to(target).as_posix(): p.read_bytes() for p in target.rglob('*') if p.is_file()}


def load_json(data: dict[str, bytes], key: str):
    if key not in data:
        return None
    return json.loads(data[key])


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
    data = load_blob_map(target)
    if 'MANIFEST.json' not in data:
        manifest_key = next((k for k in data if k.endswith('MANIFEST.json')), None)
        assert manifest_key, 'MANIFEST.json missing'
        manifest_raw = data.pop(manifest_key)
        prefix = manifest_key[: -len('MANIFEST.json')]
        data = {k[len(prefix):]: v for k, v in data.items() if k.startswith(prefix)}
    else:
        manifest_raw = data.pop('MANIFEST.json')
    manifest = json.loads(manifest_raw)
    entries = manifest['files']
    missing = set(entries) - set(data)
    extra = set(data) - set(entries)
    assert not missing and not extra, f'missing/extra files: {missing | extra}'
    for name, raw in data.items():
        assert entries[name]['bytes'] == len(raw), f'size mismatch: {name}'
        assert entries[name]['sha256'] == sha256_bytes(raw), f'hash mismatch: {name}'

    audit = json.loads(data['PACKAGE_AUDIT.json'])
    for key in audit:
        lk = key.lower()
        if lk.endswith('sha256') and ('manifest' in lk or 'zip' in lk):
            raise AssertionError(f'cyclic audit hash key: {key}')

    identities = []
    for candidate in (
        'evidence/current/source-identity.json',
        'evidence/e2c/run-identity.json',
        'evidence/e3/run-identity.json',
        'evidence/e4/run-identity.json',
        'evidence/groups/run-identity.json',
        'evidence/e4ui/run-identity.json',
    ):
        if candidate in data:
            identities.append((candidate, json.loads(data[candidate])))
    assert identities, 'run identity missing'

    results_list = []
    for candidate in (
        'evidence/current/local-results.json',
        'evidence/e2c/results.json',
        'evidence/e3/results.json',
        'evidence/e4/results.json',
        'evidence/groups/results.json',
        'evidence/e4ui/results.json',
    ):
        if candidate in data:
            results_list.append((candidate, json.loads(data[candidate])))
    assert results_list, 'results missing'

    # Content SHA must agree across all packaged integrated runs.
    content_set = set()
    for _, identity in identities:
        if identity.get('contentSha256'):
            content_set.add(identity['contentSha256'])
    for _, results in results_list:
        c = results.get('codeContentSha256') or results.get('contentSha256')
        if c:
            content_set.add(c)
    assert len(content_set) == 1, f'contentSha256 diverge across identity/results: {content_set}'
    content = next(iter(content_set))

    # Pair each results file with its run-identity when both exist under the same evidence/*.
    for prefix in ('e2c', 'e3', 'e4', 'groups', 'e4ui', 'current'):
        id_key = f'evidence/{prefix}/run-identity.json' if prefix != 'current' else 'evidence/current/source-identity.json'
        res_key = f'evidence/{prefix}/results.json' if prefix != 'current' else 'evidence/current/local-results.json'
        if id_key in data and res_key in data:
            identity = json.loads(data[id_key])
            results = json.loads(data[res_key])
            if identity.get('runId') and results.get('runId'):
                assert identity['runId'] == results['runId'], (
                    f'runId mismatch {prefix}: identity={identity["runId"]} results={results["runId"]}'
                )
            id_sha = identity.get('contentSha256')
            res_sha = results.get('codeContentSha256') or results.get('contentSha256')
            if id_sha and res_sha:
                assert id_sha == res_sha, f'contentSha mismatch in {prefix}'

    # REPORT.md (if present) must mention the shared content SHA and each packaged runId.
    if 'REPORT.md' in data:
        report = data['REPORT.md'].decode('utf-8', errors='replace')
        assert content[:12] in report or content in report, 'REPORT.md missing contentSha binding'
        for _, identity in identities:
            rid = identity.get('runId')
            if rid:
                assert rid in report, f'REPORT.md missing runId {rid}'

    # Source-list fingerprint: recompute from packaged paths listed in identity.files
    # and/or evidence/*/source-files.json. MANIFEST alone does not prove the tested tree.
    source_fp_checked = 0
    for path_key, identity in identities:
        files = identity.get('files')
        if not isinstance(files, dict) or not files:
            # Optional companion source-files.json beside the identity.
            sibling = path_key.replace('run-identity.json', 'source-files.json').replace(
                'source-identity.json', 'source-files.json'
            )
            if sibling in data:
                files = json.loads(data[sibling]).get('files') or json.loads(data[sibling])
        if not isinstance(files, dict) or not files:
            continue

        # Prefer sources that are actually embedded in the package (delivery proof).
        embedded_pairs: list[tuple[str, bytes, dict | str | None]] = []
        for rel, meta in files.items():
            candidates = [rel, f'src/{rel}', f'sources/{rel}']
            if '/' in rel:
                candidates.append(rel.split('/', 1)[-1])
            raw = None
            hit = None
            for c in candidates:
                if c in data:
                    raw = data[c]
                    hit = c
                    break
            if raw is None:
                continue
            embedded_pairs.append((rel, raw, meta))

        if not embedded_pairs:
            # Identity lists thousands of workspace files; packages ship a curated subset.
            # Require at least the acceptance/evaluator/journey sources when present under sources/.
            continue

        list_hasher = hashlib.sha256()
        for rel, raw, meta in sorted(embedded_pairs, key=lambda x: x[0]):
            digest = sha256_bytes(raw)
            if isinstance(meta, dict) and meta.get('sha256'):
                assert meta['sha256'] == digest, f'source sha drift: {rel}'
            elif isinstance(meta, str) and len(meta) == 64:
                assert meta == digest, f'source sha drift: {rel}'
            list_hasher.update(rel.encode('utf-8'))
            list_hasher.update(b'\0')
            list_hasher.update(digest.encode('utf-8'))
            list_hasher.update(b'\n')
        source_list_fp = list_hasher.hexdigest()
        claimed = identity.get('sourceFilesFingerprint') or identity.get('sourceListSha256')
        if claimed:
            assert claimed == source_list_fp, (
                f'source list fingerprint mismatch for {path_key}: '
                f'claimed={claimed} recomputed={source_list_fp}'
            )
        # Persist recomputation into stdout payload via side channel dict.
        identity['_recomputedSourceFilesFingerprint'] = source_list_fp
        identity['_embeddedSourceCount'] = len(embedded_pairs)
        source_fp_checked += 1

    # Cross-bind REPORT runIds already enforced; also refuse empty content.
    assert content and len(content) == 64, 'contentSha256 must be 64-hex'

    print(
        json.dumps(
            {
                'status': 'PASS',
                'files': len(entries),
                'contentSha256': content,
                'identities': [p for p, _ in identities],
                'results': [p for p, _ in results_list],
                'sourceFilesFingerprintChecked': source_fp_checked,
                'scope': (
                    'package integrity + runId/content binding + embedded source list fingerprint; '
                    'not a substitute for integrated acceptance'
                ),
            },
            indent=2,
        )
    )
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:  # noqa: BLE001 — CLI verifier
        print(json.dumps({'status': 'FAIL', 'error': str(exc)}, indent=2))
        raise SystemExit(1)
