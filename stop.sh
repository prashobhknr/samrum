#!/bin/bash
# ============================================================
# Doorman - Stop All Services
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
    # Fallback: kill by port
    PID=$(lsof -i :"$port" -sTCP:LISTEN -t 2>/dev/null)
    if [ -n "$PID" ]; then
      kill "$PID"
      echo "   ✅ $name stopped (killed port $port, pid $PID)"
    else
      echo "   ✅ $name not running"
    fi
  fi
}

kill_pid_file "Backend"  "backend"  3000
kill_pid_file "Frontend" "frontend" 3001

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Doorman stopped. PostgreSQL left running."
echo "   Run ./start.sh to start again."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
