# Sourced by the iOS Run Script. Appends committed production defines when
# the current build did not already set the same key.
DEFINES_FILE="${SRCROOT}/Flutter/production_dart_defines.json"
if [ ! -f "$DEFINES_FILE" ]; then
  echo "error: missing production dart defines: $DEFINES_FILE" >&2
  exit 1
fi
EXTRA="$(python3 - "$DEFINES_FILE" "${DART_DEFINES:-}" <<'PY'
import base64, json, sys
path, existing = sys.argv[1], sys.argv[2]
present = set()
for part in existing.split(","):
    part = part.strip()
    if not part:
        continue
    try:
        decoded = base64.b64decode(part).decode()
    except Exception:
        continue
    if "=" in decoded:
        present.add(decoded.split("=", 1)[0])
extra = []
with open(path, encoding="utf-8") as handle:
    data = json.load(handle)
for key, value in data.items():
    if key in present:
        continue
    if not isinstance(value, str):
        raise SystemExit(f"production define {key} must be a string")
    extra.append(base64.b64encode(f"{key}={value}".encode()).decode())
print(",".join(extra))
PY
)"
if [ -n "$EXTRA" ]; then
  if [ -n "${DART_DEFINES:-}" ]; then
    export DART_DEFINES="${DART_DEFINES},${EXTRA}"
  else
    export DART_DEFINES="$EXTRA"
  fi
fi
echo "production dart defines: $(python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); print(" ".join(f"{key}={value}" for key,value in data.items()))' "$DEFINES_FILE")"
