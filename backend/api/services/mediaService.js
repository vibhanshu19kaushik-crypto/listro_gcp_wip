/**
 * mediaService.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js
 * Handles image uploads to GCS and URL conversions.
 */
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const config = require('../config');

const GCS_BUCKET_NAME = "listro-image-store";
let gcsClient = null;

try {
  gcsClient = new Storage();
  console.log('✅ Google Cloud Storage client initialized (ADC) for mediaService.');
} catch (error) {
  console.error(`❌ GCS client initialization error: ${error.message}`);
}

/**
 * Upload image bytes to GCS and return signed URL
 */
async function uploadImageToGCS(imageBytes, gcsFolderPath, filename) {
  if (!gcsClient) throw new Error('GCS client not initialized');

  try {
    const bucket = gcsClient.bucket(GCS_BUCKET_NAME);
    const blobPath = `${gcsFolderPath}/${filename}`;
    const blob = bucket.file(blobPath);

    console.log(`📤 Uploading image to GCS: gs://${GCS_BUCKET_NAME}/${blobPath}`);

    await blob.save(imageBytes, {
      metadata: { contentType: 'image/jpeg' }
    });

    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const signedUrl = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: sevenDaysFromNow
    });

    return signedUrl[0];
  } catch (error) {
    console.error(`❌ GCS upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Convert GCS path to signed URL
 */
async function convertGCSPathToSignedUrl(gcsPath) {
  if (!gcsClient) throw new Error('GCS client not initialized');

  try {
    const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`Invalid GCS path format: ${gcsPath}`);

    const bucketName = match[1];
    const filePath = match[2];
    const blob = gcsClient.bucket(bucketName).file(filePath);

    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const signedUrl = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: sevenDaysFromNow
    });

    return signedUrl[0];
  } catch (error) {
    console.error(`❌ GCS path conversion failed: ${error.message}`);
    return gcsPath;
  }
}

/**
 * Convert Google Drive share URL to direct download URL
 */
function convertGoogleDriveUrl(driveUrl) {
  const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/uc?id=${fileIdMatch[1]}&export=download`;
  }
  return null;
}

/**
 * Download from URL and upload to GCS
 */
async function downloadAndUploadImageToGCS(imageUrl, gcsFolderPath, filename) {
  try {
    console.log(`🔗 Processing source image: ${imageUrl.substring(0, 80)}...`);
    
    let downloadUrl = imageUrl;
    if (imageUrl.includes('drive.google.com')) {
      const convertedUrl = convertGoogleDriveUrl(imageUrl);
      if (convertedUrl) downloadUrl = convertedUrl;
    }
    
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

    return await uploadImageToGCS(Buffer.from(response.data), gcsFolderPath, filename);
  } catch (error) {
    console.error(`❌ Media download/upload flow failed: ${error.message}`);
    return null;
  }
}

module.exports = {
  uploadImageToGCS,
  convertGCSPathToSignedUrl,
  downloadAndUploadImageToGCS
};
