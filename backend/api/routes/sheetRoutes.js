const express = require('express');
const router = express.Router();
const sheetService = require('../services/sheetService');

router.get('/sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getRealSheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/golden-sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getGoldenSheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/home-kitchen-sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getHomeKitchenSheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/electronics-sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getElectronicsSheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/beauty-sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getBeautySheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/health-personal-care-sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getHealthPersonalCareSheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/grocery-sheet-data', async (req, res) => {
  try {
    const data = await sheetService.getGrocerySheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/sheet-emails', async (req, res) => {
  try {
    const data = await sheetService.getEmailSheetData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/find-url', async (req, res) => {
  try {
    const data = await sheetService.findUrl(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/filtered-subcategories', async (req, res) => {
  try {
    const data = await sheetService.getFilteredSubcategories(req.query);
    res.json(data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug-sheet', async (req, res) => {
    try {
        const sheetResult = await sheetService.getRealSheetData();
        const allData = (sheetResult.data || []).map(row => ({
            firstColumn: row[''],
            gender: row.Gender,
            ageGroup: row['Age Group'],
            subcategory: row.Subcategory,
            url: row.URL,
            raw: row
        }));
        
        const uniqueValues = {
            categories: [...new Set(allData.map(row => row.firstColumn).filter(Boolean))],
            genders: [...new Set(allData.map(row => row.gender).filter(Boolean))],
            ageGroups: [...new Set(allData.map(row => row.ageGroup).filter(Boolean))],
            subcategories: [...new Set(allData.map(row => row.subcategory).filter(Boolean))]
        };

        res.json({
            success: true,
            totalRows: (sheetResult.data || []).length,
            uniqueValues,
            sampleData: allData.slice(0, 5),
            rawFirstRow: (sheetResult.data || [])[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to debug sheet: ' + error.message });
    }
});

module.exports = router;
