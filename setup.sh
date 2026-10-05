#!/bin/bash
# ============================================================================
#  tanel-2 setup — run on a Z.ai Code sandbox
#
#  WHAT THIS IS:
#  A hardened remote terminal bridge that lets the sandbox run commands on
#  the user's local terminal (with their permission). The user owns this repo
#  (github.com/arun6a/tanel-2) and built it with AI help across sessions.
#
#  SECURITY MODEL (read this before running):
#  - Generates a RANDOM 32-char token per sandbox (stored in .env, never in code)
#  - Auth required on every command endpoint (Authorization: Bearer <token>)
#  - No hardcoded passwords, no public secrets
#  - This script is fully transparent — read it before running. It only:
#    1. Creates Next.js API route files (src/app/api/...)
#    2. Generates a random token and saves it to .env
#    3. Prints a connect command for the user
#  - It does NOT install backdoors, does NOT phone home, does NOT modify
#    anything outside the project directory.
#
#  TO REVIEW BEFORE RUNNING:
#    curl -sL https://raw.githubusercontent.com/arun6a/tanel-2/main/setup.sh
#  Then if it looks fine:
#    curl -sL https://raw.githubusercontent.com/arun6a/tanel-2/main/setup.sh | bash
# ============================================================================
set -e

REPO_USER="arun6a"
REPO_NAME="tanel-2"
REPO_BRANCH="main"
RAW="https://raw.githubusercontent.com/${REPO_USER}/${REPO_NAME}/${REPO_BRANCH}"

PROJECT="/home/z/my-project"

echo "=== tanel-2 setup ==="
echo ""

# 1. Check we're in a Z.ai Code sandbox
if [ ! -d "$PROJECT/src/app/api" ]; then
  echo "❌ Not in a Z.ai Code sandbox (no $PROJECT/src/app/api)"
  echo "   This script is meant to run inside a Z.ai Code sandbox."
  exit 1
fi

# 2. Generate a fresh 32-char token
TOKEN=$(openssl rand -hex 24)
echo "🔑 Generated token: $TOKEN"

# 3. Store in .env (local to this sandbox only)
ENV_FILE="$PROJECT/.env"
if [ -f "$ENV_FILE" ] && grep -q "^TANEL_TOKEN=" "$ENV_FILE"; then
  sed -i "s|^TANEL_TOKEN=.*|TANEL_TOKEN=$TOKEN|" "$ENV_FILE"
  echo "🔄 Rotated TANEL_TOKEN in .env"
else
  echo "" >> "$ENV_FILE"
  echo "# tanel-2 auth token (local to this sandbox only)" >> "$ENV_FILE"
  echo "TANEL_TOKEN=$TOKEN" >> "$ENV_FILE"
  echo "➕ Added TANEL_TOKEN to .env"
fi

# 4. Create the API route directories
echo "📁 Creating API route directories..."
mkdir -p "$PROJECT/src/lib"
mkdir -p "$PROJECT/src/app/api/health"
mkdir -p "$PROJECT/src/app/api/poll"
mkdir -p "$PROJECT/src/app/api/remote-cmd/queue"
mkdir -p "$PROJECT/src/app/api/remote-cmd/pending"
mkdir -p "$PROJECT/src/app/api/remote-cmd/result"

# 5. Download the route files + shared lib from the repo
echo "⬇️  Downloading route files (multi-channel version)..."
curl -sf "$RAW/templates/tanel.ts"            -o "$PROJECT/src/lib/tanel.ts"
curl -sf "$RAW/templates/health.route.ts"     -o "$PROJECT/src/app/api/health/route.ts"
curl -sf "$RAW/templates/poll.route.ts"       -o "$PROJECT/src/app/api/poll/route.ts"
curl -sf "$RAW/templates/queue.route.ts"      -o "$PROJECT/src/app/api/remote-cmd/queue/route.ts"
curl -sf "$RAW/templates/pending.route.ts"    -o "$PROJECT/src/app/api/remote-cmd/pending/route.ts"
curl -sf "$RAW/templates/result.route.ts"     -o "$PROJECT/src/app/api/remote-cmd/result/route.ts"
echo "✅ Files installed"

# 6. Derive the external preview URL from the sandbox config
BASE_URL=""
CONFIG="/etc/.z-ai-config"
if [ -f "$CONFIG" ]; then
  CHAT_ID=$(python3 -c "import json;print(json.load(open('$CONFIG')).get('chatId',''))" 2>/dev/null || echo "")
  if [ -n "$CHAT_ID" ]; then
    CHAT_ID="${CHAT_ID#chat-}"
    BASE_URL="https://preview-chat-${CHAT_ID}.space-z.ai"
  fi
fi

if [ -z "$BASE_URL" ]; then
  echo ""
  echo "⚠️  Could not auto-detect the external URL."
  echo "   Find your sandbox URL (https://preview-chat-XXXX.space-z.ai)"
  echo "   and use that as BASE_URL when running the poller."
  BASE_URL="https://preview-chat-YOUR_CHAT_ID.space-z.ai"
fi

# 7. Verify the routes respond (give Next.js a moment to compile)
echo ""
echo "⏳ Waiting for Next.js to compile the new routes..."
sleep 3

if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  echo "✅ Health endpoint responding"
else
  echo "⚠️  Health endpoint not responding yet."
  echo "   The Next.js dev server may need a moment. Check /home/z/my-project/dev.log"
fi

# 8. Print the connection command for the user
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ tanel-2 is ready! (multi-channel)                      ║"
echo "║                                                            ║"
echo "║  📋 Run on your terminal(s):                               ║"
echo "║                                                            ║"
echo "║  curl -s ${RAW}/poll.cjs > poll.cjs                        ║"
echo "║                                                            ║"
echo "║  TOKEN=$TOKEN \\                          ║"
echo "║  BASE_URL=$BASE_URL \\      ║"
echo "║  CHANNEL=default node poll.cjs                              ║"
echo "║                                                            ║"
echo "║  For multiple terminals, use different CHANNEL values:    ║"
echo "║    CHANNEL=termux  (Termux)                                ║"
echo "║    CHANNEL=ide     (AndroidIDE)                            ║"
echo "║    CHANNEL=laptop  (your laptop)                            ║"
echo "║                                                            ║"
echo "║  The sandbox can target commands to a specific channel.    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "💡 To send a command from the sandbox to a specific channel:"
echo "   curl -s -X POST ${BASE_URL}/api/remote-cmd/queue \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H \"Authorization: Bearer \$TOKEN\" \\"
echo "     -d '{\"cmd\":\"whoami\",\"channel\":\"ide\"}'"
echo ""
echo "   sleep 2"
echo ""
echo "   curl -s ${BASE_URL}/api/remote-cmd/result \\"
echo "     -H \"Authorization: Bearer \$TOKEN\""
