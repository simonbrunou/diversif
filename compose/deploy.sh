#!/usr/bin/env bash
# Rolling deploy for diversif: pulls IMAGE, brings up the idle slot,
# waits for healthy, then drains the old slot. Idempotent — re-running
# with the same IMAGE is a no-op.
#
# Usage:
#   IMAGE=ghcr.io/simonbrunou/diversif:abc123 ./deploy.sh
#
# Required env: IMAGE, DOMAIN, ORIGIN
# State: which slot is currently active is detected from running containers.

set -euo pipefail

cd "$(dirname "$0")"

: "${IMAGE:?IMAGE required (e.g. ghcr.io/simonbrunou/diversif:sha)}"
: "${DOMAIN:?DOMAIN required}"
: "${ORIGIN:?ORIGIN required}"

# Detect current active slot (blue/green) by inspecting which container is up.
blue_running=$(docker ps --filter 'name=^/diversif-blue$' --format '{{.ID}}' || true)
green_running=$(docker ps --filter 'name=^/diversif-green$' --format '{{.ID}}' || true)

if [[ -n "$blue_running" && -z "$green_running" ]]; then
  ACTIVE=blue
  IDLE=green
elif [[ -z "$blue_running" && -n "$green_running" ]]; then
  ACTIVE=green
  IDLE=blue
elif [[ -z "$blue_running" && -z "$green_running" ]]; then
  # Cold start — no slot running. Bring up blue.
  ACTIVE=none
  IDLE=blue
else
  echo "Both blue and green are running — manual cleanup required." >&2
  echo "Stop one with: docker compose -f diversif.yaml --profile <slot> down" >&2
  exit 1
fi

echo "→ active=$ACTIVE  deploying to=$IDLE  image=$IMAGE"

export IMAGE DOMAIN ORIGIN

# Bring up the idle slot with the new image.
docker compose -f diversif.yaml --profile "$IDLE" up -d --pull always

# Wait for the new slot to be healthy (max 90s).
echo "→ waiting for diversif-$IDLE health..."
for i in {1..30}; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "diversif-$IDLE" 2>/dev/null || echo "missing")
  if [[ "$status" == "healthy" ]]; then
    echo "→ diversif-$IDLE healthy"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "✗ diversif-$IDLE failed to become healthy (status: $status)" >&2
    docker logs --tail=50 "diversif-$IDLE" >&2 || true
    docker compose -f diversif.yaml --profile "$IDLE" down
    exit 1
  fi
  sleep 3
done

# Traefik will already have started routing to the new slot via container
# label discovery. Give it a moment to converge before draining the old slot.
sleep 5

if [[ "$ACTIVE" != "none" ]]; then
  echo "→ draining diversif-$ACTIVE (graceful, 10s)"
  docker compose -f diversif.yaml --profile "$ACTIVE" down --timeout 10
fi

echo "✓ deploy complete: $IDLE is live with $IMAGE"
