# Dell Refurbished NVR Setup Guide
## Headless Debian + Frigate on Dell Hardware

This guide covers setting up a refurbished Dell desktop/tower as a headless Frigate NVR running Debian Linux.

---

## What You Need

- Refurbished Dell desktop (x86-64/amd64)
- NVMe or SSD for OS (500GB+ recommended)
- Large HDD for video storage (4TB–8TB)
- USB drive (8GB+) for Debian installer
- MacBook or other machine to flash the USB
- Ethernet cable

---

## Part 1 — Create the Debian Installer USB (on MacBook)

1. Download **Debian 12 (Bookworm) amd64** netinstall ISO from debian.org
   - Make sure it is the **amd64** version — NOT ARM, NOT Raspberry Pi

2. Install Balena Etcher on the Mac (balena.io/etcher) — free and straightforward

3. Open Etcher → Select ISO → Select your USB drive → Flash

   > **Warning:** Double-check you are flashing to the USB, not your Mac's internal drive or any other attached storage.

---

## Part 2 — BIOS Configuration on the Dell

Boot the Dell and press **F2** to enter BIOS setup.

### Required changes:

| Setting | Change To |
|---|---|
| Secure Boot | Disabled |
| SATA Operation / Controller Mode | AHCI (not RAID) |
| Intel VMD | Disabled (if present) |
| Boot Order | USB first |

> **Most common issue:** Dell ships with storage controller in RAID mode. Linux cannot see drives in RAID mode. Always switch to AHCI before installing.

Save and exit BIOS.

---

## Part 3 — Install Debian

1. Insert USB, power on, press **F12** for the one-time boot menu
2. Select your USB drive
3. Choose **Graphical Install**
4. Follow prompts:
   - Set hostname (e.g. `ridgesprings-nvr`)
   - Set root password
   - Select your OS disk (the NVMe/SSD — NOT the storage HDD)
   - When asked about software, select only **SSH server** and **standard system utilities** — no desktop environment
5. Complete install and reboot, removing USB when prompted

---

## Part 4 — Mount the Video Storage Drive

The storage HDD may have existing footage from a previous install. The data is safe — Linux filesystems are architecture-independent (ARM ext4 = x86 ext4).

### Identify the storage disk:
```bash
lsblk
```
Look for your large HDD (e.g. `sda`). The OS will be on the NVMe (`nvme0n1`).

### Create the mount point:
```bash
mkdir -p /mnt/frigate-storage
```

### Test mount:
```bash
mount /dev/sda1 /mnt/frigate-storage
ls /mnt/frigate-storage
```
You should see existing footage folders (clips, recordings, exports) if carried over from a previous install.

### Make it permanent (auto-mounts on reboot):
This single command detects the UUID and filesystem type automatically:
```bash
echo "UUID=$(blkid -s UUID -o value /dev/sda1)  /mnt/frigate-storage  $(blkid -s TYPE -o value /dev/sda1)  defaults  0  2" | tee -a /etc/fstab
```

Verify:
```bash
tail -1 /etc/fstab
mount -a
```

---

## Part 5 — Network Setup

### Bring up the network interface:
```bash
dhcpcd enp1s0
```
> Note: The interface name may vary. Use `ip link` to confirm yours.

### Make it persist on reboot:
```bash
nano /etc/network/interfaces
```
Add at the bottom:
```
auto enp1s0
iface enp1s0 inet dhcp
```
Save with `Ctrl+O`, Enter, `Ctrl+X`, then:
```bash
systemctl enable networking
```

### Verify IP address:
```bash
ip addr show enp1s0
```
Write down the IP address.

---

## Part 6 — SSH Setup

Once you have internet access:
```bash
apt update && apt install -y openssh-server
systemctl enable ssh
systemctl start ssh
```

### Connect from MacBook:
```bash
ssh root@<ip-address>
```

### Finding the IP if it changed (run from MacBook):
```bash
# Install if needed: brew install arp-scan
sudo arp-scan --localnet
```
Look for the machine's hostname or MAC address in the results.

---

## Part 7 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

---

## Part 8 — Install Frigate

Create the config directory and compose file:
```bash
mkdir -p /opt/frigate
nano /opt/frigate/docker-compose.yml
```

Basic compose file:
```yaml
services:
  frigate:
    container_name: frigate
    privileged: true
    restart: unless-stopped
    image: ghcr.io/blakeblackshear/frigate:stable
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - /opt/frigate/config:/config
      - /mnt/frigate-storage:/media/frigate
    ports:
      - "5000:5000"
      - "8554:8554"
      - "8555:8555/tcp"
      - "8555:8555/udp"
```

Start Frigate:
```bash
cd /opt/frigate
docker compose up -d
```

Access the web UI from any browser on the same network:
```
http://<server-ip>:5000
```

---

## Quick Reference — Common Commands

| Task | Command |
|---|---|
| Check disks | `lsblk` |
| Check IP | `ip addr show enp1s0` |
| Check network | `ping -c 3 google.com` |
| Check Docker | `docker ps` |
| Frigate logs | `docker logs frigate` |
| Restart Frigate | `docker restart frigate` |
| Check storage mount | `df -h /mnt/frigate-storage` |

---

## Troubleshooting

**NVMe not visible during Debian install**
→ Go to BIOS, change SATA Operation from RAID to AHCI

**USB not recognized as bootable**
→ Disable Secure Boot in BIOS; re-flash USB with Etcher (do not just copy the ISO file)

**Network not coming up**
→ Run `dhcpcd enp1s0` manually, then configure `/etc/network/interfaces` as above

**Storage drive not mounting**
→ Run `blkid /dev/sda1` to confirm it has a filesystem; if blank, it needs formatting (see below)

**Formatting a blank storage drive (WARNING: destroys all data)**
```bash
fdisk /dev/sda   # press g, n, w
mkfs.ext4 /dev/sda1
```
