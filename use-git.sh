#!/usr/bin/env bash
set -e

KEY_NAME="$1"

if [ -z "$KEY_NAME" ]; then
  echo "Usage: use-git.sh <ssh keyfile name>"
  exit 1
fi

KEY_PATH="$HOME/.ssh/$KEY_NAME"

if [ ! -f "$KEY_PATH" ]; then
  echo "SSH key not found: $KEY_PATH"
  exit 1
fi

echo "Killing existing ssh-agent (if any)..."
if pgrep -u "$USER" ssh-agent > /dev/null; then
  pkill ssh-agent || true
fi

echo "Starting new ssh-agent..."
eval "$(ssh-agent -s)"

echo "Adding SSH key to agent and macOS keychain..."
ssh-add --apple-use-keychain "$KEY_PATH"

echo "Configuring git to use this SSH key (local repo)..."
git config --local core.sshCommand "ssh -i $KEY_PATH -o IdentitiesOnly=yes"

echo
echo "Testing GitHub SSH connection..."
ssh -T git@github.com || true

echo
echo "Done ✅"
echo "Git is now using: $KEY_PATH"
