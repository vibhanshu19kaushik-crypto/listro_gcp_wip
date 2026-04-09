/**
 * sheetService.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js
 * Handles fetching, caching, and URL discovery across multiple category sheets.
 */
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const config = require('../config');
const { sheetsClient, sheetsApi } = require('../utils/gcpClient');

// ==================================================
// 🚀 Google Sheets Configuration (from centralized config)
// ==================================================

const { csvUrls } = config.sheets;

// Caches
let sheetDataCache = null; let lastCacheTime = null;
let goldenSheetDataCache = null; let lastGoldenCacheTime = null;
let homeKitchenSheetDataCache = null; let lastHomeKitchenCacheTime = null;
let electronicsSheetDataCache = null; let lastElectronicsCacheTime = null;
let beautySheetDataCache = null; let lastBeautyCacheTime = null;
let healthPersonalCareSheetDataCache = null; let lastHealthPersonalCareCacheTime = null;
let grocerySheetDataCache = null; let lastGroceryCacheTime = null;

async function fetchAndParseCSV(url, cacheObj, lastTime, label) {
  if (cacheObj && lastTime && (Date.now() - lastTime) < 300000) {
    console.log(`📊 Using cached ${label} data`);
    return { data: cacheObj, isCached: true };
  }
  try {
    console.log(`📊 Fetching fresh data from ${label} CSV...`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const records = parse(response.data, {
      columns: true, skip_empty_lines: true, trim: true,
      relax_quotes: true, relax_column_count: true
    });
    console.log(`✅ Successfully parsed ${records.length} rows from ${label}`);
    const newCache = { success: true, data: records, headers: Object.keys(records[0] || {}) };
    return { data: newCache, isCached: false };
  } catch (error) {
    console.error(`❌ Error fetching from ${label} CSV:`, error.message);
    throw error;
  }
}

async function getRealSheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.main, sheetDataCache, lastCacheTime, 'Main Sheet');
    if (!isCached) { sheetDataCache = data; lastCacheTime = Date.now(); }
    return data;
  } catch (err) {
    return {
      success: true,
      data: [{ '': 'Clothing', Gender: 'Women', 'Age Group': 'Adults', Subcategory: 'Kurtas', URL: 'https://www.amazon.in/s?k=women+kurtas' }],
      headers: ['', 'Gender', 'Age Group', 'Subcategory', 'URL'],
      fromCache: true
    };
  }
}

async function getGoldenSheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.golden, goldenSheetDataCache, lastGoldenCacheTime, 'Golden Sheet');
    if (!isCached) { goldenSheetDataCache = data; lastGoldenCacheTime = Date.now(); }
    return data;
  } catch (err) { return { success: true, data: [], headers: [], fromCache: false }; }
}

async function getHomeKitchenSheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.homeKitchen, homeKitchenSheetDataCache, lastHomeKitchenCacheTime, 'Home & Kitchen Sheet');
    if (!isCached) { homeKitchenSheetDataCache = data; lastHomeKitchenCacheTime = Date.now(); }
    return data;
  } catch (err) { return { success: true, data: [], headers: [], fromCache: false }; }
}

async function getElectronicsSheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.electronics, electronicsSheetDataCache, lastElectronicsCacheTime, 'Electronics Sheet');
    if (!isCached) { electronicsSheetDataCache = data; lastElectronicsCacheTime = Date.now(); }
    return data;
  } catch (err) { return { success: true, data: [], headers: [], fromCache: false }; }
}

async function getBeautySheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.beauty, beautySheetDataCache, lastBeautyCacheTime, 'Beauty Sheet');
    if (!isCached) { beautySheetDataCache = data; lastBeautyCacheTime = Date.now(); }
    return data;
  } catch (err) { return { success: true, data: [], headers: [], fromCache: false }; }
}

async function getHealthPersonalCareSheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.healthPersonalCare, healthPersonalCareSheetDataCache, lastHealthPersonalCareCacheTime, 'Health & Personal Care Sheet');
    if (!isCached) { healthPersonalCareSheetDataCache = data; lastHealthPersonalCareCacheTime = Date.now(); }
    return data;
  } catch (err) { return { success: true, data: [], headers: [], fromCache: false }; }
}

async function getGrocerySheetData() {
  try {
    const { data, isCached } = await fetchAndParseCSV(csvUrls.grocery, grocerySheetDataCache, lastGroceryCacheTime, 'Grocery & Gourmet Foods Sheet');
    if (!isCached) { grocerySheetDataCache = data; lastGroceryCacheTime = Date.now(); }
    return data;
  } catch (err) { return { success: true, data: [], headers: [], fromCache: false }; }
}

