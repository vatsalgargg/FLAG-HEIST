#!/usr/bin/env bash
# Runs at every boot of the TryHackMe machine (via flagheist-boot.service).
# Detects this machine's IP, points every player-facing link at it, starts all
# services and makes sure the player account exists.
set -euo pipefail
APP=/opt/flagheist
cd "$APP"

IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
[ -n "$IP" ] || IP="$(hostname -I | awk '{print $1}')"
[ -n "$IP" ] || { echo "flagheist-boot: no IP address found" >&2; exit 1; }
echo "flagheist-boot: machine IP is $IP"

# Replace the per-boot block at the end of .env
sed -i '/^# --- per-boot (managed by flagheist-boot.sh) ---$/,$d' .env
cat >> .env <<EOF
# --- per-boot (managed by flagheist-boot.sh) ---
PLATFORM_ORIGIN=http://$IP
COLLAB_PUBLIC_URL=http://$IP:8182
CHALLENGE_01_PUBLIC_URL=http://$IP:3101
CHALLENGE_03_TWITTER_URL=http://$IP:3103
CHALLENGE_04_PUBLIC_URL=http://$IP:3104
CHALLENGE_05_PUBLIC_URL=http://$IP:3105
CHALLENGE_07_PUBLIC_URL=http://$IP:3107
CHALLENGE_08_PUBLIC_URL=http://$IP:3107
CHALLENGE_09_PUBLIC_URL=http://$IP:3109
CHALLENGE_10_PUBLIC_URL=http://$IP:3110
CHALLENGE_12_PUBLIC_URL=http://$IP:3112
CHALLENGE_13_PUBLIC_URL=http://$IP:3113
EOF

# Remove sandbox leftovers from an unclean shutdown
docker ps -aq --filter label=flagheist.sandbox=true | xargs -r docker rm -f >/dev/null 2>&1 || true
docker network ls -q --filter label=flagheist.sandbox=true | xargs -r docker network rm >/dev/null 2>&1 || true

docker compose up -d --no-build

for _ in $(seq 1 90); do
  curl -sf http://127.0.0.1:8180/healthz >/dev/null && break
  sleep 2
done

docker compose exec -T platform node -e "$(cat deploy/tryhackme/provision-operator.js)"
echo "flagheist-boot: ready at http://$IP"
