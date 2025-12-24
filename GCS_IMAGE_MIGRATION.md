# GCS Image Migration - Implementation Summary

## Overview
This document outlines the changes made to migrate scraped images from local filesystem storage to Google Cloud Storage (GCS). Both Gold Standard and Main Product scraped images now upload to GCS and return signed URLs to the frontend.

## Architecture Changes

### Current Flow (Before)
```
Gold Standard Scraping:
  Frontend → server.js (/api/scrape-product) 
    → amz_scraper.py → Download & Save Locally 
    → Return Local File Paths
    → Frontend displays images from local paths

Main Product Scraping (in python-server-cloudrun.py):
  Frontend → python-server-cloudrun.py (/api/scrape-product)
    → Download & Save Locally
    → Return Local File Paths
```

### New Flow (After)
```
Gold Standard Scraping:
  Frontend → server.js (/api/scrape-product)
    → amz_scraper.py 
      → Download Images from Amazon
      → Upload to GCS: gs://listro-image-store/asin_scraped/{asin}/img_*.jpg
      → Return GCS Signed URLs (valid 7 days)
    → server.js maps amzData.mainImages → response.product.images
    → Frontend receives GCS URLs (no local files)

Main Product Scraping (in python-server-cloudrun.py):
  Frontend → python-server-cloudrun.py (/api/scrape-product)
    → amz_scraper.py (via subprocess call)
      → Same as above
    → server.js formats response with GCS URLs
```

## Files Modified

### 1. `/backend/server.js`
**Changes:**
- Added `@google-cloud/storage` import
- Added GCS client initialization with ADC authentication
- Added `uploadImageToGCS()` function to upload image bytes to GCS with signed URLs
- Added `downloadAndUploadImageToGCS()` function to download from URL and upload to GCS
- Fixed image extraction in `/api/scrape-product` endpoint:
  - Changed from `amzData?.product?.images` to `amzData?.mainImages`
  - Properly maps GCS URLs from amz_scraper.py response
  
**Key Functions Added:**
```javascript
async function uploadImageToGCS(imageBytes, gcsFolderPath, filename)
async function downloadAndUploadImageToGCS(imageUrl, gcsFolderPath, filename)
```

**GCS Configuration:**
- Bucket: `listro-image-store`
- Gold Standard images folder: `golden_scraped/{asin}/`
- Main Product images folder: `asin_scraped/{asin}/` (handled by amz_scraper.py)
- Signed URL expiry: 7 days

### 2. `/backend/amz_scraper.py`
**Status:** Already implemented correctly
- `upload_scraped_image_to_gcs()` function already uploads images directly to GCS
- Returns images as GCS URLs instead of local paths
- Uploads to: `gs://listro-image-store/asin_scraped/{asin}/img_*.jpg`
- No changes needed - working as intended

**Key Function:**
```python
def upload_scraped_image_to_gcs(image_bytes, gcs_folder, asin, filename)
```

### 3. `/backend/python-server-cloudrun.py`
**Status:** Already has GCS support
- `upload_to_gcs()` function implemented for AI-generated images
- Can be reused or extended for scraped images if needed

## Frontend Integration

### No Changes Required
The frontend already expects images as URLs:
- `ImageComparisonPage.jsx` - receives `goldStandardProduct.images` array of URLs
- `ImageComparisonPage.jsx` - receives `existingProduct.images` array of URLs
- `ComparisonSetupPage.jsx` - stores `goldStandard.images` from scraped response

### URL Format
All images are now returned as:
```
https://storage.googleapis.com/listro-image-store/...?X-Goog-Algorithm=...&X-Goog-Credential=...&X-Goog-Date=...&X-Goog-Expires=604800&X-Goog-SignedHeaders=host&X-Goog-Signature=...
```

Signed URLs are valid for 7 days and don't require public access permissions.

## Data Flow Example

### Gold Standard Product Scraping
```
1. User selects filters and clicks "Load URL"
2. Frontend calls POST /api/scrape-product with Amazon URL
3. server.js spawns amz_scraper.py process
4. amz_scraper.py:
   - Extracts 7 product images from Amazon page
   - For each image:
     a. Downloads image bytes from Amazon CDN
     b. Uploads to GCS at gs://listro-image-store/asin_scraped/{ASIN}/img_0.jpg
     c. Generates 7-day signed URL
   - Returns JSON: { success: true, mainImages: [url1, url2, ...] }
5. server.js:
   - Extracts amzData.mainImages
   - Maps to response.product.images
   - Sends to frontend
6. Frontend:
   - Stores goldStandardProduct.images = [url1, url2, ...]
   - Displays images directly from GCS URLs
```

## Benefits

1. **No Local Storage** - Eliminates local filesystem disk writes
2. **Scalability** - GCS can handle unlimited image storage
3. **Signed URLs** - Secure access without public ACLs
4. **Consistency** - Both Gold Standard and AI-generated images use same storage
5. **Reliability** - GCS is highly available and replicated
6. **Cost Effective** - Pay only for storage used
7. **Long-term Access** - Signed URLs valid for 7 days (sufficient for workflow)

## Testing Checklist

- [ ] Gold Standard product scraping returns GCS URLs
- [ ] Main Product scraping returns GCS URLs (when using amz_scraper.py)
- [ ] Images display correctly in ImageComparisonPage.jsx
- [ ] No empty arrays appear in UI when scraping fails
- [ ] GCS signed URLs are accessible and images load
- [ ] No local files created in `/tmp_scraped/` or similar
- [ ] Response times are acceptable (GCS upload ~1-2 seconds per image)

## Troubleshooting

### Images Not Appearing
1. Check GCS bucket permissions:
   - Service account must have `roles/storage.objectCreator`
   - Bucket must allow authenticated access
2. Check signed URL expiry:
   - URLs expire after 7 days
   - Rescrape if needed

### Slow Uploads
- Check network bandwidth
- Ensure server.js and GCS have direct connectivity
- Consider compression for very large images

### GCS Client Not Initialized
- Check ADC (Application Default Credentials) setup
- In Cloud Run: Service account should have storage permissions
- In local dev: Set GOOGLE_APPLICATION_CREDENTIALS environment variable

## Rollback Plan

If needed to revert to local storage:
1. In server.js: Stop calling amz_scraper.py, use scraper.py instead
2. Modify amz_scraper.py: Save images locally instead of uploading to GCS
3. Frontend remains unchanged (expects URL arrays)

## Future Enhancements

1. **Image Caching** - Cache GCS URLs in Redis for frequently requested ASINs
2. **Batch Upload** - Upload multiple images in parallel for faster processing
3. **Image Optimization** - Compress/resize images before uploading
4. **Expiry Management** - Track URL expiry and regenerate if needed
5. **Multi-region** - Replicate to multiple GCS buckets for redundancy

## Deployment Notes

### Cloud Run
- Service account must have `roles/storage.objectCreator` on `listro-image-store` bucket
- ADC credentials automatically available in Cloud Run environment
- No additional environment variables needed

### Local Development
Set environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

## Code References

### server.js Changes
- Lines: GCS imports and initialization (line ~17)
- Lines: GCS upload functions (added after line ~200)
- Lines: Image extraction fix in /api/scrape-product endpoint

### amz_scraper.py
- Lines 40-65: upload_scraped_image_to_gcs() function
- Lines 191-219: download_images() function
- Lines 282-285: mainImages returned in result

