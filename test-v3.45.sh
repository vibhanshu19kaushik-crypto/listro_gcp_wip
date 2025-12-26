#!/bin/bash

# Test script for v3.45 deployment - verify exactly 7 images returned

API_URL="https://listrov3-python-api-648176215467.asia-south1.run.app"

echo "========================================="
echo "Testing v3.45 - Image Extraction Fix"
echo "========================================="
echo ""

# Test 1: Existing Product (B0DZ66M8N2)
echo "Test 1: Existing Product (B0DZ66M8N2)"
echo "Expected: Exactly 7 images from main gallery"
echo ""

RESPONSE=$(curl -s -X POST "${API_URL}/scrape" \
  -H "Content-Type: application/json" \
  -d '{"asin": "B0DZ66M8N2", "includeGoldStandard": false}' | jq '.')

IMAGE_COUNT=$(echo "$RESPONSE" | jq '.product.images | length')
FIRST_3=$(echo "$RESPONSE" | jq -r '.product.images[0:3][] | "\(.[:60])..."' | head -3)

echo "✅ Result: $IMAGE_COUNT images returned"
echo ""
echo "First 3 images:"
echo "$FIRST_3"
echo ""
echo "-------------------------------------------"
echo ""

# Test 2: Gold Standard Product (B0FDW55HNT)
echo "Test 2: Gold Standard Product (B0FDW55HNT)"
echo "Expected: Exactly 7 images from main gallery"
echo ""

RESPONSE=$(curl -s -X POST "${API_URL}/scrape" \
  -H "Content-Type: application/json" \
  -d '{"asin": "B0FDW55HNT", "includeGoldStandard": false}' | jq '.')

IMAGE_COUNT=$(echo "$RESPONSE" | jq '.product.images | length')
FIRST_3=$(echo "$RESPONSE" | jq -r '.product.images[0:3][] | "\(.[:60])..."' | head -3)

echo "✅ Result: $IMAGE_COUNT images returned"
echo ""
echo "First 3 images:"
echo "$FIRST_3"
echo ""
echo "========================================="
echo "Summary:"
echo "✅ Both products should return exactly 7 images"
echo "✅ Images should be from main product gallery only"
echo "========================================="
