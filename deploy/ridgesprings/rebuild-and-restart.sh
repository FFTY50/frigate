#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RR_ROOT="${RR_ROOT:-/opt/retailrewind}"
IMAGE_TAG="${RETAIL_REWIND_IMAGE:-retailrewind/frigate:current}"

if [[ -f "${RR_ROOT}/.env" ]]; then
  ENV_IMAGE_TAG="$(sed -n 's/^RETAIL_REWIND_IMAGE=//p' "${RR_ROOT}/.env" | tail -1)"
  if [[ -n "${ENV_IMAGE_TAG}" ]]; then
    IMAGE_TAG="${ENV_IMAGE_TAG}"
  fi
fi

cd "${REPO_ROOT}"

make version
docker buildx build \
  --target=frigate \
  --file docker/main/Dockerfile \
  --tag "${IMAGE_TAG}" \
  --load \
  .

docker compose \
  --env-file "${RR_ROOT}/.env" \
  -f "${RR_ROOT}/docker-compose.yml" \
  up -d

docker compose \
  --env-file "${RR_ROOT}/.env" \
  -f "${RR_ROOT}/docker-compose.yml" \
  ps
