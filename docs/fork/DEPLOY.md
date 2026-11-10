# Running emailsgym.com

The app runs on a Hetzner Cloud CX23 (Nuremberg, Ubuntu 26.04) reached only through a Cloudflare
Tunnel. Set up 2026-11-10 (Phase 3).

| What | Where |
|---|---|
| Address | https://emailsgym.com (domain on Cloudflare Registrar, auto-renew; never change it: passkeys are bound to it) |
| Server | `2.31.159.190`, SSH as `deploy` (app) or `root` (system) with `~/.ssh/emails_gym_ed25519`; passwords off |
| App | `/home/deploy/emails-gym` (a clone of this repo's `main`), `docker compose`, web bound to `127.0.0.1:8080` only |
| Settings | `/home/deploy/emails-gym/.env`: `RP_ID=emailsgym.com`, `ORIGIN=https://emailsgym.com`, `INVITE_ONLY=1`, `ALLOW_GUEST=0`, `FIRST_USER_ADMIN=0`, `WEB_PORT=127.0.0.1:8080`, `CF_CONNECTING_IP='$http_cf_connecting_ip'` |
| Tunnel | `cloudflared` service, tunnel `emails-gym` (`5bbfb515-5d6b-4771-822c-eb9d94a37b95`), config `/etc/cloudflared/config.yml`, CNAME `emailsgym.com` in Cloudflare DNS |
| Firewall | ufw: SSH in, nothing else (the tunnel only dials out); fail2ban on SSH; unattended security upgrades |
| Backups | `/usr/local/bin/emails-gym-backup` at 03:30 (cron), `data/` to `/var/backups/emails-gym/data-YYYY-MM-DD.tar.gz`, 14 days; plus Hetzner server backups if ticked in the console |

## Deploy an update

```bash
git push origin main                      # from this Mac, after the checks pass
ssh -i ~/.ssh/emails_gym_ed25519 deploy@2.31.159.190 'cd ~/emails-gym && git pull --ff-only && docker compose up -d --build'
curl -s https://emailsgym.com/api/health  # {"ok":true,...}
```

Installed phones pick the update up on their next open or two (the service worker).

## Invite a friend

Settings → Account → Admin dashboard → invite codes. They open https://emailsgym.com, enter the
code, save a passkey with Face ID, then Share → Add to Home Screen (needed for notifications).

## Restore a backup

```bash
ssh -i ~/.ssh/emails_gym_ed25519 root@2.31.159.190
cd /home/deploy/emails-gym && sudo -u deploy docker compose stop
tar -xzf /var/backups/emails-gym/data-YYYY-MM-DD.tar.gz -C /home/deploy/emails-gym   # replaces data/
sudo -u deploy docker compose up -d
```

## Moving to the Mac mini later

Run the same containers there with the same `.env`, copy `data/` across, install `cloudflared`
with this tunnel's credentials (`/etc/cloudflared/*.json` and `config.yml`, pointing at the new
machine's `127.0.0.1:8080`), stop the tunnel here, start it there. The address and everyone's
passkeys stay as they are.
