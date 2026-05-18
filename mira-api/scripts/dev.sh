#!/usr/bin/env bash
# Start Mira API in dev mode (run from anywhere).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f package.json ]]; then
  echo "Error: mira-api not found at $ROOT"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "→ npm install..."
  npm install
fi

if [[ ! -f .env ]]; then
  echo "→ Copying .env.example → .env"
  cp .env.example .env
  echo "   Edit .env if needed, then run again."
fi

echo "→ prisma generate..."
npm run prisma:generate

echo "→ prisma migrate deploy..."
npx prisma migrate deploy

echo "→ starting NestJS (watch mode)..."
npm run start:dev
