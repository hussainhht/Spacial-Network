# Proxmox VM + Docker Compose + Cloudflare Tunnel

This deployment uses the existing Next.js 16 / React 19 / TypeScript frontend,
Go 1.26 backend, mattn SQLite driver (CGO), Gorilla WebSocket hub, and local media.
No database migration to another engine is required. Traffic flows through
Cloudflare → VM cloudflared service → 127.0.0.1:8088 Nginx → isolated containers.
No router port forwarding is needed. These instructions do not deploy anything
until you execute them on your VM.

## 1. Proxmox host preparation

Use the Proxmox web console to create a VM from an Ubuntu Server 24.04 LTS or
Debian 13 installer ISO. Start with 4 vCPUs, 8 GiB RAM (Next builds need memory),
32+ GiB disk plus media capacity, VirtIO network/disk, and a LAN bridge. Install
the OS and an ordinary sudo administrator with SSH keys. Choose an unused VM ID.
On the **Proxmox host only**, after creation (replace 120 with your VM ID):

```sh
qm set 120 --onboot 1 --agent enabled=1
qm start 120
```

Keep Proxmox management and SSH restricted to your trusted LAN/VPN. Do not
install this application's Docker stack on the Proxmox host. Configure VM
backups to separate storage and periodically test restores.

## 2. Prepare the application VM

**Every command below runs inside the Ubuntu/Debian VM**, unless explicitly
labelled as a browser step. On a fresh OS:

```sh
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git qemu-guest-agent
sudo systemctl enable --now qemu-guest-agent
sudo install -m 0755 -d /etc/apt/keyrings
. /etc/os-release
# ID must be ubuntu or debian for this command.
curl -fsSL "https://download.docker.com/linux/$ID/gpg" | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

For an existing Docker installation follow the official upgrade guidance; do
not remove existing volumes or overwrite an existing installation blindly.
Use a current Docker Engine (at least 28 for reliable loopback publishing).
Membership in the docker group is root-equivalent; these commands use sudo.
Allow outbound DNS/HTTPS for package downloads and Cloudflare Tunnel connectivity
(outbound port 7844 UDP for QUIC or TCP for HTTP/2). Keep inbound access limited
to administrative LAN/VPN SSH. No inbound application ports are required.

## 3. Clone and configure

```sh
sudo install -d -o "$USER" -g "$(id -gn)" /opt/spacial-network
git clone https://github.com/hussainhht/Spacial-Network.git /opt/spacial-network
cd /opt/spacial-network
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Set `PUBLIC_ORIGIN=https://social.example.com` to your actual Cloudflare-managed
domain. Use an exact HTTPS origin without trailing slash, path, or port unless
that port is genuinely public. Never put tunnel credentials in this file or Git.
This file is ignored. Do not enable demo mode for production.

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml config --quiet
sudo docker compose --env-file .env.production -f compose.prod.yaml build --pull
sudo docker compose --env-file .env.production -f compose.prod.yaml up -d --wait
sudo docker compose --env-file .env.production -f compose.prod.yaml ps
sudo docker compose --env-file .env.production -f compose.prod.yaml exec proxy nginx -t
curl -fsS http://127.0.0.1:8088/healthz
curl -I http://127.0.0.1:8088/login
sudo ss -ltnp
```

Only `127.0.0.1:8088` is published. Neither 3000 nor 8080 should be published by
this stack. `/healthz` checks database reachability; it does not prove the whole
application is healthy. Each frontend/backend container has its own healthcheck.
Healthchecks report unhealthy containers but Docker restart policies only restart
exited containers; monitor health and disk space externally.

The project name is fixed to `spacial-network`. The named volumes are
`spacial-network_backend-data` (SQLite and journal files) and
`spacial-network_uploads` (mounted at `/app/data/uploads`). Rebuilds, restarts,
and `down` without `-v` retain them. Never run `down -v`, volume prune, or migration
`down`/`down-all` against production. Only one backend replica should use SQLite.
Automatic upward migrations execute at backend startup; take a backup before
updates. Keep database files on the VM's local disk, not NFS/SMB.

Existing development data is not automatically imported. The development Compose
project uses a different volume. Stop its backend, back up the whole `/app/data`
tree as described below (use its Compose file/project and `--user 0` if its old
files are root-owned), and restore into fresh production volumes. Retain the
original volume. Existing production volumes from older root-running images may
need a one-time ownership repair while all services are stopped:

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml run --rm --no-deps --user 0 --entrypoint sh backend -c 'chown -R 10001:10001 /app/data && chmod 700 /app/data && chmod 600 /app/data/*.db'
```

