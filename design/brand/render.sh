#!/bin/sh
# Rasterizes an HTML or SVG file with headless Chrome: render.sh <input> <out.png> <width> <height> [scale]
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
  --window-size="$3,$4" --force-device-scale-factor="${5:-1}" --screenshot="$2" "file://$(cd "$(dirname "$1")" && pwd)/$(basename "$1")" >/dev/null 2>&1
