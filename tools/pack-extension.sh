#!/bin/sh
# Packs extension/ into extension/mandy-start.xpi, which the start page links to for Zen and Firefox.
set -e
cd "$(dirname "$0")/../extension"
rm -f mandy-start.xpi
zip -q -X mandy-start.xpi manifest.json background.js content.js icon-48.png icon-128.png
echo "extension/mandy-start.xpi"
