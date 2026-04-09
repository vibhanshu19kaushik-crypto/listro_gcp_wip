/**
 * scrapingRoutes.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js
 * Exposes endpoints for product scraping and ASIN metadata retrieval.
 */
const express = require('express');
const router = express.Router();
const scrapingService = require('../services/scrapingService');

// Dual Scraper Integration
router.post('/scrape-product', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

    const result = await scrapingService.scrapeProduct(url);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Metadata from ASIN
router.post('/scrape-metadata-from-asin', async (req, res) => {
  try {
    const { asin } = req.body;
    if (!asin) return res.status(400).json({ success: false, error: 'ASIN is required' });

    const result = await scrapingService.scrapeMetadataFromAsin(asin);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