/**
 * Fetch unique emails from the master allocation/KAM sheet
 */
async function getEmailSheetData() {
  const EMAIL_SHEET_ID = '1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto';
  const EMAIL_SHEET_TAB = 'Data';
  const EMAIL_COLUMN_HEADER = 'Email';
  
  if (!sheetsClient || !sheetsApi) throw new Error('Sheets API not initialized');
  const authClient = await sheetsClient.getClient();

  const response = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: EMAIL_SHEET_ID,
    range: `${EMAIL_SHEET_TAB}!A:Z`,
  });

  const values = response.data.values;
  if (!values || values.length === 0) throw new Error('No data found in email sheet');

  const headers = values[0];
  const emailIndex = headers.findIndex(h => h.trim().toLowerCase() === EMAIL_COLUMN_HEADER.toLowerCase());
  if (emailIndex === -1) throw new Error(`Column "${EMAIL_COLUMN_HEADER}" not found`);

  const emails = [];
  const emailSet = new Set();
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row && row[emailIndex]) {
      const email = row[emailIndex].trim();
      if (email && !emailSet.has(email.toLowerCase())) {
        emailSet.add(email.toLowerCase());
        emails.push({
          email,
          fullName: row[emailIndex - 1] || '',
          rowIndex: i + 1
        });
      }
    }
  }
  return { success: true, emails, total: emails.length };
}

/**
 * Discovery: Find matching Category URL based on department parameters
 */
async function findUrl(query) {
  const { category, gender, ageGroup, subcategory, department } = query;
  let dataResult;
  let matchingRow;
  let source = 'Golden';

  const catStr = (category || "").toLowerCase();
  
  if (catStr.includes('home') && catStr.includes('kitchen')) {
    dataResult = await getHomeKitchenSheetData();
    source = 'Home & Kitchen';
  } else if (catStr.includes('electronics') || catStr.includes('computer') || catStr.includes('mobile')) {
    dataResult = await getElectronicsSheetData();
    source = 'Electronics';
  } else if (catStr.includes('health') || catStr.includes('personal care')) {
    dataResult = await getHealthPersonalCareSheetData();
    source = 'Health & Personal Care';
  } else if (catStr.includes('beauty')) {
    dataResult = await getBeautySheetData();
    source = 'Beauty';
  } else if (catStr.includes('grocery')) {
    dataResult = await getGrocerySheetData();
    source = 'Grocery';
  } else {
    dataResult = await getGoldenSheetData();
    source = 'Golden';
  }

  const data = dataResult.data || [];
  matchingRow = data.find(row => {
    const rowCat = row[''] || row.Category || row.category;
    const rowGender = row.Gender || row.gender;
    const rowAge = row['Age Group'] || row.AgeGroup || row.agegroup;
    const rowSub = row.Subcategory || row['Sub Category'] || row.subcategory;
    const rowDept = row.Department || row.department;

    if (source === 'Golden') {
       return String(rowCat).trim() === category &&
              String(rowGender).trim() === gender &&
              String(rowAge).trim() === ageGroup &&
              String(rowSub).trim() === subcategory;
    } else {
       return String(rowCat).trim() === category &&
              String(rowDept).trim() === department &&
              String(rowSub).trim() === subcategory;
    }
  });

  const url = matchingRow ? (matchingRow.URL || matchingRow.Url || matchingRow.url) : null;
  return { success: true, url, found: !!url, source };
}

/**
 * Discovery: Get unique subcategories for a category/gender/age combo
 */
async function getFilteredSubcategories(query) {
    const { category, gender, ageGroup } = query;
    const sheetResult = await getRealSheetData();
    const data = sheetResult.data || [];

    const seen = new Set();
    data.forEach(row => {
        const rowCat = row[''] || row.Category;
        const rowGender = row.Gender;
        const rowAge = row['Age Group'];
        const rowSub = row.Subcategory || row['Sub Category'];

        if (String(rowCat).trim() === category &&
            String(rowGender).trim() === gender &&
            String(rowAge).trim() === ageGroup &&
            rowSub) {
            seen.add(String(rowSub).trim());
        }
    });

    return { success: true, subcategories: Array.from(seen).sort() };
}

module.exports = {
  getRealSheetData,
  getGoldenSheetData,
  getHomeKitchenSheetData,
  getElectronicsSheetData,
  getBeautySheetData,
  getHealthPersonalCareSheetData,
  getGrocerySheetData,
  getEmailSheetData,
  findUrl,
  getFilteredSubcategories
};
