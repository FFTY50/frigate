#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

if [[ ! -r /etc/os-release ]]; then
  echo "Cannot read /etc/os-release; this installer expects Debian." >&2
  exit 1
fi

# shellcheck disable=SC1091
. /etc/os-release

if [[ ${ID} != "debian" ]]; then
  echo "This installer is intended for Debian. Detected ID=${ID}." >&2
  exit 1
fi

${SUDO} apt-get update
${SUDO} apt-get install -y ca-certificates curl git gnupg lsb-release vainfo intel-gpu-tools

${SUDO} install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | ${SUDO} gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
${SUDO} chmod a+r /etc/apt/keyrings/docker.gpg

ARCH="$(dpkg --print-architecture)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
  | ${SUDO} tee /etc/apt/sources.list.d/docker.list >/dev/null

${SUDO} apt-get update
${SUDO} apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
${SUDO} systemctl enable --now docker

if [[ -n ${SUDO_USER:-} ]]; then
  ${SUDO} usermod -aG docker "${SUDO_USER}"
  echo "Added ${SUDO_USER} to the docker group. Log out and back in before running Docker without sudo."
fi

echo "Docker and Intel VAAPI tooling are installed."
