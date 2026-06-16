#!/bin/bash

LOG="/Users/marquez/Library/Logs/ruta220.tunnel.error.log"

# Esperar hasta que aparezca la URL
while true; do
    URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | tail -1)
    if [ -n "$URL" ]; then
        osascript -e "display notification \"$URL\" with title \"Ruta 220 Online\" subtitle \"Tu servidor está listo\" sound name \"Glass\""
        break
    fi
    sleep 3
done
