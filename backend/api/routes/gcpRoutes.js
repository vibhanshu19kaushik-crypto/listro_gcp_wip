const express = require('express');
const router = express.Router();
const gcpService = require('../services/gcpService');

router.get('/sellers', async (req, res) => {
  try {
    const data = await gcpService.getSellers();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sellers/:sellerId/listings', async (req, res) => {
  try {
    const data = await gcpService.getSellerListings(req.params.sellerId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sellers/:sellerId/resource-allocation', async (req, res) => {
  try {
    const data = await gcpService.getResourceAllocation(req.params.sellerId, req.query.storeName);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sellers/search/:searchTerm', async (req, res) => {
  try {
    const data = await gcpService.searchSellers(req.params.searchTerm);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
