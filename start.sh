#!/bin/bash
# ============================================================
# Doorman - Start All Services (Cross-platform: Mac/Windows)
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"
LOG_DIR="$SCRIPT_DIR/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

echo "🦞 Starting Doorman..."
echo ""

# Function to check if a port is in use
check_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -i :$port -sTCP:LISTEN -t >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -an | grep -q ":$port .*LISTEN"
  else
    # Fallback: try to connect
    timeout 1 bash -c "</dev/tcp/localhost/$port" >/dev/null 2>&1
  fi
}

# Function to wait for service
wait_for_service() {
  local url=$1
  local name=$2
  local max_wait=${3:-10}
  echo "   ⏳ Waiting for $name..."
  for i in $(seq 1 $max_wait); do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "   ✅ $name ready"
      return 0
    fi
    sleep 1
  done
  echo "   ❌ $name failed to start"
  return 1
}

# ── 1. PostgreSQL ────────────────────────────────────────────
echo "🐘 Checking PostgreSQL..."
if pg_isready -q; then
  echo "   ✅ PostgreSQL already running"
else
  echo "   🔄 Starting PostgreSQL..."
  # Try different methods to start PostgreSQL
  if command -v brew >/dev/null 2>&1; then
    # macOS with Homebrew
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null
  elif command -v systemctl >/dev/null 2>&1; then
    # Linux with systemd
    sudo systemctl start postgresql 2>/dev/null || sudo systemctl start postgresql-14 2>/dev/null
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    net start postgresql-x64-14 2>/dev/null || net start postgresql 2>/dev/null || {
      echo "   ⚠️  Could not start PostgreSQL service. Please start it manually."
    }
  else
    echo "   ⚠️  Unsupported OS. Please start PostgreSQL manually."
  fi

  sleep 2
  if pg_isready -q; then
    echo "   ✅ PostgreSQL started"
  else
    echo "   ❌ PostgreSQL failed to start. Continuing anyway..."
  fi
fi

# ── 2. Camunda ───────────────────────────────────────────────
echo "⚙️  Starting Camunda..."
if check_port 8080; then
  echo "   ✅ Camunda already running on port 8080"
else
  echo "   🔄 Starting Camunda..."
  cd "$SCRIPT_DIR/camunda-bpm-run"
  # Run the batch file with detached flag to run in background
  "./internal/run.bat" start --detached
  cd "$SCRIPT_DIR"
  wait_for_service "http://localhost:8080/" "Camunda" 20
fi

# ── 3. Backend ───────────────────────────────────────────────
echo "🔌 Starting Backend (port 3000)..."
if check_port 3000; then
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

# ── 4. Frontend ──────────────────────────────────────────────
echo "🌐 Starting Frontend (port 3001)..."
if check_port 3001; then
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
echo "   🎯 Camunda UI    → http://localhost:8080"
echo ""
echo "   Backend logs  → $LOG_DIR/backend.log"
echo "   Frontend logs → $LOG_DIR/frontend.log"
echo ""
echo "   Run ./stop.sh to shut everything down"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
