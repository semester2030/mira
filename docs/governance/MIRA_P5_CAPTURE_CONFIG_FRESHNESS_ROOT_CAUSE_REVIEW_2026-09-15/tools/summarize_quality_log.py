#!/usr/bin/env python3
"""Summarize Mira PerfectCameraKit quality debug lines including isValid.

Usage:
  summarize_quality_log.py <logfile>

Emits counts for ready / area / pose / light / isValid combinations and
sample lines. Does not require face images.
"""
from __future__ import annotations

import re
import sys
from collections import Counter


QUALITY_RE = re.compile(
    r"Mira PerfectCameraKit quality:.*"
    r"ready=(?P<ready>\w+).*?"
    r"valid=(?P<valid>\w+).*?"
    r"area=(?P<area>\w+).*?"
    r"pose=(?P<pose>\w+).*?"
    r"light=(?P<light>\w+).*?"
    r"areaOk=(?P<areaOk>\w+).*?"
    r"poseOk=(?P<poseOk>\w+).*?"
    r"lightOk=(?P<lightOk>\w+)"
)

LEGACY_RE = re.compile(
    r"Mira PerfectCameraKit quality:.*"
    r"ready=(?P<ready>\w+).*?"
    r"area=(?P<area>\w+).*?"
    r"pose=(?P<pose>\w+).*?"
    r"light=(?P<light>\w+)"
)

CONFIG_RE = re.compile(r"(FINAL_CONFIG|FIRST_FRAME_CONFIG).*")
CAPTURE_RE = re.compile(
    r"(takePicture|onAnalyze|auto.?capture|READY|CKCFG-|session=)",
    re.I,
)


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: summarize_quality_log.py <logfile>", file=sys.stderr)
        return 2
    path = sys.argv[1]
    text = open(path, errors="replace").read().splitlines()
    combo = Counter()
    ready_true = 0
    n_quality = 0
    n_legacy = 0
    configs = []
    captures = []
    samples = []
    for line in text:
        m = QUALITY_RE.search(line)
        if m:
            n_quality += 1
            d = m.groupdict()
            if d["ready"] == "true":
                ready_true += 1
            key = (
                d["area"],
                d["pose"],
                d["light"],
                d["valid"],
                d["areaOk"],
                d["poseOk"],
                d["lightOk"],
                d["ready"],
            )
            combo[key] += 1
            if len(samples) < 8:
                samples.append(line.strip())
            continue
        m2 = LEGACY_RE.search(line)
        if m2:
            n_legacy += 1
            d = m2.groupdict()
            if d["ready"] == "true":
                ready_true += 1
            key = (d["area"], d["pose"], d["light"], "MISSING_isValid")
            combo[key] += 1
            if len(samples) < 8:
                samples.append(line.strip())
        if CONFIG_RE.search(line):
            configs.append(line.strip())
        if CAPTURE_RE.search(line) and "quality:" not in line:
            captures.append(line.strip())

    print(f"file={path}")
    print(f"quality_events_with_isValid={n_quality}")
    print(f"legacy_quality_events_no_isValid={n_legacy}")
    print(f"ready_true={ready_true}")
    print("combo_counts (area,pose,light,valid[,oks,ready]):")
    for k, v in combo.most_common(30):
        print(f"  {v}\t{k}")
    print("config_lines:")
    for c in configs[:40]:
        print(" ", c)
    print("capture_related_lines:")
    for c in captures[:80]:
        print(" ", c)
    print("sample_quality:")
    for s in samples:
        print(" ", s)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
