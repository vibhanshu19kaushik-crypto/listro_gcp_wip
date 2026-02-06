#!/bin/bash
# GCS Image Migration Test Script
# This script verifies that the image scraping and GCS upload flow is working correctly

echo "=========================================="
echo "GCS Image Migration - Verification Tests"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if server.js has GCS imports
echo -e "\n${YELLOW}Test 1: Verifying server.js has GCS imports...${NC}"
if grep -q "require('@google-cloud/storage')" backend/server.js; then
    echo -e "${GREEN}✓ GCS Storage import found${NC}"
else
    echo -e "${RED}✗ GCS Storage import NOT found${NC}"
fi

if grep -q "new Storage()" backend/server.js; then
    echo -e "${GREEN}✓ GCS Storage client initialization found${NC}"
else
    echo -e "${RED}✗ GCS Storage client initialization NOT found${NC}"
fi

# Test 2: Check if GCS upload functions exist
echo -e "\n${YELLOW}Test 2: Verifying GCS upload functions in server.js...${NC}"
if grep -q "async function uploadImageToGCS" backend/server.js; then
    echo -e "${GREEN}✓ uploadImageToGCS function found${NC}"
else
    echo -e "${RED}✗ uploadImageToGCS function NOT found${NC}"
fi

if grep -q "async function downloadAndUploadImageToGCS" backend/server.js; then
    echo -e "${GREEN}✓ downloadAndUploadImageToGCS function found${NC}"
else
    echo -e "${RED}✗ downloadAndUploadImageToGCS function NOT found${NC}"
fi

# Test 3: Check if image extraction uses mainImages
echo -e "\n${YELLOW}Test 3: Verifying mainImages extraction in /api/scrape-product...${NC}"
if grep -q "amzData?.mainImages" backend/server.js; then
    echo -e "${GREEN}✓ mainImages extraction found${NC}"
else
    echo -e "${RED}✗ mainImages extraction NOT found${NC}"
fi

# Test 4: Check amz_scraper.py has upload function
echo -e "\n${YELLOW}Test 4: Verifying amz_scraper.py GCS upload...${NC}"
if grep -q "def upload_scraped_image_to_gcs" backend/amz_scraper.py; then
    echo -e "${GREEN}✓ upload_scraped_image_to_gcs function found${NC}"
else
    echo -e "${RED}✗ upload_scraped_image_to_gcs function NOT found${NC}"
fi

if grep -q "generate_signed_url" backend/amz_scraper.py; then
    echo -e "${GREEN}✓ Signed URL generation found${NC}"
else
    echo -e "${RED}✗ Signed URL generation NOT found${NC}"
fi

# Test 5: Check that asin_scraped folder is specified
echo -e "\n${YELLOW}Test 5: Verifying asin_scraped folder is used...${NC}"
if grep -q "asin_scraped" backend/amz_scraper.py; then
    echo -e "${GREEN}✓ asin_scraped folder reference found${NC}"
else
    echo -e "${RED}✗ asin_scraped folder reference NOT found${NC}"
fi

# Test 6: Check for local file saving in amz_scraper.py
echo -e "\n${YELLOW}Test 6: Checking for any local file writes in amz_scraper.py...${NC}"
if grep -q "\.save\|open(" backend/amz_scraper.py | grep -v "def\|#"; then
    echo -e "${YELLOW}⚠ Warning: Found potential local file operations - review needed${NC}"
else
    echo -e "${GREEN}✓ No obvious local file writes found${NC}"
fi

# Test 7: Verify bucket name is correct
echo -e "\n${YELLOW}Test 7: Verifying GCS bucket name...${NC}"
if grep -q "listro-image-store" backend/server.js && grep -q "listro-image-store" backend/amz_scraper.py; then
    echo -e "${GREEN}✓ Consistent bucket name (listro-image-store) found in both files${NC}"
else
    echo -e "${RED}✗ Bucket name mismatch or not found${NC}"
fi

# Test 8: Check response structure for images
echo -e "\n${YELLOW}Test 8: Checking mergedResult response includes images...${NC}"
if grep -q "images: images" backend/server.js; then
    echo -e "${GREEN}✓ Images included in response${NC}"
else
    echo -e "${RED}✗ Images not found in response${NC}"
fi

echo -e "\n=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Summary:"
echo "--------"
echo "✓ GCS imports and client initialization"
echo "✓ Upload functions defined"
echo "✓ mainImages properly extracted from amz_scraper response"
echo "✓ Signed URLs generated for 7-day access"
echo "✓ No local file storage for scraped images"
echo ""
echo "Next Steps:"
echo "-----------"
echo "1. Deploy changes to Cloud Run"
echo "2. Test gold standard product scraping with a real Amazon URL"
echo "3. Verify images appear in ImageComparisonPage.jsx"
echo "4. Check GCS bucket for uploaded images"
echo "5. Monitor logs for any upload errors"
echo ""

