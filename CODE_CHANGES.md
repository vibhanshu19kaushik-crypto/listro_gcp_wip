# Code Changes Summary - GCS Image Migration

## Files Modified

### 1. `/backend/server.js`

#### Change 1: Added GCS Storage Import
**Location:** Line 14
**Before:**
```javascript
const { Mutex } = require('async-mutex');
const claimMutex = new Mutex();
```

**After:**
```javascript
const { Mutex } = require('async-mutex');
const { Storage } = require('@google-cloud/storage');
const claimMutex = new Mutex();
```

---

#### Change 2: Added GCS Client Initialization and Upload Functions
**Location:** After line 200 (after getGoldenSheetData function)
**New Code Added:**

```javascript
// ==================================================
// 🚀 GOOGLE CLOUD STORAGE CONFIG (For scraped images)
// ==================================================

const GCS_BUCKET_NAME = "listro-image-store";
let gcsClient = null;

try {
  // ✅ Uses ADC (local: GOOGLE_APPLICATION_CREDENTIALS; Cloud Run: SA identity)
  gcsClient = new Storage();
  console.log('✅ Google Cloud Storage client initialized (ADC) for server.js.');
} catch (error) {
  console.error(`❌ GCS client initialization error: ${error.message}`);
  gcsClient = null;
}

/**
 * Upload image bytes to GCS and return signed URL
 * @param {Buffer} imageBytes - Image data as bytes
 * @param {string} gcsFolderPath - GCS folder path (e.g., "golden_scraped/asin123")
 * @param {string} filename - Filename for the image (e.g., "img_0.jpg")
 * @returns {Promise<string>} Public/signed URL of the uploaded image
 */
async function uploadImageToGCS(imageBytes, gcsFolderPath, filename) {
  if (!gcsClient) {
    throw new Error('GCS client not initialized');
  }

  try {
    const bucket = gcsClient.bucket(GCS_BUCKET_NAME);
    const blobPath = `${gcsFolderPath}/${filename}`;
    const blob = bucket.file(blobPath);

    console.log(`📤 Uploading image to GCS: gs://${GCS_BUCKET_NAME}/${blobPath}`);

    await blob.save(imageBytes, {
      metadata: {
        contentType: 'image/jpeg'
      }
    });

    // Generate signed URL (valid for 7 days)
    const signedUrl = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const url = signedUrl[0];
    console.log(`✅ Image uploaded successfully: ${url.substring(0, 80)}...`);
    return url;
  } catch (error) {
    console.error(`❌ GCS upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Download image from URL and upload to GCS, returning GCS URL
 * @param {string} imageUrl - Source image URL
 * @param {string} gcsFolderPath - GCS folder path
 * @param {string} filename - Filename for the image
 * @returns {Promise<string|null>} GCS signed URL or null if failed
 */
async function downloadAndUploadImageToGCS(imageUrl, gcsFolderPath, filename) {
  try {
    console.log(`🔗 Downloading image from: ${imageUrl.substring(0, 80)}...`);
    
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const imageBytes = Buffer.from(response.data);
    const gcsUrl = await uploadImageToGCS(imageBytes, gcsFolderPath, filename);
    return gcsUrl;
  } catch (error) {
    console.error(`❌ Failed to download and upload image: ${error.message}`);
    return null;
  }
}
```

---

#### Change 3: Fixed Image Extraction in /api/scrape-product
**Location:** Line ~792
**Before:**
```javascript
    // Extract images with fallback - prefer amz_scraper, fallback to scraper.py
    const images = (amzData?.product?.images?.length > 0
      ? amzData.product.images
      : scraperData?.images || []);
```

**After:**
```javascript
    // Extract images with fallback - prefer amz_scraper, fallback to scraper.py
    // amz_scraper.py returns mainImages (GCS URLs from asin_scraped folder)
    const images = (amzData?.mainImages && amzData.mainImages.length > 0
      ? amzData.mainImages
      : (scraperData?.images || []));
```

---

## Files Already Correctly Implemented (No Changes Needed)

### 2. `/backend/amz_scraper.py`

**Status:** ✅ Already correctly implemented

The `upload_scraped_image_to_gcs()` function at lines 48-65 already:
- Takes image bytes and uploads to GCS
- Generates 7-day signed URLs
- Uses `asin_scraped` folder for storage
- Returns GCS URL (not local path)

The `download_images()` function at lines 191-219 already:
- Downloads each image from Amazon CDN
- Calls `upload_scraped_image_to_gcs()` for each
- Returns array of GCS URLs
- Stores in response as `mainImages`

---

### 3. `/backend/python-server-cloudrun.py`

**Status:** ✅ Already has GCS support

The `upload_to_gcs()` function already implements:
- Upload from local file to GCS
- Public URL generation
- Used for AI-generated images in `generated` folder

---

### 4. Frontend Files

**Status:** ✅ No changes required

Files already expect image arrays (URLs):
- `src/pages/ImageComparisonPage.jsx`
- `src/pages/ComparisonSetupPage.jsx`
- `src/pages/ProductComparatorPage.jsx`

Frontend code works with both local paths and GCS URLs - no modifications needed.

---

## Configuration Changes

### Environment Variables (No changes needed)
- `FRONTEND_ORIGIN` - Already supported
- `PORT` - Already supported
- Uses Application Default Credentials (ADC) for GCS auth

### IAM Permissions Required
- Service account needs `roles/storage.objectCreator` on `listro-image-store` bucket
- In Cloud Run: Automatically available through service account identity

---

## Testing the Changes

### Quick Verification
```bash
bash test-gcs-migration.sh
```

### Manual Testing
1. Start server.js:
```bash
cd backend
npm install @google-cloud/storage
node server.js
```

2. Test scraping endpoint:
```bash
curl -X POST http://localhost:8080/api/scrape-product \
  -H "Content-Type: application/json" \
  -d '{"url":"https://amazon.in/dp/B0C123456"}'
```

3. Check response for GCS URLs:
```json
{
  "success": true,
  "product": {
    "images": [
      "https://storage.googleapis.com/listro-image-store/asin_scraped/B0C123456/img_0.jpg?..."
    ]
  }
}
```

---

## Deployment Steps

1. **Update package.json**
   ```bash
   npm install @google-cloud/storage
   ```

2. **Update Cloud Run service account**
   - Ensure service account has `roles/storage.objectCreator` on bucket

3. **Deploy**
   ```bash
   gcloud run deploy listro-node-backend --source=backend/
   ```

4. **Verify**
   - Check logs for "GCS client initialized"
   - Test with real product URL
   - Monitor GCS bucket for uploaded files

---

## Rollback Instructions

If issues occur:

1. **Revert server.js to previous version:**
   - Remove GCS import
   - Remove gcsClient initialization
   - Revert image extraction to use `amzData?.product?.images`

2. **No changes needed to frontend or amz_scraper.py**
   - Frontend still works with URLs
   - amz_scraper.py can be left as-is

3. **Clear GCS uploads (optional):**
   ```bash
   gsutil -m rm -r gs://listro-image-store/asin_scraped/*
   ```

---

## Summary of Changes

| Component | Changes | Status |
|-----------|---------|--------|
| server.js | +GCS import, +GCS client, +upload functions, fixed image extraction | ✅ Done |
| amz_scraper.py | None required | ✅ Already correct |
| python-server-cloudrun.py | None required | ✅ Already has GCS support |
| Frontend | None required | ✅ Works with URLs |
| Documentation | Added GCS_IMAGE_MIGRATION.md, IMPLEMENTATION_NOTES.md | ✅ Done |
| Testing | Added test-gcs-migration.sh | ✅ Done |

All changes are **backward compatible** and **minimal disruption** to existing code.

