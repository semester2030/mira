#!/usr/bin/env bash
# Reproducible ~38MiB real H.264 for U11 (3×16MiB parts). Requires ffmpeg.
set -euo pipefail
OUT="$(cd "$(dirname "$0")" && pwd)/valid-u11-16m.mp4"
ffmpeg -y -f lavfi -i "nullsrc=s=640x360:r=30,geq=random(1)*255:128:128" -t 22 \
  -c:v libx264 -pix_fmt yuv420p -preset ultrafast \
  -b:v 14M -minrate 14M -maxrate 14M -bufsize 28M -an "$OUT"
echo "wrote $OUT bytes=$(wc -c < "$OUT")"
shasum -a 256 "$OUT"
