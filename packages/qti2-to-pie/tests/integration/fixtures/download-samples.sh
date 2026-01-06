#!/bin/bash
# Download QTI 2.1 samples from OAT-SA QTI-SDK (GPL-2.0)
# Source: https://github.com/oat-sa/qti-sdk/tree/master/test/samples/ims/items/2_1

set -e

BASE_URL="https://raw.githubusercontent.com/oat-sa/qti-sdk/master/test/samples/ims/items/2_1"

echo "Downloading QTI 2.1 sample files from OAT-SA QTI-SDK..."
echo "Source: ${BASE_URL}"
echo "License: GPL-2.0"
echo ""

# Download samples covering our supported interaction types
FILES=(
  "choice.xml"
  "choice_multiple.xml"
  "extended_text.xml"
  "order.xml"
  "match.xml"
  "text_entry.xml"
  "inline_choice.xml"
  "gap_match.xml"
  "hotspot.xml"
  "graphic_gap_match.xml"
  "associate.xml"
)

for file in "${FILES[@]}"; do
  echo "Downloading ${file}..."
  curl -sSL "${BASE_URL}/${file}" -o "${file}"
done

echo ""
echo "✓ Downloaded ${#FILES[@]} QTI 2.1 sample files"
echo ""
echo "These files are licensed under GPL-2.0"
echo "Copyright: Open Assessment Technologies S.A."
