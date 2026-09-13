#!/usr/bin/env bash
set -euo pipefail
frontend_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(dirname "$frontend_dir")"
python3 - <<'PY'
import socket
for port in (3000, 8080):
    with socket.socket() as sock:
        if sock.connect_ex(('localhost', port)) == 0:
            raise SystemExit(f'Port {port} is busy; smoke tests require isolated servers.')
PY
runtime_dir="$(mktemp -d /tmp/social-cleanup-smoke.XXXXXX)"
export CLEANUP_ARTIFACTS="${CLEANUP_ARTIFACTS:-$runtime_dir/artifacts}"
trap 'rm -f "$runtime_dir/server"' EXIT
(cd "$repo_dir/backend" && go build -o "$runtime_dir/server" ./cmd/server)
python3 "$repo_dir/.agents/skills/webapp-testing/scripts/with_server.py" \
  --server "cd '$runtime_dir' && '$runtime_dir/server'" --port 8080 \
  --server "cd '$frontend_dir' && npm run start" --port 3000 \
  -- python3 -u "$frontend_dir/tests/cleanup_smoke.py"
printf 'Smoke artifacts: %s\n' "$CLEANUP_ARTIFACTS"
