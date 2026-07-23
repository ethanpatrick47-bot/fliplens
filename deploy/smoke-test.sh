#!/usr/bin/env bash
set -euo pipefail

app_dir="${APP_DIR:-/home/karlsubuntu/fliplens}"
port="${PORT:-8790}"
base_url="http://127.0.0.1:${port}"
log_file="$(mktemp /tmp/fliplens-smoke.XXXXXX.log)"
app_pid=""

cleanup() {
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then
    kill "$app_pid"
    wait "$app_pid" 2>/dev/null || true
  fi
  rm -f "$log_file"
}
trap cleanup EXIT

cd "$app_dir"
GEMINI_API_KEY="smoke-test-only" \
FLIPLENS_PER_IP_HOURLY_LIMIT=10 \
FLIPLENS_GLOBAL_DAILY_LIMIT=100 \
npm run start -- --hostname 127.0.0.1 --port "$port" >"$log_file" 2>&1 &
app_pid=$!

for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "$base_url/api/health" >/dev/null; then
    break
  fi
  if ! kill -0 "$app_pid" 2>/dev/null; then
    cat "$log_file" >&2
    exit 1
  fi
  sleep 1
done

curl --fail --silent --show-error "$base_url/" >/dev/null
curl --fail --silent --show-error "$base_url/api/health" | grep -q '"status":"ok"'
curl --silent --show-error --head "$base_url/" | grep -qi '^x-content-type-options: nosniff'

for _ in $(seq 1 10); do
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$base_url/api/analyze")"
  [[ "$status" == "400" ]] || { echo "Expected 400 before rate limit, received $status" >&2; exit 1; }
done

status="$(curl --silent --output /dev/null --write-out '%{http_code}' -H 'Content-Type: application/json' --data '{}' "$base_url/api/analyze")"
[[ "$status" == "429" ]] || { echo "Expected 429 after rate limit, received $status" >&2; exit 1; }

echo "FlipLens smoke test passed."
