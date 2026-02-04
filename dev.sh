#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONT_DIR="$SCRIPT_DIR/front"

# Check if directories exist
if [ ! -d "$BACKEND_DIR" ]; then
    echo "Error: Backend directory not found at $BACKEND_DIR"
    exit 1
fi

if [ ! -d "$FRONT_DIR" ]; then
    echo "Error: Front directory not found at $FRONT_DIR"
    exit 1
fi

# Escape paths for AppleScript
BACKEND_DIR_ESCAPED=$(echo "$BACKEND_DIR" | sed 's/"/\\"/g')
FRONT_DIR_ESCAPED=$(echo "$FRONT_DIR" | sed 's/"/\\"/g')

# Open iTerm2 and create tabs with commands
osascript <<EOF
tell application "iTerm2"
    activate

    # Create a new window
    set newWindow to (create window with default profile)

    # First tab - Backend
    tell current session of newWindow
        write text "cd \"$BACKEND_DIR_ESCAPED\" && yarn dev"
    end tell

    # Second tab - Front
    tell newWindow
        set newTab to (create tab with default profile)
        tell current session of newTab
            write text "cd \"$FRONT_DIR_ESCAPED\" && yarn dev:https"
        end tell
    end tell
end tell
EOF

echo "✓ iTerm2 opened with 2 tabs:"
echo "  • Tab 1: Backend (yarn dev)"
echo "  • Tab 2: Front (yark dev:https)"
