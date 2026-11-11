# Deploy on Oracle Cloud Free + Cloudflare Tunnel ($0)

## 1. Create the server
1. Sign up at https://cloud.oracle.com (card needed for verification only).
2. Compute → Instances → Create instance:
   - Image: **Ubuntu 24.04**
   - Shape: **VM.Standard.A1.Flex** (Ampere ARM), **4 OCPU / 24 GB**
   - Add your SSH public key (or download the generated one).
   - "Out of capacity"? Try another availability domain, or retry later.
3. No firewall ports need opening — the Cloudflare Tunnel connects outbound.

## 2. Connect
```bash
ssh -i <key> ubuntu@<server-public-ip>
```

## 3. Copy the project up (from your PC, in the parent folder of the project)
```bash
scp -i <key> -r flag-heist-ctf-main ubuntu@<server-public-ip>:~
```
(Skip `node_modules` and `.next` if you can — they're rebuilt on the server.)

## 4. Run the setup script (on the server)
```bash
cd ~/flag-heist-ctf-main
DOMAIN=yourdomain.com bash deploy/oracle/setup.sh
```
It installs Docker/Node, adds swap, writes a production `.env` with random secrets,
builds and starts all services, builds the frontend and installs it as a systemd service.
Your admin password is in `.env` → `ADMIN_SEED_PASSWORD`.

## 5. Check it works locally on the server
```bash
curl -s localhost:8180/healthz; echo
curl -sI localhost:3000 | head -1
sudo docker compose ps
```

## 6. Cloudflare Tunnel
Your domain must be on Cloudflare (free plan).
```bash
# install cloudflared (ARM64)
curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb

cloudflared tunnel login                 # opens a URL; authorise your domain
cloudflared tunnel create flagheist      # prints the TUNNEL_ID

sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /etc/cloudflared/
sudo cp deploy/oracle/cloudflared-config.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml    # set TUNNEL_ID and yourdomain.com

# create DNS records for every hostname
for h in ctf collab ch01 ch03 ch04 ch05 ch07 ch09 ch10 ch12 ch13; do
  cloudflared tunnel route dns flagheist $h.yourdomain.com
done

sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

## 7. Test before the event
- Open `https://ctf.yourdomain.com`, register a team, log in.
- Open every challenge link from the platform and solve at least one.
- Log in as admin.
- Reboot once (`sudo reboot`) and confirm everything comes back by itself.

## Updating later
```bash
cd ~/flag-heist-ctf-main
# copy new files up, then:
sudo docker compose --profile images build && sudo docker compose up -d
npm ci && npm run build && sudo systemctl restart flagheist-web
```

## Backups
The `backup` service writes hourly SQLite backups to `./backups/`. Copy them off the server now and then:
`scp -i <key> -r ubuntu@<ip>:~/flag-heist-ctf-main/backups .`
