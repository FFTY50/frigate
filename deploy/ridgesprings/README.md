# Ridge Springs Retail Rewind Deployment

This folder is the first live-test deployment path for replacing the Raspberry Pi 5 Frigate install with a Dell OptiPlex 3070 running Debian and Docker.

## What This Uses

- Frigate/Retail Rewind is built locally from the checked-out repo branch.
- The runtime compose and persistent data live under `/opt/retailrewind`.
- The Ridge Springs camera config is migrated to Frigate config `0.17-0`.
- Raspberry Pi hwaccel was replaced with Intel VAAPI (`preset-vaapi`) and OpenVINO GPU detection.
- Cloudflare Tunnel is optional and controlled by `/opt/retailrewind/.env`.

## Clone This Branch

Clone the repo onto the OptiPlex. The branch used while creating this deployment was `claude/frigate-retail-rewind-Ycn4R`; use that branch unless the live-test branch has moved:

```bash
sudo install -d -o "$USER" -g "$USER" /opt/retailrewind-app
git clone <repo-url> /opt/retailrewind-app
cd /opt/retailrewind-app
git checkout claude/frigate-retail-rewind-Ycn4R
```

## Fresh Debian Setup

Run this once on the OptiPlex:

```bash
cd /opt/retailrewind-app
sudo ./deploy/ridgesprings/debian-prereqs.sh
```

Log out and back in if the script adds your user to the `docker` group.

## First Install

```bash
cd /opt/retailrewind-app
./deploy/ridgesprings/install.sh
```

The installer creates:

- `/opt/retailrewind/docker-compose.yml`
- `/opt/retailrewind/.env`
- `/opt/retailrewind/config/config.yml`
- `/opt/retailrewind/media`
- `/opt/retailrewind/db`
- `/opt/retailrewind/backups`

Frigate will be available at:

- Local UI: `http://<box-ip>:8971`
- Local internal API/UI binding: `http://127.0.0.1:5000`

## Cloudflare Tunnel

The old tunnel token should not be committed to git. Add it on the box:

```bash
nano /opt/retailrewind/.env
```

Set:

```dotenv
COMPOSE_PROFILES=tunnel
CLOUDFLARED_TOKEN=<token>
```

Then restart:

```bash
docker compose --env-file /opt/retailrewind/.env -f /opt/retailrewind/docker-compose.yml up -d
```

## Updating From This Branch

After UI/branding changes land on the branch:

```bash
cd /opt/retailrewind-app
./deploy/ridgesprings/update.sh
```

That performs:

1. `git pull --ff-only`
2. `make version`
3. Docker build of the `frigate` target
4. `docker compose up -d`

## Useful Checks

```bash
docker compose --env-file /opt/retailrewind/.env -f /opt/retailrewind/docker-compose.yml ps
docker logs -f frigate
docker exec -it frigate vainfo --display drm --device /dev/dri/renderD128
docker exec -it frigate intel_gpu_top
```

If the logs show VAAPI driver errors, change `LIBVA_DRIVER_NAME=iHD` to `LIBVA_DRIVER_NAME=i965` in `/opt/retailrewind/.env`, then restart compose.

## Notes

- `/opt/retailrewind/config/config.yml` is copied only if missing, so UI edits and site tweaks are not overwritten by later updates.
- Back up `/opt/retailrewind/config`, `/opt/retailrewind/db`, and `/opt/retailrewind/media` before major Frigate upgrades.
- The compose keeps the container name `frigate` and network `nvrnet` to stay close to the previous install.
