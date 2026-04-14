#!/bin/bash
# mysite-monitor.sh — Site health monitor with PM2 auto-restart
#
# Install (run once on server):
#   chmod +x /var/www/nextblog/scripts/mysite-monitor.sh
#   crontab -e
#   Add: */5 * * * * /var/www/nextblog/scripts/mysite-monitor.sh >> /var/log/nextblog-monitor.log 2>&1
#
# Checks:
#   1. HTTP 200 from https://sergovantseva.com/
#   2. PM2 process "nextblog" is online
#   3. Response time < 5s
#   4. Port 3000 is listening
#
# On failure: restarts PM2, waits 15s, verifies recovery, sends Telegram alert (optional)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SITE_URL="https://sergovantseva.com/"
PM2_NAME="nextblog"
APP_DIR="/var/www/nextblog"
LOG_FILE="/var/log/nextblog-monitor.log"
STATE_FILE="/tmp/nextblog-monitor-state"
MAX_RESTARTS=3          # alert after this many restarts in 1 hour
TIMEOUT_SEC=10
SLOW_THRESHOLD=3000     # ms — log warning if response slower than this

# Optional Telegram alerts — set these or leave empty to disable
TELEGRAM_TOKEN=""
TELEGRAM_CHAT_ID=""

# ── Helpers ───────────────────────────────────────────────────────────────────
TS() { date '+%Y-%m-%d %H:%M:%S'; }

log() { echo "$(TS) $*"; }

send_telegram() {
  local msg="$1"
  if [[ -n "$TELEGRAM_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}&text=${msg}&parse_mode=HTML" > /dev/null 2>&1 || true
  fi
}

restart_pm2() {
  log "ACTION: Restarting PM2 process $PM2_NAME"
  cd "$APP_DIR"
  pm2 restart "$PM2_NAME" --update-env 2>&1 | tail -3
  pm2 save --force > /dev/null 2>&1 || true
}

count_restarts_last_hour() {
  local count=0
  if [[ -f "$STATE_FILE" ]]; then
    local cutoff
    cutoff=$(date -d '1 hour ago' +%s 2>/dev/null || date -v-1H +%s 2>/dev/null || echo 0)
    while IFS= read -r line; do
      [[ "$line" =~ ^RESTART:([0-9]+)$ ]] && ts="${BASH_REMATCH[1]}"
      [[ -n "${ts:-}" && "$ts" -ge "$cutoff" ]] && ((count++)) || true
    done < "$STATE_FILE"
  fi
  echo "$count"
}

record_restart() {
  echo "RESTART:$(date +%s)" >> "$STATE_FILE"
  # Keep only last 50 entries
  if [[ -f "$STATE_FILE" ]]; then
    tail -50 "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
  fi
}

# ── Check 1: HTTP response ────────────────────────────────────────────────────
check_http() {
  local result
  result=$(curl -s -o /dev/null \
    -w "%{http_code} %{time_total}" \
    --max-time "$TIMEOUT_SEC" \
    --connect-timeout 5 \
    "$SITE_URL" 2>/dev/null || echo "000 0")

  local http_code time_ms
  http_code=$(echo "$result" | awk '{print $1}')
  time_ms=$(echo "$result" | awk '{printf "%d", $2 * 1000}')

  if [[ "$http_code" == "000" ]]; then
    log "FAIL: No response from $SITE_URL (timeout or connection refused)"
    return 1
  fi

  if [[ "$http_code" != "200" ]]; then
    log "FAIL: HTTP $http_code from $SITE_URL"
    return 1
  fi

  if [[ "$time_ms" -gt "$SLOW_THRESHOLD" ]]; then
    log "WARN: Slow response ${time_ms}ms (threshold ${SLOW_THRESHOLD}ms)"
  fi

  log "OK: HTTP $http_code in ${time_ms}ms"
  return 0
}

# ── Check 2: PM2 process status ───────────────────────────────────────────────
check_pm2() {
  local status
  status=$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
    procs = json.load(sys.stdin)
    for p in procs:
        if p.get('name') == '${PM2_NAME}':
            print(p.get('pm2_env', {}).get('status', 'unknown'))
            sys.exit(0)
    print('not_found')
except:
    print('error')
" 2>/dev/null || echo "error")

  if [[ "$status" != "online" ]]; then
    log "FAIL: PM2 process '$PM2_NAME' status is '$status'"
    return 1
  fi

  log "OK: PM2 process online"
  return 0
}

# ── Check 3: Port 3000 listening ──────────────────────────────────────────────
check_port() {
  if ! ss -tlnp 2>/dev/null | grep -q ':3000 ' && \
     ! netstat -tlnp 2>/dev/null | grep -q ':3000 '; then
    log "FAIL: Port 3000 not listening"
    return 1
  fi
  log "OK: Port 3000 listening"
  return 0
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  local failed=0

  check_http  || failed=1
  check_pm2   || failed=1
  check_port  || failed=1

  if [[ "$failed" -eq 0 ]]; then
    return 0
  fi

  # Something is down — attempt restart
  local restarts_last_hour
  restarts_last_hour=$(count_restarts_last_hour)

  log "INCIDENT: $restarts_last_hour restarts in last hour"
  record_restart

  if [[ "$restarts_last_hour" -ge "$MAX_RESTARTS" ]]; then
    log "ALERT: $MAX_RESTARTS+ restarts in 1 hour — skipping auto-restart, manual intervention needed"
    send_telegram "🚨 <b>sergovantseva.com DOWN</b>%0A${MAX_RESTARTS}+ restarts in 1h — manual fix needed%0AServer: $(hostname)"
    return 1
  fi

  restart_pm2
  record_restart

  log "Waiting 15s for recovery..."
  sleep 15

  # Verify recovery
  local recover_code
  recover_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$SITE_URL" 2>/dev/null || echo "000")

  if [[ "$recover_code" == "200" ]]; then
    log "RECOVERED: Site returned 200 after restart"
    send_telegram "✅ <b>sergovantseva.com recovered</b>%0APM2 restarted successfully"
  else
    log "FAILED TO RECOVER: HTTP $recover_code after restart"
    send_telegram "🚨 <b>sergovantseva.com still DOWN</b>%0AHTTP $recover_code after PM2 restart%0AManual intervention needed"
  fi
}

main
