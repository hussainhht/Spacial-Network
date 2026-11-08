#!/usr/bin/env bash
# Local/CI checks only. Never operates on the production Compose project.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:---full}"
case "$mode" in --static|--full) ;; *) echo "Usage: $0 [--static|--full]" >&2; exit 2 ;; esac
export PUBLIC_ORIGIN=https://social.l3acler.com
export PYTHONDONTWRITEBYTECODE=1
scratch=$(mktemp -d "${TMPDIR:-/tmp}/spacial-validation.XXXXXX")
project="spacial-validation-$(date +%s)-$$"
compose=(docker compose -p "$project" -f "$scratch/compose.json")
started=false
cleanup() {
    result=$?
    trap - EXIT
    if "$started"; then
        if [ "$result" -ne 0 ]; then "${compose[@]}" logs --no-color --tail=100 || true; fi
        # No -v: this script never deletes Docker volumes. Test data uses binds.
        "${compose[@]}" down --remove-orphans || true
        "${compose[@]}" run --rm --no-deps --user 0 --cap-add DAC_OVERRIDE --cap-add FOWNER \
            --entrypoint sh backend -c 'rm -f /app/data/*.db* /app/data/uploads/persistence.txt; chmod 777 /app/data /app/data/uploads' || true
    fi
    # The cleanup helper creates a project network; remove containers/networks only.
    if "$started"; then "${compose[@]}" down --remove-orphans || true; fi
    rm -rf "$scratch" || echo "Temporary test files remain at $scratch" >&2
    exit "$result"
}
trap cleanup EXIT
docker compose --env-file .env.production.example -f compose.prod.yaml config --quiet
docker compose --env-file .env.production.example -f compose.prod.yaml config --format json > "$scratch/resolved.json"
python3 scripts/check_production_config.py < "$scratch/resolved.json"
python3 scripts/test-production-config.py "$scratch/resolved.json"
# Keep production settings/ports, but substitute fresh temporary bind directories
# so testing cannot open real databases or create/remove persistent named volumes.
mkdir -p "$scratch/data" "$scratch/uploads"
python3 - "$scratch" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
config = json.loads((root / "resolved.json").read_text())
config.pop("name", None)
config.pop("volumes", None)
for network in config["networks"].values():
    network.pop("name", None)
config["services"]["backend"]["volumes"] = [
    {"type": "bind", "source": str(root / name), "target": target}
    for name, target in (("data", "/app/data"), ("uploads", "/app/data/uploads"))
]
(root / "compose.json").write_text(json.dumps(config))
PY
"${compose[@]}" config --quiet
if [ "$mode" = --static ]; then
    echo "Static checks passed. Docker builds, nginx -t and runtime checks were NOT run."
    exit 0
fi
docker info > /dev/null
build_options=(--pull)
if [ -n "${BUILDX_BUILDER:-}" ]; then build_options+=(--builder "$BUILDX_BUILDER"); fi
"${compose[@]}" build "${build_options[@]}"
started=true
"${compose[@]}" run --rm --no-deps --user 0 --cap-add CHOWN --cap-add FOWNER --cap-add DAC_OVERRIDE \
    --entrypoint sh backend -c 'chown 10001:10001 /app/data /app/data/uploads && chmod 700 /app/data /app/data/uploads'
"${compose[@]}" up -d --wait --wait-timeout 240
"${compose[@]}" exec -T proxy nginx -t
"${compose[@]}" exec -T proxy wget -q -O /dev/null http://frontend:3000/login
"${compose[@]}" exec -T proxy wget -q -O /dev/null http://backend:8080/healthz
curl --fail --silent --show-error http://127.0.0.1:8088/healthz
curl --fail --silent --show-error --output /dev/null http://127.0.0.1:8088/login

docker inspect $("${compose[@]}" ps -q) > "$scratch/containers.json"
python3 - "$scratch/containers.json" <<'PY'
import json, sys
containers = json.load(open(sys.argv[1]))
assert len(containers) == 3
for c in containers:
    service = c["Config"]["Labels"]["com.docker.compose.service"]
    bindings = {k: v for k, v in (c["HostConfig"]["PortBindings"] or {}).items() if v}
    expected = {"8080/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8088"}]} if service == "proxy" else {}
    assert bindings == expected, (service, bindings)
    tmpfs = c["HostConfig"]["Tmpfs"]
    assert {"rw", "noexec", "nosuid", "size=64m", "mode=1777"} <= set(tmpfs["/tmp"].split(",")), tmpfs
print("Effective Docker port bindings and tmpfs options passed")
PY
docker network inspect "${project}_frontend" "${project}_backend" > "$scratch/networks.json"
python3 - "$scratch/networks.json" <<'PY'
import json, sys
networks = json.load(open(sys.argv[1]))
assert [n["Internal"] for n in networks] == [False, True], networks
print("Effective Docker network isolation passed")
PY

# Check the actual compiled browser assets, not development source fallbacks.
"${compose[@]}" exec -T frontend node -e '
const fs = require("node:fs"), path = require("node:path");
function scan(dir) { for (const file of fs.readdirSync(dir, {withFileTypes:true})) {
  const p = path.join(dir, file.name); if (file.isDirectory()) scan(p);
  else if (p.endsWith(".js") && /(?:https?|wss?):\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:[\/"\x27`]|$)/i.test(fs.readFileSync(p,"utf8"))) {
    throw Error("Loopback URL in production browser asset: " + p);
  }
}} scan(".next/static");'

# Synthetic persistence probes in this test project only. Recreate the backend
# container and verify both SQLite and uploaded bytes survive replacement.
"${compose[@]}" exec -T backend sh -c 'printf persistence-probe > /app/data/uploads/persistence.txt'
"${compose[@]}" exec -T backend social-migrate version > /dev/null
curl --fail --silent --show-error http://127.0.0.1:8088/api/register \
    -H "Origin: $PUBLIC_ORIGIN" \
    -F username=persistenceprobe -F firstName=Persistence -F lastName=Probe \
    -F email=probe@example.invalid -F password=ValidationOnly123! -F gender=male -F dateOfBirth=1994-06-15 \
    > "$scratch/register.json"
python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))["success"] is True' "$scratch/register.json"
"${compose[@]}" up -d --force-recreate --wait --wait-timeout 120 backend
"${compose[@]}" exec -T backend sh -c 'test "$(cat /app/data/uploads/persistence.txt)" = persistence-probe'
"${compose[@]}" restart proxy
"${compose[@]}" exec -T proxy nginx -t
curl --retry 10 --retry-delay 1 --retry-connrefused --fail --silent --show-error http://127.0.0.1:8088/healthz
curl --fail --silent --show-error http://127.0.0.1:8088/api/login \
    -H "Origin: $PUBLIC_ORIGIN" -H 'Content-Type: application/json' \
    --data '{"username":"persistenceprobe","password":"ValidationOnly123!"}' > "$scratch/login.json"
python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))["user_id"] > 0' "$scratch/login.json"
curl --fail --silent --show-error http://127.0.0.1:8088/uploads/persistence.txt > "$scratch/media.txt"
test "$(cat "$scratch/media.txt")" = persistence-probe
echo "Production container validation passed. Cloudflare, public TLS and VM backup/restore require manual checks."
