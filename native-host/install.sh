#!/bin/bash
# Installs the native messaging bridge that lets the browser extension use
# Claude Code / Codex CLI (your logged-in subscription, not an API key) as
# an AI provider. Run this once, from Terminal:
#   bash install.sh
#
# What it does: registers the Mac app's own executable (Farhad's CV
# AutoFill.app/Contents/MacOS/CVAutoFill — see the sibling
# cv_autofill_mac_app repo) as a native messaging host for Chrome and/or
# Firefox, scoped to only this extension. No separate helper binary — the
# browser launches the app's own binary in a headless mode it detects from
# the extra argument every native-messaging launch carries (see
# NativeMessagingHost.swift / CVAutoFillApp.swift in that repo). It's a
# fresh, separate launch each request, not a connection to an already-open
# GUI window if you happen to have one open.
#
# Chrome/Firefox only — Safari and Orion use a different, non-native-
# messaging architecture for talking to a helper app, so this bridge
# doesn't reach them.
#
# Requires the Mac app to already be built (cv_autofill_mac_app/build_app.sh).
# If you later move or rebuild that .app somewhere else, re-run this script
# to re-point the registration.

set -euo pipefail

HOST_NAME="com.farhadshad.cvautofill.clibridge"
FIREFOX_GECKO_ID="cv-autofill@farhadshad.com" # must match manifest.json's browser_specific_settings.gecko.id
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Farhad's CV AutoFill — native messaging bridge installer"
echo "Lets the extension use Claude Code / Codex CLI as an AI provider, via your logged-in subscription."
echo

# Look for the Mac app in the usual places before asking.
CANDIDATES=(
  "/Applications/Farhad's CV AutoFill.app"
  "$SCRIPT_DIR/../../cv_autofill_mac_app/dist/Farhad's CV AutoFill.app"
)
APP_PATH=""
for candidate in "${CANDIDATES[@]}"; do
  if [ -d "$candidate" ]; then
    APP_PATH="$candidate"
    break
  fi
done

if [ -n "$APP_PATH" ]; then
  read -r -p "Found the app at: $APP_PATH — use this? [Y/n]: " USE_FOUND
  if [[ "$USE_FOUND" =~ ^[Nn]$ ]]; then
    APP_PATH=""
  fi
fi

if [ -z "$APP_PATH" ]; then
  read -r -p "Path to \"Farhad's CV AutoFill.app\": " APP_PATH
fi

EXECUTABLE="$APP_PATH/Contents/MacOS/CVAutoFill"
if [ ! -x "$EXECUTABLE" ]; then
  echo "Couldn't find an executable at: $EXECUTABLE"
  echo "Build the app first — from cv_autofill_mac_app/: ./build_app.sh"
  exit 1
fi
echo "Using: $EXECUTABLE"
echo

echo "Now I need the extension's ID from each browser you use it in."
echo "Chrome: open chrome://extensions, turn on Developer mode (top right),"
echo "find \"Farhad's CV AutoFill\", and copy the ID shown under its name."
echo
read -r -p "Chrome extension ID (leave blank to skip Chrome): " CHROME_ID

if [ -n "$CHROME_ID" ]; then
  CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  mkdir -p "$CHROME_DIR"
  cat > "$CHROME_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Farhad's CV AutoFill — native bridge to Claude Code / Codex",
  "path": "$EXECUTABLE",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$CHROME_ID/"]
}
EOF
  echo "Registered for Chrome: $CHROME_DIR/$HOST_NAME.json"
else
  echo "Skipped Chrome."
fi
echo

read -r -p "Also set up for Firefox? [y/N]: " FIREFOX_YN
if [[ "$FIREFOX_YN" =~ ^[Yy]$ ]]; then
  FIREFOX_DIR="$HOME/Library/Application Support/Mozilla/NativeMessagingHosts"
  mkdir -p "$FIREFOX_DIR"
  cat > "$FIREFOX_DIR/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Farhad's CV AutoFill — native bridge to Claude Code / Codex",
  "path": "$EXECUTABLE",
  "type": "stdio",
  "allowed_extensions": ["$FIREFOX_GECKO_ID"]
}
EOF
  echo "Registered for Firefox: $FIREFOX_DIR/$HOST_NAME.json"
else
  echo "Skipped Firefox."
fi

echo
echo "Done. Reload the extension (chrome://extensions → the reload icon, or"
echo "about:debugging#/runtime/this-firefox in Firefox), then check"
echo "Options → AI → Claude Code / OpenAI Codex — it should say \"bridge found\"."
