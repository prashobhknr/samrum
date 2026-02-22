#!/bin/bash
# ============================================================
# Doorman - Start All Services
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"
LOG_DIR="$SCRIPT_DIR/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "🦞 Starting Doorman..."
echo ""

# ── 1. PostgreSQL ────────────────────────────────────────────
echo "🐘 Checking PostgreSQL..."
if pg_isready -q; then
  echo "   ✅ PostgreSQL already running"
else
  echo "   🔄 Starting PostgreSQL..."
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null
  sleep 2
  if pg_isready -q; then
    echo "   ✅ PostgreSQL started"
  else
    echo "   ❌ PostgreSQL failed to start. Aborting."
    exit 1
  fi
fi

# ── 2. Backend ───────────────────────────────────────────────
echo "🔌 Starting Backend (port 3000)..."
if lsof -i :3000 -sTCP:LISTEN -t &>/dev/null; then
  echo "   ✅ Backend already running on port 3000"
else
  nohup node "$SCRIPT_DIR/backend/demo-server.mjs" \
    > "$LOG_DIR/backend.log" 2>&1 &
  BACKEND_PID=$!
  echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

  # Wait for it to be ready (up to 8s)
  for i in {1..8}; do
    sleep 1
    if curl -sf http://localhost:3000/health &>/dev/null; then
      echo "   ✅ Backend ready (pid $BACKEND_PID)"
      break
    fi
    if [ $i -eq 8 ]; then
      echo "   ❌ Backend didn't start. Check $LOG_DIR/backend.log"
      cat "$LOG_DIR/backend.log" | tail -20
      exit 1
    fi
  done
fi

# ── 3. Frontend ──────────────────────────────────────────────
echo "🌐 Starting Frontend (port 3001)..."
if lsof -i :3001 -sTCP:LISTEN -t &>/dev/null; then
  echo "   ✅ Frontend already running on port 3001"
else
  cd "$SCRIPT_DIR/frontend"
  nohup npm run dev -- -p 3001 \
    > "$LOG_DIR/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

  # Wait for Next.js to be ready (up to 15s)
  for i in {1..15}; do
    sleep 1
    if curl -sf http://localhost:3001 &>/dev/null; then
      echo "   ✅ Frontend ready (pid $FRONTEND_PID)"
      break
    fi
    if [ $i -eq 15 ]; then
      echo "   ⚠️  Frontend still starting... check $LOG_DIR/frontend.log"
    fi
  done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Doorman is running!"
echo ""
echo "   🔵 Backend API   → http://localhost:3000"
echo "   🟢 Task Portal   → http://localhost:3001"
echo "   🛠  Admin UI     → http://localhost:3001/admin"
echo ""
echo "   Backend logs  → $LOG_DIR/backend.log"
echo "   Frontend logs → $LOG_DIR/frontend.log"
echo ""
echo "   Run ./stop.sh to shut everything down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
