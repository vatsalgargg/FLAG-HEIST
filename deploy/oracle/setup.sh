#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu 24.04 Oracle Cloud (ARM A1) server.
# Usage (on the server, inside the project folder):
#   DOMAIN=yourdomain.com bash deploy/oracle/setup.sh
set -euo pipefail

: "${DOMAIN:?Set DOMAIN, e.g. DOMAIN=yourdomain.com bash deploy/oracle/setup.sh}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$APP_DIR"

echo "==> Installing Docker, Node 20, git"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo apt-get install -y git openssl

echo "==> Adding 4 GB swap (helps image builds)"
if ! swapon --show | grep -q swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> Writing production .env"
if [ -f .env ] && grep -q "FLAGHEIST_PRODUCTION=1" .env; then
  echo "    .env already production; leaving it alone"
else
  [ -f .env ] && cp .env ".env.local-backup.$(date +%s)"
  sed -e "s/__DOMAIN__/${DOMAIN}/g" \
      -e "s/__JWT__/$(openssl rand -hex 32)/" \
      -e "s/__ADMINJWT__/$(openssl rand -hex 32)/" \
      -e "s/__RESET__/$(openssl rand -hex 32)/" \
      -e "s/__PEPPER__/$(openssl rand -hex 32)/" \
      -e "s/__ADMINPW__/$(openssl rand -base64 18 | tr -d '/+=')/" \
      deploy/oracle/env.production.template > .env
  chmod 600 .env
  echo "    Admin password saved in .env (ADMIN_SEED_PASSWORD) - note it down."
fi

echo "==> Building and starting backend + all challenges (takes a while)"
sudo docker compose --profile images build
sudo docker compose up -d

echo "==> Building the frontend"
npm ci
npm run build

echo "==> Installing frontend systemd service"
sed -e "s#__APP_DIR__#${APP_DIR}#g" -e "s#__USER__#${USER}#g" \
    deploy/oracle/flagheist-web.service | sudo tee /etc/systemd/system/flagheist-web.service >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable --now flagheist-web

echo
echo "Done. Check:  curl -s localhost:3000 >/dev/null && echo web ok;  curl -s localhost:8180/healthz"
echo "Next: set up the Cloudflare Tunnel (see deploy/oracle/README.md, step 6)."
