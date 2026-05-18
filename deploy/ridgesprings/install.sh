#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RR_ROOT="${RR_ROOT:-/opt/retailrewind}"

if [[ ${EUID} -eq 0 ]]; then
  SUDO=""
  INSTALL_OWNER="${SUDO_USER:-root}"
else
  SUDO="sudo"
  INSTALL_OWNER="${USER}"
fi
INSTALL_GROUP="$(id -gn "${INSTALL_OWNER}")"

install_owned_dir() {
  ${SUDO} install -d -m 0755 -o "${INSTALL_OWNER}" -g "${INSTALL_GROUP}" "$1"
}

copy_if_missing() {
  local src="$1"
  local dst="$2"

  if [[ -e "${dst}" ]]; then
    echo "Keeping existing ${dst}"
    return
  fi

  ${SUDO} install -m 0644 -o "${INSTALL_OWNER}" -g "${INSTALL_GROUP}" "${src}" "${dst}"
  echo "Installed ${dst}"
}

install_owned_dir "${RR_ROOT}"
install_owned_dir "${RR_ROOT}/config"
install_owned_dir "${RR_ROOT}/media"
install_owned_dir "${RR_ROOT}/db"
install_owned_dir "${RR_ROOT}/backups"

copy_if_missing "${SCRIPT_DIR}/docker-compose.yml" "${RR_ROOT}/docker-compose.yml"
copy_if_missing "${SCRIPT_DIR}/.env.example" "${RR_ROOT}/.env"
copy_if_missing "${SCRIPT_DIR}/config.yml" "${RR_ROOT}/config/config.yml"

echo "Runtime files are in ${RR_ROOT}."
echo "Edit ${RR_ROOT}/.env before enabling Cloudflare Tunnel."

"${SCRIPT_DIR}/rebuild-and-restart.sh"
