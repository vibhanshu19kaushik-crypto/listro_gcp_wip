#!/bin/bash

# v3.49 Image Extraction Verification Script
# Tests that images are correctly extracted from product galleries only

NODE_API="https://listrov3-node-api-648176215467.asia-south1.run.app"

echo "================================"
echo "🧪 v3.49 Image Extraction Tests"
echo "================================"

# Test 1: Golden Standard ASIN
echo -e "\n📦 Test 1: Golden Standard ASIN (B0FDW55HNT)"
GOLD_RESPONSE=$(curl -s -X POST "$NODE_API/api/scrape-product" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.in/dp/B0FDW55HNT"}')

GOLD_COUNT=$(echo "$GOLD_RESPONSE" | jq '.product.images | length')
GOLD_ASIN=$(echo "$GOLD_RESPONSE" | jq -r '.product.asin')
GOLD_TITLE=$(echo "$GOLD_RESPONSE" | jq -r '.product.title' | cut -c1-50)

echo "  ASIN: $GOLD_ASIN"
echo "  Title: $GOLD_TITLE"
echo "  Images: $GOLD_COUNT"

if [ "$GOLD_COUNT" -eq 7 ]; then
  echo "  ✅ PASS: Exactly 7 images"
else
  echo "  ❌ FAIL: Expected 7, got $GOLD_COUNT"
  exit 1
fi

# Save golden images
echo "$GOLD_RESPONSE" | jq '.product.images' > /tmp/gold_images_v349.json

# Test 2: Existing Product ASIN
echo -e "\n📦 Test 2: Existing Product ASIN (B0DZ66M8N2)"
EXIST_RESPONSE=$(curl -s -X POST "$NODE_API/api/scrape-product" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.in/dp/B0DZ66M8N2"}')

EXIST_COUNT=$(echo "$EXIST_RESPONSE" | jq '.product.images | length')
EXIST_ASIN=$(echo "$EXIST_RESPONSE" | jq -r '.product.asin')
EXIST_TITLE=$(echo "$EXIST_RESPONSE" | jq -r '.product.title' | cut -c1-50)

echo "  ASIN: $EXIST_ASIN"
echo "  Title: $EXIST_TITLE"
echo "  Images: $EXIST_COUNT"

if [ "$EXIST_COUNT" -eq 7 ]; then
  echo "  ✅ PASS: Exactly 7 images"
else
  echo "  ❌ FAIL: Expected 7, got $EXIST_COUNT"
  exit 1
fi

# Save existing images
echo "$EXIST_RESPONSE" | jq '.product.images' > /tmp/exist_images_v349.json

# Test 3: Verify no overlap
echo -e "\n🔍 Test 3: Verify Zero Image Overlap"
echo "  Golden images:"
cat /tmp/gold_images_v349.json | jq '.[] | split("/")[-1]' | head -2

echo "  Existing images:"
cat /tmp/exist_images_v349.json | jq '.[] | split("/")[-1]' | head -2

# Extract image IDs for comparison
GOLD_IDS=$(cat /tmp/gold_images_v349.json | jq -r '.[] | split("/")[-1]' | cut -d. -f1 | sort)
EXIST_IDS=$(cat /tmp/exist_images_v349.json | jq -r '.[] | split("/")[-1]' | cut -d. -f1 | sort)

OVERLAP=$(comm -12 <(echo "$GOLD_IDS") <(echo "$EXIST_IDS") | wc -l)

echo "  Overlap count: $OVERLAP"

if [ "$OVERLAP" -eq 0 ]; then
  echo "  ✅ PASS: Zero overlap between products"
else
  echo "  ❌ FAIL: Found $OVERLAP overlapping images"
  exit 1
fi

# Test 4: Verify image sources
echo -e "\n🌐 Test 4: Verify Image Sources (Amazon CDN only)"
GOLD_DOMAINS=$(cat /tmp/gold_images_v349.json | jq -r '.[] | split("/")[2]' | sort | uniq)
EXIST_DOMAINS=$(cat /tmp/exist_images_v349.json | jq -r '.[] | split("/")[2]' | sort | uniq)

echo "  Golden image domains:"
echo "$GOLD_DOMAINS" | sed 's/^/    /'

echo "  Existing image domains:"
echo "$EXIST_DOMAINS" | sed 's/^/    /'

VALID_DOMAINS=("m.media-amazon.com" "images-eu.ssl-images-amazon.com" "images-na.ssl-images-amazon.com")

ALL_VALID=true
for domain in $GOLD_DOMAINS $EXIST_DOMAINS; do
  if [[ ! " ${VALID_DOMAINS[@]} " =~ " ${domain} " ]]; then
    echo "  ❌ FAIL: Invalid domain: $domain"
    ALL_VALID=false
  fi
done

if [ "$ALL_VALID" = true ]; then
  echo "  ✅ PASS: All images from valid Amazon CDN domains"
else
  exit 1
fi

# Summary
echo -e "\n================================"
echo "✅ ALL TESTS PASSED"
echo "================================"
echo "Summary:"
echo "  • Golden ASIN: $GOLD_COUNT images ✅"
echo "  • Existing ASIN: $EXIST_COUNT images ✅"
echo "  • Overlap: $OVERLAP images ✅"
echo "  • Sources: Amazon CDN only ✅"
echo ""
echo "Images are clean and isolated by product!"
echo "================================"

exit 0
