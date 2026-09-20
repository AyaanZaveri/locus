#!/usr/bin/env sh
# Rebuild the composed OpenRouter banner (SVG + PNG).
# Run from anywhere; paths resolve relative to this script.
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
PNG="$HERE/../../companies/openrouter/images/composed_banner.png"

python3 "$HERE/compose.py" --png "$PNG"
