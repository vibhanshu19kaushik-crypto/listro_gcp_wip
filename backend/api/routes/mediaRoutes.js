/**
 * mediaRoutes.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js
 * Exposes endpoints for image uploads and link processing.
 */
const express = require('express');
const router = express.Router();
const mediaService = require('../services/mediaService');
const multer = require('multer');

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload image from local file
router.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image provided' });
    
    const { folderPath, filename } = req.body;
    if (!folderPath || !filename) return res.status(400).json({ success: false, error: 'Missing folderPath or filename' });

    const url = await mediaService.uploadImageToGCS(req.file.buffer, folderPath, filename);
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload image from link
router.post('/upload-from-link', async (req, res) => {
  try {
    const { imageUrl, folderPath, filename } = req.body;
    if (!imageUrl || !folderPath || !filename) return res.status(400).json({ success: false, error: 'Missing parameters' });

    const url = await mediaService.downloadAndUploadImageToGCS(imageUrl, folderPath, filename);
    if (!url) throw new Error('Failed to process image from link');
    
    res.json({ success: true, url });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
