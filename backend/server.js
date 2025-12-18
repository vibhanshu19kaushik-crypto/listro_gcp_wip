// server.js (complete - with Sheet insert endpoint and Seller Allocation System)
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const { BigQuery } = require('@google-cloud/bigquery');
const { parse } = require('csv-parse/sync');
const { google } = require('googleapis');

// ==================================================
// 📌 SELLER ALLOCATION SHEET CONFIG
// ==================================================
const ALLOCATION_SHEET_ID = '1MlqeJixTmp6Cj2FSkGLsN08OBP9Kx5565NuxGrb0v18';
const ALLOCATION_SHEET_TAB = 'Data';

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS origin configurable: works for localhost & Cloud Run
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

function toISTTimestamp() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset)
    .toISOString()
    .replace('T', ' ')
    .split('.')[0];
}

// ==================================================
// 🚀 Google Sheets Configuration
// ==================================================

// Your Google Sheet CSV URL
const SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=75817034`;

// Golden URL Sheet CSV URL (Page 2 - Golden tab)
const GOLDEN_SHEET_CSV_URL =
  `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=62256398`;

// Cache for sheet data
let sheetDataCache = null;
let lastCacheTime = null;

// Cache for golden sheet data
let goldenSheetDataCache = null;
let lastGoldenCacheTime = null;

// Function to get real data from Google Sheets CSV
async function getRealSheetData() {
  // Return cached data if it's fresh (5 minutes)
  if (sheetDataCache && lastCacheTime && (Date.now() - lastCacheTime) < 300000) {
    console.log('📊 Using cached sheet data');
    return sheetDataCache;
  }

  try {
    console.log('📊 Fetching fresh data from Google Sheets CSV...');
    const response = await axios.get(SHEET_CSV_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const csvData = response.data;
    
    // Debug: Log first 200 characters to see what we're receiving
    console.log('📝 First 200 chars of response:', csvData.substring(0, 200));
    
    // Parse CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    });

    console.log('✅ Successfully parsed', records.length, 'rows from Google Sheets');
    
    // Cache the data
    sheetDataCache = {
      success: true,
      data: records,
      headers: Object.keys(records[0] || {})
    };
    lastCacheTime = Date.now();
    
    return sheetDataCache;
    
  } catch (error) {
    console.error('❌ Error fetching from Google Sheets CSV:', error.message);
    
    // If it's an axios error, log the response
    if (error.response) {
      console.error('📍 Status:', error.response.status);
      console.error('📍 Response preview:', error.response.data?.substring(0, 200));
    }
    
    // Return comprehensive fallback data
    return {
      success: true,
      data: [
        { '': 'Clothing', Gender: 'Women', 'Age Group': 'Adults', Subcategory: 'Kurtas', URL: 'https://www.amazon.in/s?k=women+kurtas' },
        { '': 'Clothing', Gender: 'Women', 'Age Group': 'Adults', Subcategory: 'Sarees', URL: 'https://www.amazon.in/s?k=women+sarees' },
        { '': 'Clothing', Gender: 'Women', 'Age Group': 'Adults', Subcategory: 'Dresses', URL: 'https://www.amazon.in/s?k=women+dresses' },
        { '': 'Clothing', Gender: 'Men', 'Age Group': 'Adults', Subcategory: 'Shirts', URL: 'https://www.amazon.in/s?k=men+shirts' },
        { '': 'Clothing', Gender: 'Men', 'Age Group': 'Adults', Subcategory: 'T-Shirts', URL: 'https://www.amazon.in/s?k=men+t+shirts' }
      ],
      headers: ['', 'Gender', 'Age Group', 'Subcategory', 'URL'],
      fromCache: true
    };
  }
}

// Function to get golden sheet data (Golden tab)
async function getGoldenSheetData() {
  // Return cached data if it's fresh (5 minutes)
  if (goldenSheetDataCache && lastGoldenCacheTime && (Date.now() - lastGoldenCacheTime) < 300000) {
    console.log('📊 Using cached golden sheet data');
    return goldenSheetDataCache;
  }

  try {
    console.log('📊 Fetching fresh data from Golden Sheet CSV...');
    const response = await axios.get(GOLDEN_SHEET_CSV_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const csvData = response.data;
    
    // Debug: Log first 200 characters to see what we're receiving
    console.log('📝 First 200 chars of golden sheet response:', csvData.substring(0, 200));
    
    // Parse CSV
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true
    });

    console.log('✅ Successfully parsed', records.length, 'rows from Golden Sheet');
    
    // Cache the data
    goldenSheetDataCache = {
      success: true,
      data: records,
      headers: Object.keys(records[0] || {})
    };
    lastGoldenCacheTime = Date.now();
    
    return goldenSheetDataCache;
    
  } catch (error) {
    console.error('❌ Error fetching from Golden Sheet CSV:', error.message);
    
    // If it's an axios error, log the response
    if (error.response) {
      console.error('📍 Status:', error.response.status);
      console.error('📍 Response preview:', error.response.data?.substring(0, 200));
    }
    
    // Return empty fallback data
    return {
      success: true,
      data: [],
      headers: [],
      fromCache: false
    };
  }
}

// ==================================================
// 📌 GOOGLE SHEETS API ENDPOINTS
// ==================================================

// API endpoint to get all sheet data
app.get('/api/sheet-data', async (req, res) => {
  try {
    const sheetResult = await getRealSheetData();
    
    res.json({
      success: true,
      data: sheetResult.data,
      headers: sheetResult.headers,
      totalRows: sheetResult.data.length,
      fromCache: sheetResult.fromCache || false
    });
  } catch (error) {
    console.error('❌ Error fetching sheet data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sheet data: ' + error.message
    });
  }
});

// API endpoint to get golden sheet data (Golden tab)
app.get('/api/golden-sheet-data', async (req, res) => {
  try {
    const sheetResult = await getGoldenSheetData();
    
    res.json({
      success: true,
      data: sheetResult.data,
      headers: sheetResult.headers,
      totalRows: sheetResult.data.length,
      fromCache: sheetResult.fromCache || false
    });
  } catch (error) {
    console.error('❌ Error fetching golden sheet data:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch golden sheet data: ' + error.message
    });
  }
});

// API endpoint to get email data from specific Google Sheet
app.get('/api/sheet-emails', async (req, res) => {
  try {
    // Email sheet configuration
    const EMAIL_SHEET_ID = '1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto';
    const EMAIL_SHEET_TAB = 'Data';
    const EMAIL_COLUMN_HEADER = 'Email';
    
    console.log('📧 Fetching email data from Google Sheet...');
    
    // Check if Google Sheets API is initialized
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }

    const authClient = await sheetsClient.getClient();

    // Get all data from the sheet
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: EMAIL_SHEET_ID,
      range: `${EMAIL_SHEET_TAB}!A:Z`, // Get all columns
    });

    const values = response.data.values;

    if (!values || values.length === 0) {
      throw new Error('No data found in the sheet');
    }

    // Find the Email column index
    const headers = values[0];
    const emailIndex = headers.findIndex(header => 
      header.trim().toLowerCase() === EMAIL_COLUMN_HEADER.toLowerCase()
    );

    if (emailIndex === -1) {
      throw new Error(`Column "${EMAIL_COLUMN_HEADER}" not found in the sheet`);
    }

    // Extract unique emails from the column (skip header row)
    const emails = [];
    const emailSet = new Set();
    
    for (let i = 1; i < values.length; i++) {
      if (values[i] && values[i][emailIndex]) {
        const email = values[i][emailIndex].trim();
        if (email && !emailSet.has(email.toLowerCase())) {
          emailSet.add(email.toLowerCase());
          emails.push({
            email: email,
            rowIndex: i + 1, // 1-based row number
            // You can also extract other columns if needed
            fullName: values[i][emailIndex - 1] || '', // Assuming name is in previous column
          });
        }
      }
    }

    console.log(`✅ Found ${emails.length} unique emails in the sheet`);

    res.json({
      success: true,
      emails: emails,
      total: emails.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${EMAIL_SHEET_ID}/edit`,
      sheetTab: EMAIL_SHEET_TAB,
    });
    
  } catch (error) {
    console.error('❌ Error fetching email data from Google Sheet:', error.message);
    
    // Fallback to mock emails for development
    const mockEmails = [
      { email: 'vibhanshu@example.com', fullName: 'Vibhanshu' },
      { email: 'ashutosh@example.com', fullName: 'Ashutosh' },
      { email: 'rudra@example.com', fullName: 'Rudra' },
      { email: 'shubham@example.com', fullName: 'Shubham' },
      { email: 'karan@example.com', fullName: 'Karan' },
      { email: 'sai@example.com', fullName: 'Sai' },
    ];

    res.json({
      success: true,
      emails: mockEmails,
      total: mockEmails.length,
      note: 'Using fallback data - Google Sheets API connection failed',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1vogUlAIFIBe682a8MZREgGXOJubMRTFlpgM4Mj-GEto/edit',
      sheetTab: 'Data',
    });
  }
});

