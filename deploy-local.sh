#!/bin/sh
# Deploy GardenOS to the local serving directory (~/GardenOS).
#
# Why a copy: macOS TCC prevents launchd background services from reading
# ~/Documents, so the always-on local server (LaunchAgent
# com.gardenos.server) serves ~/GardenOS instead. Run this after every
# update; the installed app then shows its "Update available" prompt.
#
# Usage:  sh deploy-local.sh

set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/GardenOS"

mkdir -p "$DEST"
rsync -a --delete \
  --exclude .git \
  --exclude backups \
  --exclude export \
  --exclude import \
  "$SRC/" "$DEST/"

echo "Deployed to $DEST"
echo "App: http://127.0.0.1:8080  (server restarts pick it up immediately)"
