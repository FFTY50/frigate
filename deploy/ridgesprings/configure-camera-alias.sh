#!/usr/bin/env bash
set -euo pipefail

CAMERA_IFACE="${CAMERA_IFACE:-enp1s0}"
CAMERA_ALIAS_IP="${CAMERA_ALIAS_IP:-10.7.7.100}"
CAMERA_ALIAS_NETMASK="${CAMERA_ALIAS_NETMASK:-255.255.255.0}"
ALIAS_NAME="${CAMERA_IFACE}:0"
CONFIG_PATH="/etc/network/interfaces.d/${CAMERA_IFACE}-camera-alias"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

cat > "${CONFIG_PATH}" <<EOF
# Camera LAN alias for Ridge Springs Frigate cameras.
# Primary LAN remains DHCP on ${CAMERA_IFACE} via /etc/network/interfaces.
auto ${ALIAS_NAME}
iface ${ALIAS_NAME} inet static
    address ${CAMERA_ALIAS_IP}
    netmask ${CAMERA_ALIAS_NETMASK}
EOF

ifup "${ALIAS_NAME}" || ip addr add "${CAMERA_ALIAS_IP}/24" dev "${CAMERA_IFACE}" || true

ip -br addr show "${CAMERA_IFACE}"
ip route show 10.7.7.0/24 || true
