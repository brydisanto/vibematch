#!/bin/bash

# Simple wrapper to run Next.js with restricted memory 
# and automatically restart it if it crashes.

export NODE_OPTIONS="--max-old-space-size=2048 --dns-result-order=ipv4first"

echo "Starting VibeMatch dev server with restricted memory (2GB) and auto-restart..."

while true; do
  npm run dev
  
  # If the server dies, pause 2 seconds then restart
  echo "Server crashed or stopped. Restarting in 2 seconds..."
  sleep 2
done