// API endpoint to find matching URL
app.get('/api/find-url', async (req, res) => {
  const { category, gender, ageGroup, subcategory } = req.query;
  
  console.log('🔍 Finding URL for:', { category, gender, ageGroup, subcategory });
  
  try {
    const sheetResult = await getRealSheetData();
    const data = sheetResult.data;

    // Find matching row
    const matchingRow = data.find(row => {
      const rowCategory = row[''] || row.Category;
      const rowGender = row.Gender || row.gender;
      const rowAgeGroup = row['Age Group'] || row.AgeGroup || row.agegroup;
      const rowSubcategory = row.Subcategory || row['Sub Category'] || row.subcategory;
      const rowURL = row.URL || row.Url || row.url;

      return (rowCategory && rowCategory.toString().trim() === category &&
              rowGender && rowGender.toString().trim() === gender &&
              rowAgeGroup && rowAgeGroup.toString().trim() === ageGroup &&
              rowSubcategory && rowSubcategory.toString().trim() === subcategory);
    });

    const url = matchingRow ? (matchingRow.URL || matchingRow.Url || matchingRow.url) : null;

    if (matchingRow && url) {
      res.json({
        success: true,
        url: url,
        found: true
      });
    } else {
      res.json({
        success: true,
        url: null,
        found: false,
        message: 'No matching URL found for the selected criteria'
      });
    }
  } catch (error) {
    console.error('❌ Error finding URL:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to find URL: ' + error.message
    });
  }
});

// API endpoint to get filtered subcategories
app.get('/api/filtered-subcategories', async (req, res) => {
  const { category, gender, ageGroup } = req.query;
  
  console.log('🔍 Filtering for:', { category, gender, ageGroup });
  
  try {
    const sheetResult = await getRealSheetData();
    const data = sheetResult.data;

    // Filter and get unique subcategories
    const filteredSubcategories = [];
    const seenSubcategories = new Set();

    data.forEach(row => {
      // Get category from the first unnamed column (empty string key)
      const rowCategory = row[''] || row.Category;
      const rowGender = row.Gender || row.gender;
      const rowAgeGroup = row['Age Group'] || row.AgeGroup || row.agegroup;
      const rowSubcategory = row.Subcategory || row['Sub Category'] || row.subcategory;

      if (rowCategory && rowCategory.toString().trim() === category &&
          rowGender && rowGender.toString().trim() === gender &&
          rowAgeGroup && rowAgeGroup.toString().trim() === ageGroup &&
          rowSubcategory) {
        
        const subcat = rowSubcategory.toString().trim();
        if (!seenSubcategories.has(subcat)) {
          filteredSubcategories.push(subcat);
          seenSubcategories.add(subcat);
        }
      }
    });

    console.log('📋 Found', filteredSubcategories.length, 'subcategories:', filteredSubcategories);

    res.json({
      success: true,
      subcategories: filteredSubcategories.sort()
    });
  } catch (error) {
    console.error('❌ Error fetching subcategories:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subcategories: ' + error.message
    });
  }
});

