#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
OUT_FILE="$SCRIPT_DIR/config.js"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found. Copy .env.example or create .env with:"
  echo "  ANTHROPIC_API_KEY=your-key-here"
  exit 1
fi

# Source the .env file
set -a
source "$ENV_FILE"
set +a

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "Error: ANTHROPIC_API_KEY is not set in .env"
  exit 1
fi

cat > "$OUT_FILE" <<EOF
const CONFIG = { ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}' };
EOF

echo "Generated config.js successfully."