Run this only for the intended imported volume; it does not delete data.

## 4. Install cloudflared and create a tunnel

The following commands use a locally managed tunnel, keeping its configuration
on the VM. In your browser, first add your domain to Cloudflare and complete its
nameserver delegation; ensure the zone is active. Do not replace existing DNS
records until you are ready to switch traffic.

```sh
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
printf '%s\n' 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared
cloudflared tunnel login
cloudflared tunnel create spacial-network
```

Open the login link on your workstation and authorize the intended zone. Record
the resulting tunnel UUID, then set the variables below in your VM shell. The
hostname must match `PUBLIC_ORIGIN` without `https://`:

```sh
TUNNEL_ID=REPLACE_WITH_TUNNEL_UUID
PUBLIC_HOST=social.example.com
sudo install -d -m 700 /etc/cloudflared
sudo install -m 600 "$HOME/.cloudflared/$TUNNEL_ID.json" "/etc/cloudflared/$TUNNEL_ID.json"
sudo tee /etc/cloudflared/config.yml >/dev/null <<EOF_CONFIG
tunnel: $TUNNEL_ID
credentials-file: /etc/cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: $PUBLIC_HOST
    service: http://localhost:8088
  - service: http_status:404
EOF_CONFIG
sudo chmod 600 /etc/cloudflared/config.yml
cloudflared tunnel route dns "$TUNNEL_ID" "$PUBLIC_HOST"
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress validate
sudo cloudflared --config /etc/cloudflared/config.yml tunnel ingress rule "https://$PUBLIC_HOST/api/ws"
sudo cloudflared --config /etc/cloudflared/config.yml service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
```

This public hostname forwards **all paths**, including `/api/ws`, without
rewriting. Do not create a second dashboard-managed tunnel for the same hostname.
The final catch-all prevents other hostnames from being routed to the app.
The tunnel JSON and account `cert.pem` are secrets; keep them outside the repo,
restrict permissions, and back them up securely. A running tunnel needs only its
own JSON credentials, not the more powerful account certificate.

**Cloudflare browser settings:** enable Always Use HTTPS and WebSockets. Leave
API and authenticated HTML out of Cache Everything rules; bypass cache for
`/api/*` and avoid media cache overrides until privacy expectations are reviewed.
Do not put interactive Access challenges on `/api/ws` unless you deliberately
provide an Access-compatible client. Cloudflare manages the public certificate.
Nginx intentionally sends `X-Forwarded-Proto: https` upstream because this listener
is exclusively behind the HTTPS tunnel. HTTP between cloudflared and loopback is
expected. Never expose this listener to a LAN/public address.

## 5. Verify after launch

Replace the hostname in these VM/workstation commands:

```sh
curl -fsS https://social.example.com/healthz
curl -I https://social.example.com/login
curl -i https://social.example.com/api/users/me
# Expected: 401 without a cookie.
curl -i -X POST https://social.example.com/api/login -H 'Origin: https://evil.example.com' -H 'Content-Type: application/json' --data '{}'
# Expected: 403 before credential processing.
curl -i --http1.1 https://social.example.com/api/ws -H 'Origin: https://social.example.com' -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ=='
# Expected: 401 without authentication, never an unauthenticated upgrade.
```

In a browser, register test accounts and log in. In developer tools verify the
session cookie is HttpOnly, Secure, SameSite=Lax, Path=/ and host-only (no Domain).
Host-only cookies intentionally avoid granting sibling subdomains access. No
cookie-domain override is necessary for this same-origin architecture.
Verify requests use `/api/*`, images use `/uploads/*`, and the socket uses
`wss://YOUR_HOST/api/ws` with a **101** upgrade. The HttpOnly cookie is sent by the
browser during the upgrade; never put a token in the URL. Check there are no
mixed-content or localhost requests. A CLI write must send the trusted Origin;
origin enforcement is CSRF protection and does not replace session authentication.

Using two accounts eligible to chat (the existing follow permission rules still
apply), verify private and group messages, unread counts, notifications, and
online/offline status in two browsers. Disable/re-enable network to check
reconnection and history recovery. Upload an avatar, post attachments, comment
image and group/event image; restart backend and verify the same media URLs still
work. Restart the VM and verify Docker, cloudflared and all containers recover.
Test unauthorized access to private posts and groups separately from media URLs.

```sh
sudo docker compose --env-file .env.production -f compose.prod.yaml restart backend
sudo docker compose --env-file .env.production -f compose.prod.yaml logs --tail=100 backend frontend proxy
sudo journalctl -u cloudflared -f
```

