#!/bin/bash
# ============================================================
# Doorman - Stop All Services (Cross-platform: Mac/Windows)
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$SCRIPT_DIR/.pids"

echo "🛑 Stopping Doorman..."
echo ""

kill_pid_file() {
  local name="$1"
  local pidfile="$PID_DIR/$2.pid"
  local port="$3"

  if [ -f "$pidfile" ]; then
    PID=$(cat "$pidfile")
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID"
      echo "   ✅ $name stopped (pid $PID)"
    else
      echo "   ⚠️  $name pid $PID not found (already stopped?)"
    fi
    rm -f "$pidfile"
  else
    # Fallback: kill by port (cross-platform)
    if command -v lsof >/dev/null 2>&1; then
      PID=$(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null)
    elif command -v netstat >/dev/null 2>&1; then
      # Try Unix-style first, then Windows-style
      PID=$(netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -1)
      if [ -z "$PID" ]; then
        # Windows netstat
        PID=$(netstat -ano 2>/dev/null | grep ":$port .*LISTENING" | awk '{print $5}' | head -1)
      fi
    fi
    if [ -n "$PID" ] && [ "$PID" != "-" ]; then
      kill "$PID" 2>/dev/null && echo "   ✅ $name stopped (killed port $port, pid $PID)" || echo "   ⚠️  Failed to kill $name on port $port"
    else
      echo "   ✅ $name not running"
    fi
  fi
}

kill_pid_file "Frontend" "frontend" 3001
kill_pid_file "Backend"  "backend"  3000

# ── Stop Camunda ─────────────────────────────────────────────
echo "⚙️  Stopping Camunda..."
cd "$SCRIPT_DIR/camunda-bpm-run"
"./internal/run.bat" stop
cd "$SCRIPT_DIR"
echo "   ✅ Camunda shutdown requested"

# ── Stop PostgreSQL ──────────────────────────────────────────
echo "🐘 Stopping PostgreSQL..."
if pg_isready -q; then
  # Try different methods to stop PostgreSQL
  if command -v brew >/dev/null 2>&1; then
    # macOS with Homebrew
    brew services stop postgresql@14 2>/dev/null || brew services stop postgresql 2>/dev/null
  elif command -v systemctl >/dev/null 2>&1; then
    # Linux with systemd
    sudo systemctl stop postgresql 2>/dev/null || sudo systemctl stop postgresql-14 2>/dev/null
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    net stop postgresql-x64-14 2>/dev/null || net stop postgresql 2>/dev/null || {
      echo "   ⚠️  Could not stop PostgreSQL service. Please stop it manually."
    }
  else
    echo "   ⚠️  Unsupported OS. Please stop PostgreSQL manually."
  fi
  echo "   ✅ PostgreSQL stop requested"
else
  echo "   ✅ PostgreSQL not running"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Doorman stopped."
echo "   Run ./start.sh to start again."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
