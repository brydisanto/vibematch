#!/usr/bin/env bash
# Wrapper invoked by the launchd LaunchAgent. Runs the event-end
# snapshot script and self-cleans the LaunchAgent so a one-shot
# schedule doesn't re-fire on the same calendar minute next month.
#
# Usage:
#   run-event-snapshot.sh <plist_label>
# where plist_label matches ~/Library/LaunchAgents/<label>.plist.

set -uo pipefail

LABEL="${1:-}"
REPO_DIR="/Users/bryan/.gemini/antigravity/playground/vibematch"
LOG_DIR="$REPO_DIR/snapshots/_logs"
mkdir -p "$LOG_DIR"

TS=$(date +"%Y-%m-%dT%H-%M-%SZ")
LOG_FILE="$LOG_DIR/$LABEL.$TS.log"

{
    echo "==== event snapshot run @ $(date -u +%Y-%m-%dT%H:%M:%SZ) (label=$LABEL) ===="
    cd "$REPO_DIR" || { echo "FATAL: cannot cd to $REPO_DIR"; exit 1; }
    /opt/homebrew/bin/node scripts/event-end-snapshot.mjs
    echo "==== snapshot exit=$? ===="

    # Reveal the snapshots folder in Finder so Bryan can grab the CSVs.
    /usr/bin/open "$REPO_DIR/snapshots/"

    # Self-clean: delete the plist FIRST so a future calendar match
    # won't re-fire it, THEN bootout. `bootout` immediately kills this
    # script — if rm runs after bootout, it never executes and the
    # plist stays on disk. Order matters.
    if [[ -n "$LABEL" ]]; then
        PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
        if [[ -f "$PLIST" ]]; then
            echo "==== removing $PLIST ===="
            rm -f "$PLIST"
        fi
        echo "==== unloading agent $LABEL ===="
        /bin/launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null \
            || /bin/launchctl remove "$LABEL" 2>/dev/null \
            || true
    fi
} >> "$LOG_FILE" 2>&1