## 6. Backup and restore

Back up both media and SQLite **together with backend writes stopped**. An active
SQLite `.db` copy alone can be inconsistent or omit journal/WAL data. This simple
procedure deliberately accepts downtime, uses the application's existing image,
and includes all of `/app/data` including the nested uploads volume. Do not place
backups in Git. Run in a VM bash shell in `/opt/spacial-network`:

```bash
set -euo pipefail
mkdir -p backups
chmod 700 backups
BACKUP_FILE="backups/spacial-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
sudo docker compose --env-file .env.production -f compose.prod.yaml stop proxy backend
trap 'sudo docker compose --env-file .env.production -f compose.prod.yaml start backend proxy' EXIT
sudo docker compose --env-file .env.production -f compose.prod.yaml run --rm -T --no-deps --entrypoint tar backend -czf - -C /app/data . > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"
tar -tzf "$BACKUP_FILE" > /dev/null
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
sudo docker compose --env-file .env.production -f compose.prod.yaml start backend proxy
trap - EXIT
```

Copy archives and checksums to encrypted off-VM storage, alongside the deployed
Git revision and a secure copy of configuration. Schedule backups and monitor
failures. Archive validity is not proof of a valid database: test restoration.

Restore to **fresh volumes in a separate Compose project**, retaining original
volumes. Use the same application revision that produced the backup first to
avoid unintended migrations. Stop the original stack to release loopback port
8088. On a new VM clone the repository, install Docker and create `.env.production`
first. Replace the archive filename:

```sh
cd /opt/spacial-network
BACKUP_FILE=backups/REPLACE_WITH_BACKUP.tar.gz
sha256sum -c "$BACKUP_FILE.sha256"
sudo docker compose --env-file .env.production -f compose.prod.yaml stop
# Use a NEW project name each restore; do not extract over existing databases.
sudo docker compose -p spacial-restored --env-file .env.production -f compose.prod.yaml build
sudo docker compose -p spacial-restored --env-file .env.production -f compose.prod.yaml run --rm -T --no-deps --entrypoint tar backend -xzpf - -C /app/data < "$BACKUP_FILE"
sudo docker compose -p spacial-restored --env-file .env.production -f compose.prod.yaml up -d --wait
curl -fsS http://127.0.0.1:8088/healthz
```

Run all post-launch checks and inspect restored users/posts/media. Continue using
`-p spacial-restored` for every subsequent operation on that deployment. On a
restore VM, configure/start its tunnel separately; never have two independent
database copies serving the same tunnel simultaneously. Do not delete the
original volumes until the restored system and offsite backups are verified.

## 7. Updates and restarts

Run the backup procedure above first. Keep its Git revision (`git rev-parse HEAD`)
and archive. Review migrations and release changes before updating:

```sh
cd /opt/spacial-network
git status --short
git pull --ff-only
sudo docker compose --env-file .env.production -f compose.prod.yaml config --quiet
sudo docker compose --env-file .env.production -f compose.prod.yaml build --pull
sudo docker compose --env-file .env.production -f compose.prod.yaml up -d --wait
# Nginx resolves container DNS at startup; restart after upstream replacement.
sudo docker compose --env-file .env.production -f compose.prod.yaml restart proxy
sudo docker compose --env-file .env.production -f compose.prod.yaml ps
curl -fsS http://127.0.0.1:8088/healthz
```

Routine safe restart: `sudo docker compose --env-file .env.production -f
compose.prod.yaml restart`. For tunnel config changes run ingress validation,
then `sudo systemctl restart cloudflared`. Rolling back code alone may not undo
schema migrations: restore a matched backup to fresh volumes for rollback.
Production image base tags float within their release lines; record image IDs
and pin verified digests for controlled releases, and rebuild regularly for fixes.

## 8. Configuration and development

`APP_ENV=production` requires trusted HTTPS origins and forces Secure cookies.
`TRUSTED_ORIGINS` is an exact comma-separated allowlist; keep the production
Compose value to the one configured public origin. `DB_DIR`, `DB_FILE`, and
`UPLOADS_DIR` control paths; the production mounts must match. `TRUST_PROXY=true`
is enabled only with the backend isolated from host ports and untrusted peers.
Nginx overwrites client-IP headers from Cloudflare's edge-supplied
`CF-Connecting-IP`, preventing spoofed X-Forwarded-For values from reaching rate
limiting. Local health requests have no Cloudflare client IP and use their peer.
Untrusted local VM processes and Docker administrators are outside this trust
boundary. Keep the VM single-purpose. Do not attach other apps to these networks.
The backend has no need to infer cookie security from spoofable forwarded headers.

