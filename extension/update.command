#!/bin/bash
# Didebaan Companion updater (macOS / Linux): double-click to replace this folder's files with the
# latest released version. Chrome keeps loading the extension from this same folder, so the pairing stays.
set -e
cd "$(dirname "$0")"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
echo "Downloading the latest Didebaan Companion…"
curl -fL --progress-bar -o "$tmp/companion.zip" "https://github.com/vehij/didebaan/releases/latest/download/didebaan-companion.zip"
unzip -qo "$tmp/companion.zip" -d .
version="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)"
echo "Updated to version $version. The extension reloads itself within a few minutes, or right away when you open its popup."
