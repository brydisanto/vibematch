#!/usr/bin/env bash
# Schedule a one-shot event-end snapshot via launchd.
#
# Usage:
#   schedule-event-snapshot.sh <local datetime>
# Example:
#   schedule-event-snapshot.sh "2026-06-08 12:00"   # 12 PM local
#
# The argument is parsed by `date -j -f` so any format date(1) on macOS
# accepts works. Local timezone is assumed.
#
# Creates ~/Library/LaunchAgents/com.pindrop.event-snapshot.<epoch>.plist
# with StartCalendarInterval set to the given Year/Month/Day/Hour/Minute.
# The wrapper script (run-event-snapshot.sh) self-cleans the plist
# after firing, so the schedule is truly one-shot.

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 \"YYYY-MM-DD HH:MM\""
    exit 1
fi

WHEN_LOCAL="$1"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNNER="$REPO_DIR/scripts/run-event-snapshot.sh"

if [[ ! -x "$RUNNER" ]]; then
    chmod +x "$RUNNER"
fi

# Parse the local datetime into epoch
EPOCH=$(date -j -f "%Y-%m-%d %H:%M" "$WHEN_LOCAL" +%s 2>/dev/null || true)
if [[ -z "$EPOCH" ]]; then
    echo "ERROR: could not parse '$WHEN_LOCAL'. Use 'YYYY-MM-DD HH:MM'."
    exit 1
fi

NOW=$(date +%s)
if [[ "$EPOCH" -le "$NOW" ]]; then
    echo "ERROR: '$WHEN_LOCAL' is in the past (epoch $EPOCH <= now $NOW)."
    exit 1
fi

YEAR=$(date -r "$EPOCH" +%Y)
MONTH=$(date -r "$EPOCH" +%-m)
DAY=$(date -r "$EPOCH" +%-d)
HOUR=$(date -r "$EPOCH" +%-H)
MIN=$(date -r "$EPOCH" +%-M)

LABEL="com.pindrop.event-snapshot.$EPOCH"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$RUNNER</string>
        <string>$LABEL</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Year</key><integer>$YEAR</integer>
        <key>Month</key><integer>$MONTH</integer>
        <key>Day</key><integer>$DAY</integer>
        <key>Hour</key><integer>$HOUR</integer>
        <key>Minute</key><integer>$MIN</integer>
    </dict>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>$REPO_DIR/snapshots/_logs/$LABEL.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$REPO_DIR/snapshots/_logs/$LABEL.stderr.log</string>
</dict>
</plist>
EOF

mkdir -p "$REPO_DIR/snapshots/_logs"

# Bootstrap into the gui domain so it survives login sessions.
UID_NUM=$(id -u)
launchctl bootstrap "gui/$UID_NUM" "$PLIST" 2>/dev/null \
    || launchctl load "$PLIST" 2>/dev/null \
    || { echo "ERROR: failed to register LaunchAgent at $PLIST"; exit 1; }

echo "Scheduled."
echo "  label:    $LABEL"
echo "  plist:    $PLIST"
echo "  fires at: $(date -r "$EPOCH" '+%Y-%m-%d %H:%M:%S %Z') (local)"
echo "            $(date -u -r "$EPOCH" '+%Y-%m-%dT%H:%M:%SZ') (UTC)"
echo
echo "Cancel with:"
echo "  launchctl bootout gui/$UID_NUM $PLIST && rm -f $PLIST"