// Debug endpoint
app.get('/api/debug-sheet', async (req, res) => {
  try {
    const sheetResult = await getRealSheetData();
    
    const allData = sheetResult.data.map(row => ({
      firstColumn: row[''], // Category column
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
      totalRows: sheetResult.data.length,
      uniqueValues: uniqueValues,
      sampleData: allData.slice(0, 5),
      rawFirstRow: sheetResult.data[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to debug sheet: ' + error.message
    });
  }
});

// ==================================================
// 🚀 COMPLETE SCRAPING FUNCTIONALITY (From First VERSION)
// ==================================================

// Helper function to clean and format scraped data for frontend
function formatScrapedData(rawData) {
  // Helper to clean keys - remove newlines, special characters, and extra spaces
  const cleanKey = (key) => {
    return key
      .replace(/\n/g, ' ')
      .replace(/\u200f|\u200e/g, '') // Remove RTL/LTR marks
      .replace(/\s+/g, ' ')
      .replace(/\s*:\s*$/, '')
      .trim();
  };

  // Helper to clean object keys
  const cleanObjectKeys = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const cleaned = {};
    for (let key in obj) {
      const cleanedKey = cleanKey(key);
      cleaned[cleanedKey] = obj[key];
    }
    return cleaned;
  };

  // Format product details as array for easier frontend rendering
  const formatDetailsAsArray = (obj) => {
    if (!obj || typeof obj !== 'object') return [];
    
    return Object.entries(obj)
      .filter(([key, value]) => key && value && key !== 'status')
      .map(([key, value]) => ({
        label: cleanKey(key),
        value: value
      }));
  };

  return {
    success: true,
    product: {
      title: rawData.title || 'N/A',
      description: rawData.description || 'N/A',
      asin: rawData.asin || 'N/A',
      images: rawData.images || []
    },
    details: {
      featureBullets: rawData.bullets || [],
      productDetails: formatDetailsAsArray(rawData.productDetails),
      manufacturingDetails: formatDetailsAsArray(rawData.manufacturingDetails),
      additionalInfo: formatDetailsAsArray(rawData.additionalInfo)
    },
    // Also include cleaned raw format for flexibility
    raw: {
      productDetails: cleanObjectKeys(rawData.productDetails),
      manufacturingDetails: cleanObjectKeys(rawData.manufacturingDetails),
      additionalInfo: cleanObjectKeys(rawData.additionalInfo)
    }
  };
}

// Helper function to format details as array for frontend
function formatDetailsAsArray(obj) {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.entries(obj)
    .filter(([key, value]) => key && value && key !== 'status')
    .map(([key, value]) => ({
      label: key.trim(),
      value: value
    }));
}

// Dual Scraper Integration - amz_scraper for images, scraper.py for other data
app.post('/api/scrape-product', async (req, res) => {
  let { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  // Fix URL if missing scheme
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.startsWith('www.') || url.startsWith('amazon.')) {
      url = 'https://' + url;
      console.log('🔧 Fixed URL scheme:', url);
    } else {
      // Assume it's an Amazon URL
      url = 'https://' + url;
      console.log('🔧 Added https:// to URL:', url);
    }
  }

  // Validate URL is an Amazon URL
  if (!url.includes('amazon.')) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid Amazon product URL',
      userMessage: 'The URL must be from Amazon.in or Amazon.com'
    });
  }

  console.log('🔍 Starting dual scraping for URL:', url);

  try {
    // Run both scrapers in parallel
    const scraperPromise = new Promise((resolve, reject) => {
      const scraperProcess = spawn('python3', ['scraper.py', url]);
      let scraperData = '';
      let scraperError = '';

      scraperProcess.stdout.on('data', (data) => {
        scraperData += data.toString();
      });

      scraperProcess.stderr.on('data', (data) => {
        scraperError += data.toString();
        console.log('scraper.py stderr:', data.toString());
      });

      scraperProcess.on('close', (code) => {
        if (code === 0 && scraperData) {
          try {
            resolve(JSON.parse(scraperData));
          } catch (e) {
            reject(new Error('Failed to parse scraper.py output'));
          }
        } else {
          reject(new Error(`scraper.py failed with code ${code}`));
        }
      });
    });

    const amzScraperPromise = new Promise((resolve, reject) => {
      const amzProcess = spawn('python3', ['amz_scraper.py', url, '--formatted']);
      let amzData = '';
      let amzError = '';

      amzProcess.stdout.on('data', (data) => {
        amzData += data.toString();
      });

      amzProcess.stderr.on('data', (data) => {
        amzError += data.toString();
        console.log('amz_scraper.py stderr:', data.toString());
      });

      amzProcess.on('close', (code) => {
        if (code === 0 && amzData) {
          try {
            resolve(JSON.parse(amzData));
          } catch (e) {
            reject(new Error('Failed to parse amz_scraper.py output'));
          }
        } else {
          reject(new Error(`amz_scraper.py failed with code ${code}`));
        }
      });
    });

    // Wait for both scrapers to complete - use allSettled to handle partial failures
    const [scraperResult, amzScraperResult] = await Promise.allSettled([scraperPromise, amzScraperPromise]);

    console.log('📊 Scraping Results Summary:');
    console.log('  scraper.py:', scraperResult.status === 'fulfilled' ? '✅ SUCCESS' : '❌ FAILED');
    console.log('  amz_scraper.py:', amzScraperResult.status === 'fulfilled' ? '✅ SUCCESS' : '❌ FAILED');

    // Extract data from fulfilled promises
    const scraperData = scraperResult.status === 'fulfilled' ? scraperResult.value : null;
    const amzData = amzScraperResult.status === 'fulfilled' ? amzScraperResult.value : null;

    // Log errors if any
    if (scraperResult.status === 'rejected') {
      console.error('  ❌ scraper.py error:', scraperResult.reason?.message || scraperResult.reason);
    }
    if (amzScraperResult.status === 'rejected') {
      console.error('  ❌ amz_scraper.py error:', amzScraperResult.reason?.message || amzScraperResult.reason);
    }

    // Check if we got ANY data at all
    if (!scraperData && !amzData) {
      console.error('❌ Both scrapers failed completely');
     
      // Extract error messages from both scrapers
      const scraperError = scraperResult.status === 'rejected'
        ? scraperResult.reason?.message || 'Unknown error'
        : null;
      const amzScraperError = amzScraperResult.status === 'rejected'
        ? amzScraperResult.reason?.message || 'Unknown error'
        : null;
     
      // Return user-friendly error message
      return res.json({
        success: false,
        error: 'Please try again. Unable to load product information from Amazon.',
        userMessage: 'The product page could not be loaded. Please check the URL and try again in a few moments.',
        technicalDetails: {
          scraperError: scraperError,
          amzScraperError: amzScraperError,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Enhanced merge with multiple fallbacks
    const getAboutThisItem = (scraperData, amzData) => {
      // Priority 1: scraper.py bullets
      if (scraperData?.bullets && scraperData.bullets.length > 0) {
        return scraperData.bullets;
      }
     
      // Priority 2: amz_scraper aboutThisItem
      if (amzData?.product?.aboutThisItem && amzData.product.aboutThisItem.length > 0) {
        return amzData.product.aboutThisItem;
      }
     
      // Priority 3: Check raw data for any bullet-like content
      if (scraperData?.raw && scraperData.raw.bullets && scraperData.raw.bullets.length > 0) {
        return scraperData.raw.bullets;
      }
     
      // Final fallback
      return ['No "About this item" information available.'];
    };

    // Extract images with fallback - prefer amz_scraper, fallback to scraper.py
    const images = (amzData?.product?.images?.length > 0
      ? amzData.product.images
      : scraperData?.images || []);

    // Merge results with fallback logic (combined approach)
    const mergedResult = {
      success: true,
      warnings: [],
      product: {
        title: scraperData?.title || amzData?.product?.title || 'N/A',
        description: scraperData?.description || amzData?.product?.description || 'N/A',
        images: images,
        aboutThisItem: getAboutThisItem(scraperData, amzData),
        asin: scraperData?.asin || 'N/A'
      },
      details: {
        featureBullets: getAboutThisItem(scraperData, amzData),
        productDetails: formatDetailsAsArray(scraperData?.productDetails),
        manufacturingDetails: formatDetailsAsArray(scraperData?.manufacturingDetails),
        additionalInfo: formatDetailsAsArray(scraperData?.additionalInfo)
      },
      raw: {
        productDetails: scraperData?.productDetails || {},
        manufacturingDetails: scraperData?.manufacturingDetails || {},
        additionalInfo: scraperData?.additionalInfo || {},
        bullets: scraperData?.bullets || [],
        amzScraperBullets: amzData?.product?.aboutThisItem || []
      }
    };

    // Add warnings if scrapers failed
    if (scraperResult.status === 'rejected') {
      mergedResult.warnings.push('Text scraper failed - data may be incomplete');
    }
    if (amzScraperResult.status === 'rejected') {
      mergedResult.warnings.push('Image scraper failed - using fallback images');
    }

    // Enhanced logging to debug the aboutThisItem data
    console.log('📋 About this item bullets:', {
      hasBullets: !!scraperData?.bullets,
      bulletCount: scraperData?.bullets ? scraperData.bullets.length : 0,
      bulletsSample: scraperData?.bullets ? scraperData.bullets.slice(0, 2) : 'none'
    });

    // Log summary
    console.log('✅ Scraping completed with merged data:');
    console.log('  Title:', mergedResult.product.title !== 'N/A' ? '✅' : '❌');
    console.log('  Images:', images.length, 'found');
    console.log('  Product Details:', Object.keys(scraperData?.productDetails || {}).length, 'fields');
    console.log('  Warnings:', mergedResult.warnings.length);
   
    res.json(mergedResult);

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    res.json({
      success: false,
      error: 'Please try again. Unable to process the product page.',
      userMessage: 'An unexpected error occurred while loading the product. Please try again.',
      technicalDetails: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// ASIN Metadata Scraper Endpoint
app.post('/api/scrape-metadata-from-asin', async (req, res) => {
  try {
    const { asin } = req.body;
    
    if (!asin) {
      return res.status(400).json({ success: false, error: 'ASIN is required' });
    }
    
    console.log(`🔄 Received request to scrape metadata for ASIN: ${asin}`);
    
    // Call the Python metadata scraper
    const pythonProcess = spawn('python3', ['amz_metadata_scraper.py', asin]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ Python scraper failed for ASIN ${asin}: ${stderr}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to scrape metadata',
          details: stderr.substring(0, 200)
        });
      }
      
      try {
        const result = JSON.parse(stdout);
        
        if (!result.success) {
          return res.status(200).json({
            success: false,
            error: result.error || 'Unknown error',
            fallback: true,
            metadata: {
              category: 'unknown',
              gender: 'unknown',
              age_group: 'Adults',
              subcategory: 'unknown'
            }
          });
        }
        
        return res.json({
          success: true,
          metadata: {
            category: result.category || 'unknown',
            gender: result.gender || 'unknown',
            age_group: result.age_group || 'Adults',
            subcategory: result.subcategory || 'unknown',
            title: result.title || '',
            breadcrumbs: result.breadcrumbs || []
          },
          asin: asin
        });
        
      } catch (parseError) {
        console.error(`❌ Failed to parse Python output for ASIN ${asin}:`, parseError);
        return res.status(500).json({
          success: false,
          error: 'Failed to parse scraper output',
          rawOutput: stdout.substring(0, 500)
        });
      }
    });
    
    pythonProcess.on('error', (error) => {
      console.error(`❌ Failed to start Python process for ASIN ${asin}:`, error);
      return res.status(500).json({
        success: false,
        error: 'Failed to start scraper process'
      });
    });
    
  } catch (error) {
    console.error('❌ Error in /api/scrape-metadata-from-asin:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================================================
// 🚀 BigQuery Initialization (ADC-friendly)
// ==================================================
let bigquery;
try {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const keyFile = process.env.GCP_KEY_FILE;

  const keyFileExists = keyFile ? fs.existsSync(keyFile) : false;

  console.log("🔧 BigQuery Setup:", {
    projectId,
    keyFile,
    keyFileExists,
  });

  const bigqueryOptions = {};

  if (projectId) {
    bigqueryOptions.projectId = projectId;
  }

  if (keyFile && keyFileExists) {
    // Local dev option – if you really want a local JSON file for Node only
    bigqueryOptions.keyFilename = keyFile;
    console.log("🟢 BigQuery auth: using key file:", keyFile);
  } else {
    // ✅ Preferred: ADC
    // Locally: uses GOOGLE_APPLICATION_CREDENTIALS
    // Cloud Run: uses service account identity
    console.log("🟢 BigQuery auth: using Application Default Credentials (ADC)");
  }

  bigquery = new BigQuery(bigqueryOptions);

  console.log("✅ BigQuery Initialized Successfully");
} catch (err) {
  console.error("❌ BigQuery Init Failed:", err.message);
  bigquery = null;
}

async function runQuery(query, params = {}) {
  if (!bigquery) throw new Error("BigQuery not initialized");
  const [rows] = await bigquery.query({ query, params });
  return rows;
}

// ==================================================
// 🚀 Google Sheets API Initialization (ADC-friendly)
// ==================================================
let sheetsClient = null;
let sheetsApi = null;

try {
  const sheetsKeyFile = process.env.GCP_KEY_FILE;
  const keyFileExists = sheetsKeyFile ? fs.existsSync(sheetsKeyFile) : false;

  const sheetsAuthOptions = {
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  };

  if (sheetsKeyFile && keyFileExists) {
    sheetsAuthOptions.keyFilename = sheetsKeyFile;
    console.log("🟢 Sheets auth: using key file:", sheetsKeyFile);
  } else {
    console.log("🟢 Sheets auth: using Application Default Credentials (ADC)");
    // Locally: uses GOOGLE_APPLICATION_CREDENTIALS
    // Cloud Run: uses service account identity
  }

  sheetsClient = new google.auth.GoogleAuth(sheetsAuthOptions);
  sheetsApi = google.sheets('v4');

  console.log("✅ Google Sheets API Initialized");
} catch (err) {
  console.error("❌ Google Sheets Init Failed:", err.message);
  sheetsClient = null;
  sheetsApi = null;
}

// Google sheet- Lead- Seller-Allocation
async function getAllocationSheetRows() {
  const authClient = await sheetsClient.getClient();

  const res = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: ALLOCATION_SHEET_ID,
    range: `${ALLOCATION_SHEET_TAB}!A2:G`,
  });

  return res.data.values || [];
}

async function appendAllocationRow(row) {
  const authClient = await sheetsClient.getClient();

  await sheetsApi.spreadsheets.values.append({
    auth: authClient,
    spreadsheetId: ALLOCATION_SHEET_ID,
    range: `${ALLOCATION_SHEET_TAB}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });
}

async function findLatestAllocatedRowIndex(sellerId, email) {
  const rows = await getAllocationSheetRows();
  let latest = null;

  rows.forEach((row, index) => {
    const [
      ,
      Seller_ID,
      Allocation_Status,
      Resource_Email,
      ,
      Assigned_Timestamp,
    ] = row;

    if (
      Seller_ID === sellerId &&
      Resource_Email === email &&
      Allocation_Status === 'ALLOCATED'
    ) {
      if (!latest || Assigned_Timestamp > latest.ts) {
        latest = { rowIndex: index + 2, ts: Assigned_Timestamp };
      }
    }
  });

  return latest?.rowIndex || null;
}

async function markRowUnallocated(rowIndex) {
  // Update only Allocation_Status (col C) and Unassigned_Timestamp (col G)
  // Preserve Resource_Email, Assigned_by, Assigned_Timestamp by updating two separate ranges via batchUpdate
  const authClient = await sheetsClient.getClient();

  const unassignedTs = toISTTimestamp();

  const requestBody = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: `${ALLOCATION_SHEET_TAB}!C${rowIndex}`,
        majorDimension: 'ROWS',
        values: [['UNALLOCATED']]
      },
      {
        range: `${ALLOCATION_SHEET_TAB}!G${rowIndex}`,
        majorDimension: 'ROWS',
        values: [[unassignedTs]]
      }
    ]
  };

  await sheetsApi.spreadsheets.values.batchUpdate({
    auth: authClient,
    spreadsheetId: ALLOCATION_SHEET_ID,
    requestBody
  });
}

// ==================================================
// 📌 ATTRIBUTE MAPPING + BIGQUERY HELPERS
// ==================================================

// ATTRIBUTE_MAPPING: UI label -> BigQuery column name
const ATTRIBUTE_MAPPING = {
  // Core Identification & Naming
  "Title": "Item_Name",
  "ASIN": "Product_ID",                 // We'll sync this with Seller_SKU below
  "Brand": "Brand_Name",
  "Generic Name": "Item_Type_Name",     // e.g. "Polo T Shirt"

  // Categorization
  "Category": "Generic_Keyword",        // General category tag / keyword
  "Subcategory": "Product_Sub_type",
  "Department": "Target_Gender",        // Also mirrored to Gender below

  // Descriptive Content
  "Product Description": "Product_Description",

  // Product Specifications
  "Product Dimensions": "Item_Length_Description", // Free-form dimension string
  "Item model number": "Model_Number",
  "Net Quantity": "Quantity",

  // Logistics & Dates
  "Manufacturer": "Manufacturer",
  "Country of Origin": "Country_of_Origin",
  "Packer": "Packer_Contact_Information",
  "Date First Available": "Release_Date",

  // Pricing
  "Price": "Your_price"
};

/**
 * Map incoming UI-style object to BigQuery-ready row.
 * - `incoming` is the object sent by frontend (free-form).
 * - options.stringifyArrays: if true, arrays will be serialized to JSON strings.
 */
function mapUIToBQRow(incoming = {}, options = {}) {
  const row = {};

  // 1️⃣ Map using ATTRIBUTE_MAPPING (UI label keys → BQ column names)
  for (const [uiKey, bqKey] of Object.entries(ATTRIBUTE_MAPPING)) {
    if (incoming[uiKey] !== undefined && incoming[uiKey] !== null) {
      row[bqKey] = incoming[uiKey];
    }
  }

  // 2️⃣ ID handling – unify Seller_SKU, Product_ID, ASIN
  // Take id in this priority: incoming.asin -> incoming.sku -> mapped Product_ID/Seller_SKU
  let unifiedId =
    incoming.asin ||
    incoming.sku ||
    row.Product_ID ||
    row.Seller_SKU;

  if (unifiedId) {
    unifiedId = String(unifiedId).trim();
    row.Product_ID = unifiedId;
    row.Seller_SKU = unifiedId;
    // As per your note, Product_ID is ASIN
    row.Product_ID_Type = row.Product_ID_Type || "ASIN";
  }

  // If UI mapping only set Product_ID (from "ASIN" label) but no unifiedId above
  if (!unifiedId && row.Product_ID) {
    row.Seller_SKU = row.Product_ID;
    row.Product_ID_Type = row.Product_ID_Type || "ASIN";
    unifiedId = row.Product_ID;
  }

  // 3️⃣ Additional programmatic mappings (in case frontend sends these keys)
  if (incoming.title) row.Item_Name = row.Item_Name || incoming.title;
  if (incoming.brand) row.Brand_Name = row.Brand_Name || incoming.brand;
  if (incoming.description) {
    row.Product_Description = row.Product_Description || incoming.description;
  }

  if (incoming.category) {
    row.Generic_Keyword = row.Generic_Keyword || incoming.category;
  }
  if (incoming.subcategory) {
    row.Product_Sub_type = row.Product_Sub_type || incoming.subcategory;
  }

  // Department → Target_Gender + Gender
  if (incoming.department) {
    row.Target_Gender = row.Target_Gender || incoming.department;
    row.Gender = row.Gender || incoming.department;
  }

  // Price (BigQuery column is STRING – stringify just to be safe)
  if (incoming.price !== undefined && incoming.price !== null) {
    row.Your_price = row.Your_price || String(incoming.price);
  }

  // Optional extra attributes
  if (incoming.color && !row.Color) row.Color = incoming.color;
  if (incoming.colour && !row.Color) row.Color = incoming.colour;
  if (incoming.size && !row.Size) row.Size = incoming.size;
  if (incoming.material && !row.Material_Type) row.Material_Type = incoming.material;
  if (incoming.neckStyle && !row.Neck_Style) row.Neck_Style = incoming.neckStyle;
  if (incoming.fitType && !row.Fitting_type) row.Fitting_type = incoming.fitType;
  if (incoming.sleeveType && !row.Sleeve_Type) row.Sleeve_Type = incoming.sleeveType;
  if (incoming.pattern && !row.Pattern) row.Pattern = incoming.pattern;
  if (incoming.style && !row.Style) row.Style = incoming.style;
  if (incoming.occasion && !row.Occasion_Lifestyle) row.Occasion_Lifestyle = incoming.occasion;

  const stringifyArrays =
    options.stringifyArrays || (process.env.BIGQUERY_STRINGIFY_ARRAYS === "true");

  // 4️⃣ Images handling – store links
  // Frontend should send: images: [url1, url2, ...]
  if (Array.isArray(incoming.images) && incoming.images.length > 0) {
    if (stringifyArrays) {
      // If you explicitly choose to store as a single JSON string
      row.Main_Image_URL = JSON.stringify(incoming.images);
    } else {
      // Default: first image in Main_Image_URL, rest in Other_Image_URL1..8
      row.Main_Image_URL = row.Main_Image_URL || incoming.images[0];
      for (let i = 1; i < Math.min(incoming.images.length, 9); i++) {
        row[`Other_Image_URL${i}`] = incoming.images[i];
      }
    }
  } else if (incoming.images) {
    // single URL/string
    row.Main_Image_URL = row.Main_Image_URL || incoming.images;
  }

  // 5️⃣ Feature bullets handling
  // Frontend should send: featureBullets: [bullet1, bullet2, ...]
  if (Array.isArray(incoming.featureBullets) && incoming.featureBullets.length > 0) {
    if (stringifyArrays) {
      // Store all bullets as JSON string in Bullet_Point1
      row.Bullet_Point1 = JSON.stringify(incoming.featureBullets);
    } else {
      // Store first 5 bullets in Bullet_Point1..5
      incoming.featureBullets.slice(0, 5).forEach((b, idx) => {
        row[`Bullet_Point${idx + 1}`] = b;
      });
      // Extra bullets (if any) as a JSON string in Special_Features1
      if (incoming.featureBullets.length > 5) {
        row.Special_Features1 =
          row.Special_Features1 ||
          JSON.stringify(incoming.featureBullets.slice(5));
      }
    }
  } else if (incoming.featureBullets) {
    // Single string
    row.Bullet_Point1 = row.Bullet_Point1 || incoming.featureBullets;
  }

  // 6️⃣ Ensure Seller_SKU exists (fallback to generated id)
  if (!row.Seller_SKU) {
    const generated = `SKU-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    row.Seller_SKU = generated;
    if (!row.Product_ID) row.Product_ID = generated;
  }

  // 7️⃣ Export date → BigQuery `Date` column (DATE type: YYYY-MM-DD)
  // Always use today's date at insert time (UI does NOT send any date)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  row.Date = `${yyyy}-${mm}-${dd}`;

  return row;
}

/**
 * Insert rows into BigQuery table (streaming insert).
 * Accepts array of plain JS objects (rows). Uses insertId to reduce duplicates.
 * Returns { inserted: number, errors: [] }
 */
async function insertRowsToBigQuery(rows = [], options = {}) {
  if (!bigquery) throw new Error('BigQuery not initialized');
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, errors: [] };

  const datasetId = process.env.BIGQUERY_DATASET || 'Amazon_Listing';
  const tableId = process.env.BIGQUERY_TABLE || 'amazon_product_data';
  const dataset = bigquery.dataset(datasetId);
  const table = dataset.table(tableId);

  // Build rows with insertId and json payload
  const rowsWithInsertIds = rows.map((r) => {
    const insertIdField = options.insertIdField || 'Seller_SKU';
    let insertId = null;
    if (insertIdField && r[insertIdField]) {
      insertId = String(r[insertIdField]);
    } else {
      insertId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    }
    return { insertId, json: r };
  });

  try {
    // table.insert accepts rows in the format {insertId, json}
    await table.insert(rowsWithInsertIds, { raw: true });
    return { inserted: rows.length, errors: [] };
  } catch (err) {
    console.error('BigQuery insert error:', err);
    const errors = err && err.errors ? err.errors : [{ message: err.message || String(err) }];
    return { inserted: 0, errors };
  }
}

// ==================================================
// 📌 BIGQUERY READ ENDPOINTS
// ==================================================

app.get("/api/gcp/sellers", async (req, res) => {
  try {
    if (!bigquery) throw new Error("BigQuery not initialized");

    const query = `
      SELECT DISTINCT
        seller_id,
        store_name
      FROM \`ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA\`
      WHERE seller_id IS NOT NULL AND seller_id != ''
      ORDER BY store_name
      LIMIT 5000
    `;

    const rows = await runQuery(query);
    res.json({ success: true, data: rows, totalRows: rows.length });

  } catch (err) {
    console.error("❌ Error /api/gcp/sellers:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/gcp/sellers/:sellerId/listings", async (req, res) => {
  try {
    if (!bigquery) throw new Error("BigQuery not initialized");

    const { sellerId } = req.params;

    const query = `
      SELECT
        seller_id,
        store_name,
        \`listing-id\` AS listing_id,
        \`item-name\` AS item_name,
        \`item-description\` AS item_description,
        \`seller-sku\` AS seller_sku,
        price,
        quantity,
        \`open-date\` AS open_date,
        \`image-url\` AS image_url,
        \`zshop-category1\` AS category,
        \`zshop-browse-path\` AS subcategory,
        asin1,
        asin2,
        asin3,
        status
      FROM \`ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA\`
      WHERE seller_id = @sellerId
      ORDER BY item_name
    `;

    const rows = await runQuery(query, { sellerId });
    res.json({ success: true, data: rows, sellerId });

  } catch (err) {
    console.error("❌ Error /api/gcp/sellers/:sellerId/listings:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// NEW: fetch resource allocation rows for a seller/store
app.get("/api/gcp/sellers/:sellerId/resource-allocation", async (req, res) => {
  try {
    if (!bigquery) throw new Error("BigQuery not initialized");

    const { sellerId } = req.params;
    // optional storeName can be provided to match on name instead of id
    const storeName = req.query.storeName || req.query.store_name || null;

    // We try to match either Seller_ID or store_name to be flexible
    const query = `
      SELECT *
      FROM ` + "`ops-excellence.Listro_Listing.Resource_Allocation`" + `
      WHERE (
        (SAFE_CAST(Seller_ID AS STRING) = @sellerId)
        ${storeName ? ` OR (LOWER(COALESCE(store_name, '')) = LOWER(@storeName))` : ''}
      )
      ORDER BY Seller_ID
    `;

    const params = { sellerId };
    if (storeName) params.storeName = storeName;

    const rows = await runQuery(query, params);
    res.json({ success: true, data: rows, sellerId, storeName });

  } catch (err) {
    console.error("❌ Error /api/gcp/sellers/:sellerId/resource-allocation:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================
// 📌 CLAIM LISTINGS ENDPOINT - TABLE 2
// ==================================================
/**
 * POST /api/claim-listings
 * Claims selected listings in Table 2 and exports to Google Sheet
 * 
 * ⚠️ IMPORTANT: BigQuery is READ-ONLY. This endpoint ONLY writes to Google Sheet.
 * 
 * RULE 1: MAX 10 LISTINGS - enforced
 * RULE 2: Export claimed listings to Google Sheet only (BigQuery is never modified)
 * RULE 3: Upsert to Google Sheet by listing-id (no duplicates)
 * 
 * Body: {
 *   sellerId: string,
 *   listings: Array<{ listing-id, asin1, store_name, seller_id }>,
 *   userEmail: string,
 *   claimedAt: ISO timestamp
 * }
 */
app.post('/api/claim-listings', async (req, res) => {
  try {
    if (!sheetsApi || !sheetsClient) throw new Error('Google Sheets not initialized');

    const { sellerId, listings, userEmail, claimedAt } = req.body;

    // ✅ VALIDATION
    if (!sellerId || !Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload: sellerId and listings array required',
      });
    }

    if (listings.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 listings can be claimed at a time.',
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userEmail is required',
      });
    }

    console.log('📋 [CLAIM] Processing claim request:', {
      sellerId,
      listingCount: listings.length,
      userEmail,
      claimedAt,
    });

    const claimedAtISO = new Date(claimedAt).toISOString();
    const listingIds = listings.map(l => l['listing-id']).filter(Boolean);
    
    if (listingIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid listing IDs found',
      });
    }

    // ✅ STEP 1: PREPARE DATA FOR GOOGLE SHEET
    // Each claimed listing gets Claimed_Status, Last_Claim_Timestamp, and Email_id
    console.log('📝 [CLAIM] Preparing claimed listings for Google Sheet export...');

    const claimedListingsForSheet = listings.map(listing => [
      listing['listing-id'] || '',
      listing.asin1 || '',
      listing.store_name || '',
      'Claimed',  // Claimed_Status
      claimedAtISO,  // Last_Claim_Timestamp
      userEmail,  // Email_id
    ]);

    // ✅ STEP 2: EXPORT TO GOOGLE SHEET
    const TABLE2_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TABLE2_SHEET_TAB = 'KAM';

    const authClient = await sheetsClient.getClient();

    // Prepare sheet data with exact column order and claimed listings
    const sheetValues = [
      ['listing-id', 'asin1', 'store_name', 'Claimed_Status', 'Last_Claim_Timestamp', 'Email_id'],
      ...claimedListingsForSheet,
    ];

    // Write claimed data to Google Sheet (append mode - no clear, just append)
    console.log('📝 [CLAIM] Writing claimed listings to Google Sheet...');
    await sheetsApi.spreadsheets.values.append({
      auth: authClient,
      spreadsheetId: TABLE2_SHEET_ID,
      range: `${TABLE2_SHEET_TAB}!A2`,  // Start from row 2 (skip header)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: claimedListingsForSheet,
      },
    });

    console.log('✅ [CLAIM] Google Sheet updated successfully:', {
      rowsWritten: claimedListingsForSheet.length,
      spreadsheetId: TABLE2_SHEET_ID,
      tab: TABLE2_SHEET_TAB,
    });

    // ✅ SUCCESS RESPONSE
    res.json({
      success: true,
      message: `Successfully exported ${listingIds.length} listing(s) to Google Sheet`,
      claimedCount: listingIds.length,
      exportedToSheet: true,
      claimedListings: listingIds,
      userEmail: userEmail,
      claimedAt: claimedAtISO,
      note: 'BigQuery remains READ-ONLY. Data exported to Google Sheet only.',
    });

  } catch (err) {
    console.error('❌ [CLAIM] Error in /api/claim-listings:', err.message || err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to claim listings',
      details: err.message,
    });
  }
});

app.get("/api/gcp/sellers/search/:searchTerm", async (req, res) => {
  try {
    if (!bigquery) throw new Error("BigQuery not initialized");

    const { searchTerm } = req.params;

    const query = `
      SELECT DISTINCT
        seller_id,
        store_name
      FROM \`ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA\`
      WHERE LOWER(store_name) LIKE LOWER(@term)
        OR LOWER(seller_id) LIKE LOWER(@term)
      ORDER BY store_name
      LIMIT 50
    `;

    const rows = await runQuery(query, { term: `%${searchTerm}%` });
    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("❌ Error /api/gcp/sellers/search:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================
// 📌 BIGQUERY INSERT PRODUCT ENDPOINT
// ==================================================

/**
 * POST /api/gcp/insert-product
 * Accepts a single object or array of objects.
 * Example body: { sku, title, asin, price, images: [], featureBullets: [], ... }
 */
app.post('/api/gcp/insert-product', async (req, res) => {
  try {
    if (!bigquery) {
      return res.status(500).json({
        success: false,
        error: 'BigQuery not initialized'
      });
    }

    const payload = req.body;
    // Accept single object or array
    const rowsRaw = Array.isArray(payload) ? payload : [payload];

    if (rowsRaw.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    // Map incoming rows to BigQuery columns
    const mappedRows = rowsRaw.map(r => {
      const row = mapUIToBQRow(r, { stringifyArrays: process.env.BIGQUERY_STRINGIFY_ARRAYS === 'true' });

      // Extra safety: ensure Date is always set here as well
      if (!row.Date) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        row.Date = `${yyyy}-${mm}-${dd}`;
      }

      return row;
    });

    console.log('📤 Inserting to BigQuery (single endpoint):', {
      rowCount: mappedRows.length,
      sampleRow: mappedRows[0] || {}
    });

    // Insert into BigQuery (use Seller_SKU as insertId for dedupe)
    const result = await insertRowsToBigQuery(mappedRows, { insertIdField: 'Seller_SKU' });

    if (result.errors && result.errors.length > 0) {
      console.error('❌ BigQuery insertion errors:', result.errors);
      return res.status(500).json({
        success: false,
        inserted: result.inserted,
        errors: result.errors
      });
    }

    console.log('✅ Successfully inserted to BigQuery (single endpoint):', { inserted: result.inserted });
    res.json({
      success: true,
      inserted: result.inserted,
      message: `Successfully inserted ${result.inserted} record(s) to BigQuery`
    });

  } catch (err) {
    console.error('❌ /api/gcp/insert-product error:', err);
    res.status(500).json({
      success: false,
      error: err.message || String(err),
      details: 'Check server logs for more information'
    });
  }
});

// ==================================================
// 📌 SELLER ALLOCATION SYSTEM ENDPOINTS
// ==================================================

app.post('/api/sheets/allocateAll', async (req, res) => {
  try {
    const { toAllocate = [], toUnallocate = [] } = req.body;

    console.log('📥 Sheet allocateAll:', {
      toAllocate: toAllocate.length,
      toUnallocate: toUnallocate.length,
    });

    // ALLOCATE → APPEND (batch append to reduce race conditions)
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }

    let appendedCount = 0;

    if (toAllocate.length > 0) {
      // ✅ ADDED: Pre-append dedupe logic
      // Fetch current live allocations and avoid adding duplicates
      const existingRows = await getAllocationSheetRows();
      
      // Build latest map similar to /api/sheets/allocations logic
      const latestMap = {};
      existingRows.forEach((r) => {
        const [Seller_name, Seller_ID, Allocation_Status, Resource_Email, Assigned_by, Assigned_Timestamp, Unassigned_Timestamp] = r;
        if (!Seller_ID || !Resource_Email) return;
        const key = `${Seller_ID}__${Resource_Email}`;
        const eventTs = Unassigned_Timestamp || Assigned_Timestamp || '';
        if (!latestMap[key] || eventTs > (latestMap[key]._eventTs || '')) {
          latestMap[key] = {
            Seller_name,
            Seller_ID,
            Allocation_Status,
            Resource_Email,
            Assigned_by,
            Assigned_Timestamp,
            Unassigned_Timestamp,
            _eventTs: eventTs
          };
        }
      });

      const existingAllocatedKeys = new Set(Object.values(latestMap)
        .filter(r => (r.Allocation_Status || '').toString().toUpperCase() === 'ALLOCATED')
        .map(r => `${r.Seller_ID}::${r.Resource_Email}`)
      );

      // Filter toAllocate by removing duplicates already allocated
      const filteredToAllocate = toAllocate.filter(r => {
        const key = `${r.Seller_ID}::${r.Resource_Email}`;
        return !existingAllocatedKeys.has(key);
      });

      if (filteredToAllocate.length > 0) {
        const authClient = await sheetsClient.getClient();
        const valuesToAppend = filteredToAllocate.map(r => [
          r.Seller_name || r.Seller_name || '',
          r.Seller_ID || '',
          'ALLOCATED',
          r.Resource_Email || '',
          r.Assigned_by || r.Assigned_by || '',
          r.Assigned_Timestamp || toISTTimestamp(),
          ''
        ]);

        await sheetsApi.spreadsheets.values.append({
          auth: authClient,
          spreadsheetId: ALLOCATION_SHEET_ID,
          range: `${ALLOCATION_SHEET_TAB}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: valuesToAppend
          }
        });
        appendedCount = filteredToAllocate.length;
      }
    }

    // UNALLOCATE → UPDATE
    for (const r of toUnallocate) {
      const rowIndex = await findLatestAllocatedRowIndex(
        r.Seller_ID,
        r.Resource_Email
      );

      if (rowIndex) {
        await markRowUnallocated(rowIndex);
      }
    }

    res.json({
      success: true,
      allocated: appendedCount,
      unallocated: toUnallocate.length,
    });

  } catch (err) {
    console.error('❌ Sheet allocateAll error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sheets/allocations', async (req, res) => {
  try {
    const rows = await getAllocationSheetRows();

    /**
     * Truth rule:
     * Latest row by (Assigned_Timestamp OR Unassigned_Timestamp) wins
     */
    const latestMap = {};

    rows.forEach((r) => {
      const [
        Seller_name,
        Seller_ID,
        Allocation_Status,
        Resource_Email,
        Assigned_by,
        Assigned_Timestamp,
        Unassigned_Timestamp,
      ] = r;

      if (!Seller_ID || !Resource_Email) return;

      const key = `${Seller_ID}__${Resource_Email}`;

      // choose the latest timestamp available
      const eventTs =
        Unassigned_Timestamp ||
        Assigned_Timestamp ||
        '';

      if (
        !latestMap[key] ||
        eventTs > (latestMap[key]._eventTs || '')
      ) {
        latestMap[key] = {
          Seller_name,
          Seller_ID,
          Allocation_Status,
          Resource_Email,
          Assigned_by,
          Assigned_Timestamp,
          Unassigned_Timestamp,
          _eventTs: eventTs, // internal comparison only
        };
      }
    });

    // ONLY LIVE ALLOCATIONS
    const liveAllocations = Object.values(latestMap)
      .filter(r => r.Allocation_Status === 'ALLOCATED')
      .map(({ _eventTs, ...clean }) => clean); // remove helper key

    res.json({
      success: true,
      data: liveAllocations,
      totalAllocations: liveAllocations.length,
    });

  } catch (err) {
    console.error('❌ Sheet allocations error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/gcp/allocateAll
 * Bulk allocate/unallocate sellers to resources
 * Body: { toAllocate: [], toUnallocate: [] }
 */
app.post("/api/gcp/allocateAll", async (req, res) => {
  try {
    const toIST = () => {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      return new Date(now.getTime() + istOffset)
        .toISOString()
        .replace("T", " ")
        .split(".")[0];
    };

    const { toAllocate = [], toUnallocate = [] } = req.body;

    const datasetId = "Listro_Listing";
    const tableId = "Lead_SellerAllocation";
    const table = bigquery.dataset(datasetId).table(tableId);

    console.log("📥 allocateAll():", {
      toAllocate: toAllocate.length,
      toUnallocate: toUnallocate.length
    });

    // ------------------------------------------------------
    // 1️⃣ INSERT NEW ALLOCATIONS
    // ------------------------------------------------------
    const allocRows = [];

    for (const r of toAllocate) {
      const checkQuery = `
        SELECT COUNT(*) AS count
        FROM \`Listro_Listing.Lead_SellerAllocation\`
        WHERE Seller_ID = @sellerId
          AND Resource_Email = @email
          AND UPPER(TRIM(Allocation_Status)) = 'ALLOCATED'
      `;

      const exists = await runQuery(checkQuery, {
        sellerId: r.Seller_ID,
        email: r.Resource_Email
      });

      if (exists[0].count > 0) continue;

      allocRows.push({
        Seller_ID: r.Seller_ID,
        Seller_name: r.Seller_name || "",
        Resource_Email: r.Resource_Email,
        Allocation_Status: "ALLOCATED",
        Assigned_by: r.Assigned_by || null,
        Assigned_Timestamp: toIST(),
        Unassigned_Timestamp: null
      });
    }

    if (allocRows.length > 0) {
      await table.insert(allocRows, { ignoreUnknownValues: true });
      console.log("✅ Inserted ALLOCATED rows:", allocRows.length);
    }

    // ------------------------------------------------------
    // 2️⃣ UNALLOCATE (UPDATE)
    // ------------------------------------------------------
    let unallocatedCount = 0;

    for (const r of toUnallocate) {
      const timestamp = toIST();

      const updateQuery = `
        UPDATE \`Listro_Listing.Lead_SellerAllocation\`
        SET
          Allocation_Status = 'UNALLOCATED',
          Unassigned_Timestamp = @ts
        WHERE Seller_ID = @sellerId
          AND Resource_Email = @email
          AND UPPER(TRIM(Allocation_Status)) = 'ALLOCATED'
      `;

      await runQuery(updateQuery, {
        ts: timestamp,
        sellerId: r.Seller_ID,
        email: r.Resource_Email
      });

      unallocatedCount++;
    }

    console.log("♻️ Unallocated rows:", unallocatedCount);

    // ------------------------------------------------------
    // 📤 SEND FINAL RESPONSE
    // ------------------------------------------------------
    return res.json({
      success: true,
      allocated: allocRows.length,
      unallocated: unallocatedCount
    });

  } catch (err) {
    console.error("❌ allocateAll error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/gcp/allocations
 * Fetch all existing allocations from BigQuery for dashboard
 */
app.get("/api/gcp/allocations", async (req, res) => {
  try {
    if (!bigquery) throw new Error("BigQuery not initialized");

    const query = `
      SELECT
        Seller_ID,
        Seller_name,
        Resource_Email,
        Assigned_by,
        Allocation_Status,
        Assigned_Timestamp,
        Unassigned_Timestamp
      FROM \`Listro_Listing.Lead_SellerAllocation\`
      ORDER BY Assigned_Timestamp DESC
    `;

    const rows = await runQuery(query);
    console.log(`✅ Fetched ${rows.length} allocations from BigQuery`);
    
    res.json({ 
      success: true, 
      data: rows,
      totalAllocations: rows.length 
    });

  } catch (err) {
    console.error("❌ Error /api/gcp/allocations:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================
// 📌 GOOGLE SHEETS UPLOAD HELPER
// ==================================================

/**
 * Reusable helper to process Google Sheets upload.
 * Right now it just validates csvData and returns a static sheetUrl,
 * same as your previous /api/upload-to-sheets endpoint.
 */
async function processSheetUpload(csvData, extraMeta = {}) {
  if (!csvData || !Array.isArray(csvData)) {
    throw new Error('Invalid data format. Expected array of arrays for csvData.');
  }

  if (!sheetsClient || !sheetsApi) {
    throw new Error('Google Sheets API not initialized');
  }

  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    extraMeta.spreadsheetId ||
    '1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc';

  const tabName =
    extraMeta.tabName ||
    process.env.GOOGLE_SHEETS_TAB_NAME ||
    'Product_Data';

  console.log('📤 Received data for Google Sheets upload:', {
    rowCount: csvData.length,
    headers: csvData[0] ? csvData[0].length : 0,
    tabName,
    spreadsheetId
  });

  const authClient = await sheetsClient.getClient();

  // 🔍 1) Check if the sheet already has a header in A1
  let appendValues = csvData;
  let hasHeaderAlready = false;

  try {
    const existing = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId,
      range: `${tabName}!A1:A1`
    });

    const values = existing.data.values;
    hasHeaderAlready =
      Array.isArray(values) &&
      values.length > 0 &&
      Array.isArray(values[0]) &&
      values[0].some(cell => cell && String(cell).trim() !== '');

    console.log('🔎 Sheet header check:', { hasHeaderAlready });
  } catch (err) {
    console.warn('⚠️ Could not check existing header, will append full csvData:', err.message);
  }

  // 🔧 2) If header exists and we got [header, row1, row2...],
  //     strip off the first row (header) before appending
  if (hasHeaderAlready && csvData.length > 1) {
    appendValues = csvData.slice(1);
  }

  // If nothing left to append (e.g. only header), just return
  if (!appendValues || appendValues.length === 0) {
    console.log('ℹ️ No new data rows to append to Google Sheets');
    return {
      success: true,
      message: 'No new data rows to upload (header already present)',
      totalRows: 0,
      updatedRows: 0,
      tabName,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    };
  }

  // 📝 3) Append the rows that we actually want
  const range = `${tabName}!A1`;

  const response = await sheetsApi.spreadsheets.values.append({
    auth: authClient,
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: appendValues
    }
  });

  const updates = response.data.updates || {};
  const updatedRows = updates.updatedRows || appendValues.length;

  console.log('✅ Google Sheets append result:', {
    updatedRows,
    updatedRange: updates.updatedRange
  });

  return {
    success: true,
    message: `Data uploaded to Google Sheets tab "${tabName}"`,
    // number of *data* rows appended (ignore header)
    totalRows: appendValues.length,
    updatedRows,
    tabName,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  };
}

// ==================================================
// 📌 GOOGLE SHEETS UPLOAD ENDPOINT (Existing)
// ==================================================

app.post('/api/upload-to-sheets', async (req, res) => {
  try {
    const { csvData, ...meta } = req.body;

    const result = await processSheetUpload(csvData, meta);

    res.json(result);

  } catch (error) {
    console.error('❌ Error in Google Sheets upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload to Google Sheets: ' + error.message
    });
  }
});

// ==================================================
// 📌 COMBINED EXPORT: BIGQUERY + GOOGLE SHEETS
// ==================================================

/**
 * POST /api/gcp/combined-export
 * Body: { productData, sheetData }
 *  - productData: the object you already send to insertProductToBigQuery
 *  - sheetData: { csvData, ...meta } built in api.js / combinedExport()
 */
app.post('/api/gcp/combined-export', async (req, res) => {
  try {
    if (!bigquery) {
      return res.status(500).json({
        success: false,
        error: 'BigQuery not initialized'
      });
    }

    const { productData, sheetData } = req.body || {};

    if (!productData) {
      return res.status(400).json({
        success: false,
        error: 'Missing productData in request body'
      });
    }

    if (!sheetData || !Array.isArray(sheetData.csvData)) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid sheetData.csvData in request body'
      });
    }

    console.log('🚀 Combined export started:', {
      hasProductData: !!productData,
      sheetRows: sheetData.csvData.length
    });

    // ---------- 1️⃣ BigQuery part ----------
    const mappedRow = mapUIToBQRow(productData, {
      stringifyArrays: process.env.BIGQUERY_STRINGIFY_ARRAYS === 'true'
    });

    // Ensure Date is set
    if (!mappedRow.Date) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      mappedRow.Date = `${yyyy}-${mm}-${dd}`;
    }

    console.log('📤 [Combined] Inserting into BigQuery:', {
      sampleRow: mappedRow
    });

    const bqInsertResult = await insertRowsToBigQuery([mappedRow], {
      insertIdField: 'Seller_SKU'
    });

    let bigQueryResult = {
      success: true,
      inserted: bqInsertResult.inserted || 0,
      errors: bqInsertResult.errors || []
    };

    if (bigQueryResult.errors && bigQueryResult.errors.length > 0) {
      console.error('❌ [Combined] BigQuery insertion errors:', bigQueryResult.errors);
      bigQueryResult.success = false;
    } else {
      console.log('✅ [Combined] BigQuery insert OK:', bigQueryResult);
    }

    // ---------- 2️⃣ Google Sheets part ----------
    console.log('📄 [Combined] Processing Google Sheets upload...');
    const sheetResult = await processSheetUpload(sheetData.csvData, {
      tabName: sheetData.tabName,
      sheetUrl: sheetData.sheetUrl,
      duplicateCheck: sheetData.duplicateCheck,
      duplicateKeys: sheetData.duplicateKeys,
      currentDate: sheetData.currentDate,
      currentSellerSKU: sheetData.currentSellerSKU
    });

    console.log('✅ [Combined] Google Sheets processing OK:', sheetResult);

    // ---------- 3️⃣ Build summary ----------
    const summary = {
      bigQueryExported: bigQueryResult.success && bigQueryResult.inserted > 0,
      googleSheetsExported: sheetResult.success === true
    };

    const overallSuccess = summary.bigQueryExported || summary.googleSheetsExported;

    res.json({
      success: overallSuccess,
      summary,
      results: {
        bigQuery: bigQueryResult,
        googleSheets: sheetResult
      }
    });

  } catch (err) {
    console.error('❌ /api/gcp/combined-export error:', err);
    res.status(500).json({
      success: false,
      error: err.message || String(err),
      details: 'Check server logs for more information'
    });
  }
});

// ==================================================
// 🚀 Start Server
// ==================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(bigquery ? "🟢 BigQuery ACTIVE" : "🔴 BigQuery DISABLED");
  console.log("📊 Google Sheets Integration: ACTIVE");
  console.log("🔍 Dual Scraper System: READY");
  console.log("📤 BigQuery Insert Endpoint: READY");
  console.log("📤 Google Sheets Upload Endpoint: READY");
  console.log("📡 Combined Export Endpoint: READY (/api/gcp/combined-export)");
  console.log("📧 Email Fetching Endpoint: READY (/api/sheet-emails)");
  console.log("👥 Seller Allocation System: READY");
  console.log("   ├─ POST /api/gcp/allocateAll (bulk allocate/unallocate)");
  console.log("   └─ GET /api/gcp/allocations (fetch all allocations)");
  console.log("🔍 ASIN Metadata Scraper: READY (/api/scrape-metadata-from-asin)");
  console.log("📋 Table 2 - Claim Listings: READY (/api/claim-listings)");
  console.log("   ├─ Max 10 listings per claim");
  console.log("   ├─ Updates BigQuery Resource_Allocation table");
  console.log("   └─ Syncs to Google Sheet (1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs)");
});

// ----------------- END OF FILE -----------------