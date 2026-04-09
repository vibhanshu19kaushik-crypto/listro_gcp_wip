/**
 * homeKitchenRoutes.js
 * 
 * Endpoints ported from listro_gcp_old/backend/server.js
 * Exposes Home & Kitchen export features.
 */
const express = require('express');
const router = express.Router();
const homeKitchenService = require('../services/homeKitchenService');
const { APIError } = require('../middleware/errorHandler');

/**
 * Home & Kitchen Export (Sheets + BQ)
 */
router.post('/append-to-hk-sheet', async (req, res, next) => {
  try {
    const { sheetId, productData } = req.body;
    if (!sheetId || !productData) throw new APIError('sheetId and productData are required', 400);
    const { tabName = 'Data', imageLinks = [] } = req.body;
    const result = await homeKitchenService.appendToHomeKitchen(sheetId, tabName, productData, imageLinks);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/initialize-hk-schema', async (req, res, next) => {
  try {
    const { sheetId, tabName = 'Data' } = req.body;
    if (!sheetId) throw new APIError('sheetId is required', 400);
    const sheetResult = await homeKitchenService.ensureSheetHeaders(sheetId, tabName);
    const bqResult = await homeKitchenService.ensureBigQueryColumns();
    res.json({ success: true, sheetHeaders: sheetResult, bigQueryColumns: bqResult });
  } catch (err) { next(err); }
});


module.exports = router;
