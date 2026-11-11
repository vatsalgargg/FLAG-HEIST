#!/usr/bin/env bash
# Builds the Flag Heist TryHackMe machine. Run ONCE, as root, on a fresh
# Ubuntu Server 22.04/24.04 (x86_64) VM, from a copy of the project:
#   sudo bash deploy/tryhackme/build-vm.sh
# Then shut down, export the disk (.ova / .vmdk) and upload it to TryHackMe.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run as root (sudo)." >&2; exit 1; }

SRC="$(cd "$(dirname "$0")/../.." && pwd)"
APP=/opt/flagheist

echo "==> 1/8 Packages: Docker, Node 20, tools"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl rsync openssl
command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
systemctl enable --now docker

echo "==> 2/8 Copy project to $APP (without answers, docs or local state)"
mkdir -p "$APP"
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude '.env*' --exclude '/backups' --exclude '/exports' \
  --exclude 'deploy/tryhackme/room' --exclude 'deploy/oracle' --exclude '/docs' --exclude 'services/ctf/docs' --exclude .impeccable \
  --exclude .dist --exclude '*.db' --exclude .git --exclude ctf.zip \
  "$SRC/" "$APP/"
cd "$APP"

echo "==> 3/8 Production .env with random secrets"
cat > .env <<EOF
CTF_NODE_ENV=production
COOKIE_SECURE=false
CTF_BIND_ADDR=0.0.0.0
SEQUENTIAL_UNLOCK=false
CTF_API_URL=http://127.0.0.1:8180
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_JWT_SECRET=$(openssl rand -hex 32)
RESET_TOKEN=$(openssl rand -hex 32)
FLAG_PEPPER=$(openssl rand -hex 32)
ADMIN_SEED_USERNAME=admin
ADMIN_SEED_PASSWORD=$(openssl rand -hex 24)
CH04_SESSION_SECRET=$(openssl rand -hex 32)
CH07_SESSION_SECRET=$(openssl rand -hex 32)
TURNSTILE_SECRET_KEY=
SENTRY_DSN=
ALERT_WEBHOOK_URL=
EOF
chmod 600 .env

echo "==> 4/8 Sanity checks, redact platform flags, build all images (this takes a while)"
[ -f services/ctf/challenges/10-config-backup/data/backups/system-config.json ] \
  || { echo "Challenge 10 backups missing from the copy - aborting." >&2; exit 1; }
# TryHackMe checks the answers, so the scoring platform image must not contain real flags.
node deploy/tryhackme/strip-platform-flags.mjs "$APP"
COMPOSE_PARALLEL_LIMIT=2 docker compose --profile images build

echo "==> 5/8 Build the mission console (TryHackMe mode: answers go to TryHackMe)"
npm ci
NEXT_PUBLIC_THM_MODE=1 npm run build

echo "==> 6/8 First start + seed (so the machine boots fast later)"
docker compose up -d --no-build
for _ in $(seq 1 90); do curl -sf http://127.0.0.1:8180/healthz >/dev/null && break; sleep 2; done
docker compose exec -T platform node -e "$(cat deploy/tryhackme/provision-operator.js)"

echo "==> 7/8 Remove source, solutions and generators from disk"
# Images are built; keep only what containers mount at runtime:
#   challenges/*/artifacts (downloads) and challenges/*/public (static sites).
find services -type f \
  ! -path '*/challenges/*/artifacts/*' ! -path '*/challenges/*/public/*' \
  -delete
rm -f AGENTS.md DESIGN.md PRODUCT.md README.md .gitlab-ci.yml
rm -rf scripts
docker builder prune -af >/dev/null

echo "==> 8/8 Services, user, cleanup"
id flagheist >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin flagheist
chown -R flagheist:flagheist "$APP/.next" "$APP/node_modules"
chmod 755 deploy/tryhackme/flagheist-boot.sh
install -m 644 deploy/tryhackme/flagheist-boot.service /etc/systemd/system/
install -m 644 deploy/tryhackme/flagheist-console.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable flagheist-boot flagheist-console
systemctl restart flagheist-boot flagheist-console

# Lock down: no password SSH; clear history and logs before export
if [ -f /etc/ssh/sshd_config ]; then
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
fi
apt-get clean
journalctl --rotate && journalctl --vacuum-time=1s >/dev/null || true
rm -f /root/.bash_history /home/*/.bash_history
history -c || true

echo
echo "Done. Check http://<this-vm-ip>/ in a browser, then:"
echo "  1. Remove your own SSH key from ~/.ssh/authorized_keys if you added one"
echo "  2. sudo shutdown now"
echo "  3. Export the VM as .ova and upload it to TryHackMe"
