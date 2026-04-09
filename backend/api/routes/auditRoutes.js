/**
 * auditRoutes.js
 * 
 * Endpoints ported from listro_gcp_old/backend/server.js
 * Exposes Time Tracking and BigQuery Export features.
 */
const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { APIError } = require('../middleware/errorHandler');

/**
 * Audit & Time Tracking (Sheets)
 */
router.post('/update-start-time', async (req, res, next) => {
  try {
    const { asin, email } = req.body;
    if (!asin || !email) throw new APIError('ASIN and email are required', 400);
    const result = await auditService.updateStartTime(asin, email);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/update-end-time', async (req, res, next) => {
  try {
    const { asin, email } = req.body;
    if (!asin || !email) throw new APIError('ASIN and email are required', 400);
    const result = await auditService.updateEndTime(asin, email);
    res.json(result);
  } catch (err) { next(err); }
});


/**
 * BigQuery Exports (GCP)
 */
router.post('/gcp/insert-to-bq', async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) throw new APIError('rows array is required', 400);
    const result = await auditService.insertToBQ(rows);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/gcp/combined-export', async (req, res, next) => {
  try {
    const { items, userEmail } = req.body;
    if (!items || !Array.isArray(items) || !userEmail) {
        throw new APIError('items array and userEmail are required', 400);
    }
    const result = await auditService.combinedExport(req.body);
    res.json(result);
  } catch (err) { next(err); }
});


module.exports = router;
