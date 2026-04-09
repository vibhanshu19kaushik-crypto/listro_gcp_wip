/**
 * allocationRoutes.js
 * 
 * Endpoints ported from listro_gcp_old/backend/server.js
 * Exposes Seller Allocation and KAM Claiming features.
 */
const express = require('express');
const router = express.Router();
const allocationService = require('../services/allocationService');

/**
 * Seller-Resource Allocation (Sheets)
 */
router.get('/sheets/allocations', async (req, res, next) => {
  try {
    const result = await allocationService.getLiveAllocations();
    res.json({ success: true, data: result, totalAllocations: result.length });
  } catch (err) { next(err); }
});

router.post('/sheets/allocateAll', async (req, res, next) => {
  try {
    const { toAllocate, toUnallocate } = req.body;
    const result = await allocationService.allocateAll(toAllocate, toUnallocate);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * KAM Claiming (Sheets)
 */
router.post('/claim-listings', async (req, res, next) => {
  try {
    const { sellerId, listings, userEmail, claimedAt } = req.body;
    const result = await allocationService.claimListings(sellerId, listings, userEmail, claimedAt);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/claimed-listings', async (req, res, next) => {
  try {
    const { userEmail } = req.query;
    const result = await allocationService.getClaimedListings(userEmail);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/unclaim-listing', async (req, res, next) => {
  try {
    const { listingId, userEmail } = req.body;
    const result = await allocationService.unclaimListing(listingId, userEmail);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/user-claimed-asins', async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await allocationService.getUserClaimedAsins(email);
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * BigQuery-based Allocations (GCP)
 */
router.get('/gcp/allocations', async (req, res, next) => {
  try {
    const result = await allocationService.getGCPAllocations();
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/gcp/allocateAll', async (req, res, next) => {
  try {
    const { toAllocate, toUnallocate } = req.body;
    const result = await allocationService.allocateAllGCP(toAllocate, toUnallocate);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