`NEXT_PUBLIC_*` values are **build-time** browser constants. Production passes
empty HTTP/WS origins so browser requests follow the current domain automatically.
`SITE_URL` controls server metadata and is also passed at build time; rebuild when
changing `PUBLIC_ORIGIN`. Do not set browser origins to Docker names or localhost.
Images are unoptimized in the production image to serve authenticated-origin media
without an image optimizer fetching internal services. Local-IP optimizer access
is only enabled under `next dev`.

Existing development workflows remain:

```sh
# From backend/:
go run ./cmd/server
# From frontend/ in another terminal:
npm ci
npm run dev
# Or from the repo root:
docker compose up --build
```

Development uses `http://localhost:3000` with direct backend HTTP/WS on port 8080,
non-Secure HttpOnly Lax cookies and the exact localhost frontend origin. The
original `compose.yaml` is for development; do not combine it with the production
file. To develop remotely, explicitly configure build-time frontend origins and
backend trusted origins with the actual development addresses.

## 9. Troubleshooting

| Symptom | Check / remedy |
| --- | --- |
| Cloudflare 1033 | `systemctl status cloudflared`, credentials, outbound connectivity and tunnel UUID. |
| Cloudflare 502 | VM `curl http://127.0.0.1:8088/healthz`, container health, Nginx logs, tunnel service URL. |
| Nginx 502 after update | Check upstream health and restart proxy to refresh Docker DNS. |
| Login POST 403 | Exact `PUBLIC_ORIGIN`, browser Origin, HTTPS, rebuild/restart after domain change. CLI writes need Origin. |
| Login succeeds but no session | Inspect Secure/HttpOnly/Lax cookie, ensure browser uses HTTPS and same hostname; clear old development cookies. |
| WebSocket fails | Verify `/api/ws`, trusted Origin, session cookie, Cloudflare WebSockets enabled, 101 upgrade; unauthenticated 401 is expected. |
| Media 404 after restart | Check uploads volume and `/app/data/uploads`; do not change Compose project names accidentally. |
| 413 | Total body is capped at 25 MiB; per-image limit remains 5 MiB and posts allow four attachments. |
| 429 | Rate limiter; respect Retry-After. Check Cloudflare client-IP header if all unauthenticated users share a bucket. |
| SQLite permission denied | Check UID 10001 ownership on imported volumes; stop services before ownership repair. |
| Disk full / database locked | Check `df -h`, volume capacity, one backend instance, logs; do not delete SQLite journals. |
| Next build killed | Increase VM memory/swap and check dependency install/network; use Node 22 image. |

## 10. Security review and limits

Fixed: browser localhost URLs; permissive WebSocket origins; fixed localhost CORS;
insecure production cookies; CSRF on writes (including login); GET logout;
unbounded login/outer API request bodies; directory listings on uploads;
root-running images; SQLite file permissions; missing HTTP timeouts and health
checks; sensitive query strings in proxy access logs. Authentication/session
checks and service-level membership, follow, ownership and visibility rules remain
in place. Existing suites exercise those permissions. Do not run the development seeder against production: it clears tables and
creates accounts with a shared documented password. It is not shipped in the
runtime image or invoked at startup. No development auth bypass
was found in the backend; the frontend's separate static demo is not enabled here.

Uploads retain magic-byte MIME allowlists, random server-generated filenames,
exclusive creation, size limits, and traversal checks on removal. SVG/HTML uploads
are not accepted. Private-post **media URLs remain publicly retrievable if known**,
as in the existing app; random names are not access control. If private media must
be confidential, authenticated media authorization plus cache controls is a
separate release requirement before inviting users who expect that guarantee.
Existing WebSockets authenticate at connection time; logout/session expiry does
not forcibly disconnect an already-open connection. Reload/close the logged-out
client; immediate server-side session revocation of live sockets remains future
hardening. Neither of these limitations is solved by Cloudflare Tunnel.

No CSP is imposed without evaluating the existing inline/3D assets. No malware
scanner, per-user media quota, full penetration test, or capacity/DoS certification
is included. Watch disk usage, keep host/images patched, and define retention.
Upload storage failures return generic messages rather than filesystem paths.
See SECURITY-REVIEW.md for the remaining audit scope. Do not describe this local preparation as a tested
public deployment until the post-launch checks pass on your actual VM/domain.

References: [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/),
[Docker Debian installation](https://docs.docker.com/engine/install/debian/),
[Cloudflare package repository](https://pkg.cloudflare.com/),
[Cloudflare locally managed tunnel setup](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/),
[Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
