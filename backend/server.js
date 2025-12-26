// server.js (Cloud Run Production Version)
// Updated for Cloud Run with ADC authentication

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
const { Mutex } = require('async-mutex');
const { Storage } = require('@google-cloud/storage');
const claimMutex = new Mutex();

// ==================================================
// 📌 SELLER ALLOCATION SHEET CONFIG
// ==================================================
const ALLOCATION_SHEET_ID = '1MlqeJixTmp6Cj2FSkGLsN08OBP9Kx5565NuxGrb0v18';
const ALLOCATION_SHEET_TAB = 'Data';

const app = express();
const PORT = process.env.PORT || 8080; // Cloud Run uses 8080

// ✅ CORS configuration for Cloud Run - supports multiple origins
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://listrov3-frontend-648176215467.asia-south1.run.app'
  ];
  
  // Add custom origin from environment variable if provided
  if (process.env.FRONTEND_ORIGIN) {
    origins.push(process.env.FRONTEND_ORIGIN);
  }
  
  return [...new Set(origins)]; // Remove duplicates
};

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = getAllowedOrigins();
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked for origin: ${origin}`);
        callback(null, true); // Allow all origins for now, log the warning
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
// 🚀 GOOGLE CLOUD STORAGE CONFIG (For scraped images)
// ==================================================

const GCS_BUCKET_NAME = "listro-image-store";
let gcsClient = null;

try {
  // ✅ Uses ADC (local: GOOGLE_APPLICATION_CREDENTIALS; Cloud Run: SA identity)
  gcsClient = new Storage();
  console.log('✅ Google Cloud Storage client initialized (ADC) for server.js.');
} catch (error) {
  console.error(`❌ GCS client initialization error: ${error.message}`);
  gcsClient = null;
}

/**
 * Upload image bytes to GCS and return signed URL
 * @param {Buffer} imageBytes - Image data as bytes
 * @param {string} gcsFolderPath - GCS folder path (e.g., "golden_scraped/asin123")
 * @param {string} filename - Filename for the image (e.g., "img_0.jpg")
 * @returns {Promise<string>} Public/signed URL of the uploaded image
 */
async function uploadImageToGCS(imageBytes, gcsFolderPath, filename) {
  if (!gcsClient) {
    throw new Error('GCS client not initialized');
  }

  try {
    const bucket = gcsClient.bucket(GCS_BUCKET_NAME);
    const blobPath = `${gcsFolderPath}/${filename}`;
    const blob = bucket.file(blobPath);

    console.log(`📤 Uploading image to GCS: gs://${GCS_BUCKET_NAME}/${blobPath}`);

    await blob.save(imageBytes, {
      metadata: {
        contentType: 'image/jpeg'
      }
    });

    // Generate signed URL (valid for 7 days)
    // Note: expires must be a Date object, not milliseconds since epoch
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const signedUrl = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: sevenDaysFromNow
    });

    const url = signedUrl[0];
    console.log(`✅ Image uploaded successfully: ${url.substring(0, 80)}...`);
    return url;
  } catch (error) {
    console.error(`❌ GCS upload failed: ${error.message}`);
    throw error;
  }
}

/**
 * Convert GCS path to signed URL
 * @param {string} gcsPath - GCS path (e.g., gs://bucket/folder/file.jpg)
 * @returns {Promise<string>} Signed URL
 */
async function convertGCSPathToSignedUrl(gcsPath) {
  if (!gcsClient) {
    throw new Error('GCS client not initialized');
  }

  try {
    // Parse gs:// URL
    const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match) {
      throw new Error(`Invalid GCS path format: ${gcsPath}`);
    }

    const bucketName = match[1];
    const filePath = match[2];

    const bucket = gcsClient.bucket(bucketName);
    const blob = bucket.file(filePath);

    // Generate signed URL (valid for 7 days)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const signedUrl = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: sevenDaysFromNow
    });

    return signedUrl[0];
  } catch (error) {
    console.error(`❌ Failed to convert GCS path to signed URL: ${error.message}`);
    // Return the GCS path as fallback (may not be directly accessible)
    return gcsPath;
  }
}

/**
 * Download image from URL and upload to GCS, returning GCS URL
 * @param {string} imageUrl - Source image URL
 * @param {string} gcsFolderPath - GCS folder path
 * @param {string} filename - Filename for the image
 * @returns {Promise<string|null>} GCS signed URL or null if failed
 */
async function downloadAndUploadImageToGCS(imageUrl, gcsFolderPath, filename) {
  try {
    console.log(`🔗 Downloading image from: ${imageUrl.substring(0, 80)}...`);
    
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}`);
    }

    const imageBytes = Buffer.from(response.data);
    const gcsUrl = await uploadImageToGCS(imageBytes, gcsFolderPath, filename);
    return gcsUrl;
  } catch (error) {
    console.error(`❌ Failed to download and upload image: ${error.message}`);
    return null;
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
// 🚀 COMPLETE SCRAPING FUNCTIONALITY
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
            const parsed = JSON.parse(scraperData);
            console.log('✅ [DEBUG] scraper.py parsed - keys:', Object.keys(parsed));
            console.log('✅ [DEBUG] scraper.py parsed - images:', parsed.images?.length, 'items');
            console.log('✅ [DEBUG] scraper.py parsed - first image:', parsed.images?.[0]?.substring(0, 80));
            resolve(parsed);
          } catch (e) {
            console.error('❌ [DEBUG] Failed to parse scraper.py JSON:', e.message);
            console.error('❌ [DEBUG] Raw output:', scraperData.substring(0, 500));
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
            // Try to parse the data as JSON
            resolve(JSON.parse(amzData));
          } catch (e) {
            // If JSON parsing fails, try to extract JSON from the output
            // (in case there's debug output before the JSON)
            const jsonMatch = amzData.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                resolve(JSON.parse(jsonMatch[0]));
              } catch (e2) {
                console.error('❌ JSON Parse Error - amzData content:', amzData.substring(0, 500));
                console.error('❌ Error details:', e2.message);
                reject(new Error('Failed to parse amz_scraper.py output'));
              }
            } else {
              console.error('❌ JSON Parse Error - amzData content:', amzData.substring(0, 500));
              console.error('❌ Error details:', e.message);
              reject(new Error('Failed to parse amz_scraper.py output'));
            }
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

    // Debug: Log what we actually got
    console.log('🔍 [DEBUG] scraperData after extraction:', {
      exists: !!scraperData,
      keys: scraperData ? Object.keys(scraperData) : 'null',
      hasImages: scraperData?.images !== undefined,
      imagesLength: scraperData?.images?.length,
      imagesType: Array.isArray(scraperData?.images) ? 'array' : typeof scraperData?.images
    });

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
    // amz_scraper.py returns mainImages (GCS paths from asin_scraped folder) in product.mainImages
    console.log('🔍 [DEBUG] scraperData full:', JSON.stringify(scraperData, null, 2).substring(0, 500));
    console.log('🔍 [DEBUG] amzData:', amzData);
    console.log('🔍 [DEBUG] scraperData.images length:', scraperData?.images?.length);
    console.log('🔍 [DEBUG] amzData images (if any):', amzData?.product?.images?.length);
    
    // ⭐ SIMPLIFIED: Use scraped Amazon images DIRECTLY
    // NO GCS bucket, NO uploads, NO conversions
    // Just return all images as scraped from Amazon CDN
    
    let images = [];
    
    // Log both sources for debugging
    console.log(`🔍 [DEBUG] scraperData has ${scraperData?.images?.length || 0} images`);
    console.log(`🔍 [DEBUG] amzData has ${amzData?.product?.images?.length || 0} images`);
    
    if (scraperData?.images && scraperData.images.length > 0) {
      console.log(`📊 [DEBUG] scraperData.images first 5:`, scraperData.images.slice(0, 5));
    }
    if (amzData?.product?.images && amzData.product.images.length > 0) {
      console.log(`📊 [DEBUG] amzData.product.images first 5:`, amzData.product.images.slice(0, 5));
    }
    
    // ⭐ PRIORITY FIX: Use amz_scraper.py images (has better extraction logic)
    // amz_scraper.py uses Selenium to get ALL images from JS-rendered galleries
    if (amzData?.product?.images && amzData.product.images.length > 0) {
      console.log(`✅ Using ${amzData.product.images.length} images from amz_scraper (Selenium + BeautifulSoup)`);
      images = amzData.product.images;
    } else if (scraperData?.images && scraperData.images.length > 0) {
      console.log(`✅ Using ${scraperData.images.length} images from scraper.py (fallback)`);
      images = scraperData.images;
    } else {
      console.log('⚠️  No images found from either scraper');
      images = [];
    }

    console.log(`📊 [FINAL] Total images: ${images.length}`);
    console.log(`📊 [FINAL] First 3 URLs: ${images.slice(0, 3).map(img => img?.substring(0, 80)).join(' | ')}`);
    console.log(`📊 [FINAL] All unique images:`, JSON.stringify([...new Set(images)], null, 2));
    console.log(`📊 [FINAL] Unique count: ${new Set(images).size} / Total count: ${images.length}`);
    
    // ✅ NO FILTERING, NO DEDUPLICATION, NO CONVERSION
    // Return ALL images exactly as scraped from Amazon

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
    
    console.log('📤 [DEBUG] Final images array before response:', {
      count: images.length,
      firstThree: images.slice(0, 3),
      mergedResultImages: mergedResult.product.images.length,
      areEqual: images === mergedResult.product.images
    });
   
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
// 🚀 BigQuery Initialization (ADC-friendly for Cloud Run)
// ==================================================
let bigquery;
let sheetsClient = null;
let sheetsApi = null;

try {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  
  console.log("🔧 BigQuery Setup:", {
    projectId: projectId,
    environment: process.env.NODE_ENV || 'development',
    authMethod: 'ADC (Application Default Credentials)'
  });

  // ✅ For Cloud Run: Always use ADC (Application Default Credentials)
  // Locally: uses GOOGLE_APPLICATION_CREDENTIALS env var
  // Cloud Run: uses attached service account identity automatically
  const bigqueryOptions = { projectId: projectId };
  
  bigquery = new BigQuery(bigqueryOptions);
  
  console.log("✅ BigQuery Initialized Successfully with ADC");
  
  // ✅ Also initialize Google Sheets API with ADC
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    projectId: projectId
  });
  
  sheetsClient = auth;
  sheetsApi = google.sheets({ version: 'v4', auth });
  
  console.log("✅ Google Sheets API Initialized with ADC");
  
} catch (err) {
  console.error("❌ Initialization Failed:", err.message);
  console.error("❌ Stack trace:", err.stack);
  // Don't crash the server, allow graceful degradation
  bigquery = null;
  sheetsClient = null;
  sheetsApi = null;
}

async function runQuery(query, params = {}) {
  if (!bigquery) throw new Error("BigQuery not initialized");
  const [rows] = await bigquery.query({ query, params });
  return rows;
}

// Google sheet- Lead- Seller-Allocation
async function getAllocationSheetRows() {
  if (!sheetsClient || !sheetsApi) {
    throw new Error("Google Sheets API not initialized");
  }

  const authClient = await sheetsClient.getClient();

  const res = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: ALLOCATION_SHEET_ID,
    range: `${ALLOCATION_SHEET_TAB}!A2:G`,
  });

  return res.data.values || [];
}

async function appendAllocationRow(row) {
  if (!sheetsClient || !sheetsApi) {
    throw new Error("Google Sheets API not initialized");
  }

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
  if (!sheetsClient || !sheetsApi) {
    throw new Error("Google Sheets API not initialized");
  }

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
  if (!sheetsClient || !sheetsApi) {
    throw new Error("Google Sheets API not initialized");
  }

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
    if (!sheetsApi || !sheetsClient) throw new Error("Google Sheets not initialized");

    const { sellerId } = req.params;
    const storeName = req.query.storeName || req.query.store_name || null;

    // Get data from BigQuery
    const query = `
      SELECT *
      FROM \`ops-excellence.Listro_Listing.Resource_Allocation\`
      WHERE (
        (SAFE_CAST(Seller_ID AS STRING) = @sellerId)
        ${storeName ? ` OR (LOWER(COALESCE(store_name, '')) = LOWER(@storeName))` : ''}
      )
      ORDER BY Seller_ID
    `;

    const params = { sellerId };
    if (storeName) params.storeName = storeName;

    const bigQueryRows = await runQuery(query, params);
    
    // DEBUG: Log actual column names and sample data from BigQuery
    if (bigQueryRows.length > 0) {
      console.log('🔍 BigQuery columns available:', Object.keys(bigQueryRows[0]));
      console.log('📊 Sample row from BigQuery:', {
        'item-name': bigQueryRows[0]['item-name'],
        'item_name': bigQueryRows[0]['item_name'],
        'Item Name': bigQueryRows[0]['Item Name'],
        'Item_Name': bigQueryRows[0]['Item_Name'],
        'all_keys': Object.keys(bigQueryRows[0])
      });
    }
    
    // Get claimed status and other data from Google Sheet
    const authClient = await sheetsClient.getClient();
    const TABLE2_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TABLE2_SHEET_TAB = 'KAM';
    
    const sheetResponse = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TABLE2_SHEET_ID,
      range: `${TABLE2_SHEET_TAB}!A:J`,
    });
    
    const sheetData = sheetResponse.data.values || [];
    const claimedStatusMap = new Map();
    
    // Build map of claimed listings (skip header)
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (row && row.length >= 6) {
        const listingId = row[0];
        const status = row[3];
        const email = row[5];
        if (listingId && status && status.toLowerCase() !== 'unclaimed') {
          claimedStatusMap.set(listingId.trim(), {
            claimed_status: status,
            claimed_by: email,
            last_claim_timestamp: row[4],
            start_time: row[6] || '',
            end_time: row[7] || '',
            item_name: row[8] || '',
            listing_link: row[9] || ''
          });
        }
      }
    }
    
    // Merge BigQuery data with claimed status
    const mergedRows = bigQueryRows.map(row => {
      const listingId = row['listing-id'];
      const asin = row['asin1'] || '';
      const sheetInfo = claimedStatusMap.get(listingId);
      
      if (sheetInfo) {
        return {
          ...row,
          claimed_status: sheetInfo.claimed_status,
          claimed_by: sheetInfo.claimed_by,
          last_claim_timestamp: sheetInfo.last_claim_timestamp,
          start_time: sheetInfo.start_time,
          end_time: sheetInfo.end_time,
          item_name: sheetInfo.item_name,
          listing_link: sheetInfo.listing_link
        };
      }
      
      return {
        ...row,
        claimed_status: 'Unclaimed',
        claimed_by: '',
        last_claim_timestamp: '',
        start_time: '',
        end_time: '',
        item_name: row['item-name'] || '', // Read from BigQuery if available
        listing_link: asin ? `https://www.amazon.in/dp/${asin}` : '' // Generate link from ASIN
      };
    });

    res.json({ 
      success: true, 
      data: mergedRows, 
      sellerId, 
      storeName 
    });

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
  const release = await claimMutex.acquire();
  
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

    // Check user's total claimed ASINs (including previously claimed)
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'userEmail is required',
      });
    }

    // ✅ STEP 1: Check user's existing claims from the sheet
    const TABLE2_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TABLE2_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // Read all data from the sheet
    const existingClaimsResponse = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TABLE2_SHEET_ID,
      range: `${TABLE2_SHEET_TAB}!A:M`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    
    const existingClaims = existingClaimsResponse.data.values || [];
    
    // Count user's currently active claims (Claimed or In Progress, not Completed)
    const asinColumnIndex = 1; // Column B - asin1
    const emailColumnIndex = 5; // Column F - Email_id
    const statusColumnIndex = 3; // Column D - Claimed_Status
    const endTimeColumnIndex = 7; // Column H - End_Time
    
    let userActiveClaimCount = 0;
    const userAsinSet = new Set(); // Track ASINs already claimed by user
    
    // Skip header row
    for (let i = 1; i < existingClaims.length; i++) {
      const row = existingClaims[i];
      if (row && row.length >= 8) {
        const rowEmail = row[emailColumnIndex] ? row[emailColumnIndex].toString().trim().toLowerCase() : '';
        const rowAsin = row[asinColumnIndex] ? row[asinColumnIndex].toString().trim() : '';
        const rowStatus = row[statusColumnIndex] ? row[statusColumnIndex].toString().trim().toLowerCase() : '';
        const rowEndTime = row.length > endTimeColumnIndex ? (row[endTimeColumnIndex] ? row[endTimeColumnIndex].toString().trim() : '') : '';
        
        if (rowEmail === userEmail.toLowerCase() && rowAsin) {
          userAsinSet.add(rowAsin);
          
          // Count as active claim if status is Claimed or In Progress AND End_Time is empty
          if ((rowStatus === 'claimed' || rowStatus === 'in progress') && (!rowEndTime || rowEndTime.trim() === '')) {
            userActiveClaimCount++;
          }
        }
      }
    }

    console.log('📊 User claim status:', {
      userEmail,
      currentlyActiveClaims: userActiveClaimCount,
      totalUniqueAsinsClaimed: userAsinSet.size,
      attemptingToClaim: listings.length
    });

    // Check max limit: user can only have 10 active claims (Claimed or In Progress, without End_Time)
    const totalAfterClaim = userActiveClaimCount + listings.length;
    if (totalAfterClaim > 10) {
      const remainingSlots = 10 - userActiveClaimCount;
      return res.status(400).json({
        success: false,
        error: `You can only claim up to 10 listings at a time. You currently have ${userActiveClaimCount} active claims. You can claim ${remainingSlots} more.`,
        currentActiveClaims: userActiveClaimCount,
        maxAllowed: 10,
        remainingSlots: remainingSlots
      });
    }

    // ✅ STEP 2: Build quick lookup map for claimed listings
    const claimedMap = new Map();
    const asinToRowMap = new Map();
    
    // Skip header row
    for (let i = 1; i < existingClaims.length; i++) {
      const row = existingClaims[i];
      if (row && row.length >= 6) {
        const listingId = row[0] ? row[0].toString().trim() : '';
        const asin = row[1] ? row[1].toString().trim() : '';
        const status = row[3] ? row[3].toString().trim().toLowerCase() : ''; // Column D - Claimed_Status
        const endTime = row.length > 7 ? (row[7] ? row[7].toString().trim() : '') : ''; // Column H - End_Time
        
        if (listingId) {
          claimedMap.set(listingId, {
            claimed: (status === 'claimed' || status === 'in progress'),
            status: row[3] || '', // Column D - Claimed_Status
            claimedBy: row[5] || '', // Column F - Email_id
            claimedAt: row[4] || '', // Column E - Start_Time (when they claimed)
            endTime: endTime,
            rowIndex: i + 1
          });
        }
        
        if (asin) {
          asinToRowMap.set(asin, i + 1);
        }
      }
    }
    
    // ✅ STEP 3: VALIDATE REQUEST AGAINST CURRENT STATE
    const validListings = [];
    const alreadyClaimedListings = [];
    const duplicateAsins = new Set();
    
    listings.forEach(listing => {
      const listingId = listing['listing-id'];
      const asin = listing.asin1 || '';
      
      // Check if listing is already claimed
      if (claimedMap.has(listingId) && claimedMap.get(listingId).claimed) {
        alreadyClaimedListings.push({
          listingId,
          asin,
          claimedBy: claimedMap.get(listingId).claimedBy,
          status: claimedMap.get(listingId).status,
          claimedAt: claimedMap.get(listingId).claimedAt
        });
        return;
      }
      
      // Check for duplicate ASIN in THIS request
      if (asin && duplicateAsins.has(asin)) {
        alreadyClaimedListings.push({
          listingId,
          asin,
          claimedBy: 'Another listing in this batch',
          claimedAt: 'Duplicate in same request'
        });
        return;
      }
      
      // Check if ASIN already exists in sheet (even with different listing-id)
      if (asin && asinToRowMap.has(asin)) {
        const rowNum = asinToRowMap.get(asin);
        const row = existingClaims[rowNum - 1];
        if (row && row[3] && (row[3].toLowerCase() === 'claimed' || row[3].toLowerCase() === 'in progress')) { // Column D - Claimed_Status
          // Check if it's completed (has End_Time)
          const endTime = row.length > 7 ? (row[7] ? row[7].toString().trim() : '') : ''; // Column H - End_Time
          const isCompleted = endTime && endTime.trim() !== '';
          
          alreadyClaimedListings.push({
            listingId,
            asin,
            claimedBy: row[5] || 'another user', // Column F - Email_id
            claimedAt: row[4] || '', // Column E - Start_Time
            status: row[3] || '', // Column D - Claimed_Status
            reason: isCompleted ? 'ASIN already completed' : 'ASIN already claimed'
          });
          return;
        }
      }
      
      duplicateAsins.add(asin);
      validListings.push(listing);
    });
    
    // If all listings are already claimed, return error
    if (validListings.length === 0) {
      return res.json({
        success: false,
        error: alreadyClaimedListings.length > 0 
          ? 'All selected listings are already claimed' 
          : 'No valid listings to claim',
        alreadyClaimed: alreadyClaimedListings,
        claimedCount: 0
      });
    }
    
    // ✅ STEP 4: ATOMIC WRITE - Update sheet in single operation
    const claimedAtIST = toISTTimestamp();
    
    const claimedListingsForSheet = validListings.map(listing => {
      const asin = listing.asin1 || '';
      const listingLink = asin ? `https://www.amazon.in/dp/${asin}` : '';
      
      // Match Google Sheet column order (13 columns):
      // A: listing-id | B: asin1 | C: store_name | D: Claimed_Status | E: Start_Time | F: Email_id | 
      // G: Start_Time | H: End_Time | I: Unclaimed timestamp | J: Unclaimed by | K: status | L: item-name | M: Listing Link
      return [
        listing['listing-id'] || '',                      // A: listing-id
        asin,                                              // B: asin1
        listing.store_name || '',                          // C: store_name
        'Claimed',                                         // D: Claimed_Status
        claimedAtIST,                                      // E: Start_Time (when claimed)
        userEmail,                                         // F: Email_id
        claimedAtIST,                                      // G: Start_Time (duplicate or Last_Claim_Timestamp)
        '',                                                // H: End_Time (empty initially)
        '',                                                // I: Unclaimed timestamp (empty initially)
        '',                                                // J: Unclaimed by (empty initially)
        '',                                                // K: status (empty initially)
        listing['item-name'] || listing.item_name || '',   // L: item-name
        listingLink                                        // M: Listing Link
      ];
    });
    
    // Get the next empty row
    const nextRow = existingClaims.length + 1;
    
    // Update the sheet with batchUpdate to ensure atomic write
    await sheetsApi.spreadsheets.values.batchUpdate({
      auth: authClient,
      spreadsheetId: TABLE2_SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${TABLE2_SHEET_TAB}!A${nextRow}:M${nextRow + claimedListingsForSheet.length - 1}`,
            majorDimension: 'ROWS',
            values: claimedListingsForSheet
          }
        ]
      }
    });
    
    console.log('✅ [CLAIM] Google Sheet updated atomically with IST timestamp:', {
      rowsWritten: claimedListingsForSheet.length,
      startingRow: nextRow,
      timestamp: claimedAtIST,
      spreadsheetId: TABLE2_SHEET_ID,
      tab: TABLE2_SHEET_TAB,
    });
    
    // ✅ SUCCESS RESPONSE
    res.json({
      success: true,
      message: `Successfully claimed ${validListings.length} listing(s)`,
      claimedCount: validListings.length,
      alreadyClaimedCount: alreadyClaimedListings.length,
      alreadyClaimed: alreadyClaimedListings,
      claimedListings: validListings.map(l => l['listing-id']),
      userEmail: userEmail,
      claimedAt: claimedAtIST,
      currentActiveClaims: userActiveClaimCount + validListings.length,
      totalAllowed: 10
    });
    
  } catch (err) {
    console.error('❌ [CLAIM] Error in /api/claim-listings:', err.message || err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to claim listings',
      details: err.message,
    });
  } finally {
    release(); // Release the mutex
  }
});

// ==================================================
// 📌 UPDATE START_TIME IN GOOGLE SHEET ENDPOINT
// ==================================================

/**
 * POST /api/update-start-time
 * Updates Start_Time column in Google Sheet when metadata is loaded
 * Body: { asin: string, email: string }
 */
app.post('/api/update-start-time', async (req, res) => {
  try {
    const { asin, email } = req.body;
    
    if (!asin || !email) {
      return res.status(400).json({
        success: false,
        error: 'Both ASIN and email are required'
      });
    }
    
    console.log('🕐 Updating Start_Time and marking as In Progress:', { asin, email });
    
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }
    
    const TARGET_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TARGET_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // STEP 1: Read all data from the sheet to find matching row
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TARGET_SHEET_ID,
      range: `${TARGET_SHEET_TAB}!A:H`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      return res.json({
        success: false,
        error: 'No data found in sheet',
        updated: false
      });
    }
    
    // STEP 2: Find headers to determine column indices
    const headers = values[0];
    
    // Find column indices
    const asinColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'asin1'
    );
    const emailColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'email_id'
    );
    const statusColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'claimed_status'
    );
    const startTimeColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'start_time'
    );
    
    console.log('📊 Column indices:', {
      asinColumnIndex,
      emailColumnIndex,
      statusColumnIndex,
      startTimeColumnIndex,
      headers: headers.slice(0, 8)
    });
    
    if (asinColumnIndex === -1 || emailColumnIndex === -1) {
      return res.json({
        success: false,
        error: `Required columns not found. Found columns: ${headers.join(', ')}`,
        updated: false
      });
    }
    
    // STEP 3: Find matching row
    let matchingRowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      const rowAsin = row[asinColumnIndex] ? row[asinColumnIndex].toString().trim() : '';
      const rowEmail = row[emailColumnIndex] ? row[emailColumnIndex].toString().trim().toLowerCase() : '';
      
      if (rowAsin === asin && rowEmail === email.toLowerCase()) {
        matchingRowIndex = i;
        console.log(`✅ Found matching row at index ${matchingRowIndex + 1}:`, {
          rowAsin,
          rowEmail
        });
        break;
      }
    }
    
    if (matchingRowIndex === -1) {
      return res.json({
        success: true,
        updated: false,
        message: `No matching row found for ASIN: ${asin} and Email: ${email}`,
        note: 'This is normal if the user/ASIN combination is not in the sheet'
      });
    }
    
    // STEP 4: Generate IST timestamp
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format: YYYY-MM-DD HH:MM:SS
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    const seconds = String(istTime.getSeconds()).padStart(2, '0');
    
    const startTimeValue = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    console.log('🕐 Setting Start_Time to:', startTimeValue);
    
    // STEP 5: Prepare batch updates - Update Start_Time AND Claimed_Status to "In Progress"
    const updates = [];
    
    // Update Start_Time column
    if (startTimeColumnIndex !== -1) {
      updates.push({
        range: `${TARGET_SHEET_TAB}!${String.fromCharCode(65 + startTimeColumnIndex)}${matchingRowIndex + 1}`,
        majorDimension: 'ROWS',
        values: [[startTimeValue]]
      });
    } else if (headers.length > 6) {
      // Add to column G (7th column)
      const columnLetter = String.fromCharCode(65 + 6); // G column
      updates.push({
        range: `${TARGET_SHEET_TAB}!${columnLetter}${matchingRowIndex + 1}`,
        majorDimension: 'ROWS',
        values: [[startTimeValue]]
      });
      
      // Also update header if needed
      updates.push({
        range: `${TARGET_SHEET_TAB}!${columnLetter}1`,
        majorDimension: 'ROWS',
        values: [['Start_Time']]
      });
    }
    
    // Update Claimed_Status to "In Progress"
    if (statusColumnIndex !== -1) {
      updates.push({
        range: `${TARGET_SHEET_TAB}!${String.fromCharCode(65 + statusColumnIndex)}${matchingRowIndex + 1}`,
        majorDimension: 'ROWS',
        values: [['In Progress']]
      });
    }
    
    // STEP 6: Execute batch update
    if (updates.length > 0) {
      await sheetsApi.spreadsheets.values.batchUpdate({
        auth: authClient,
        spreadsheetId: TARGET_SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      
      console.log('✅ Successfully updated Start_Time and marked as In Progress:', {
        asin,
        email,
        startTime: startTimeValue,
        rowNumber: matchingRowIndex + 1
      });
      
      return res.json({
        success: true,
        updated: true,
        message: `Updated Start_Time and marked as In Progress for ASIN ${asin}`,
        startTime: startTimeValue,
        rowNumber: matchingRowIndex + 1
      });
    } else {
      return res.json({
        success: false,
        error: 'Could not update sheet - column indices not found',
        updated: false
      });
    }
    
  } catch (err) {
    console.error('❌ Error updating Start_Time:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      updated: false
    });
  }
});

// ==================================================
// 📌 UPDATE END_TIME IN GOOGLE SHEET ENDPOINT
// ==================================================

/**
 * POST /api/update-end-time
 * Updates End_Time column in Google Sheet when export is completed
 * Also updates Claimed_Status to "Completed"
 * Body: { asin: string, email: string }
 */
app.post('/api/update-end-time', async (req, res) => {
  try {
    const { asin, email } = req.body;
    
    if (!asin || !email) {
      return res.status(400).json({
        success: false,
        error: 'Both ASIN and email are required'
      });
    }
    
    console.log('✅ Updating End_Time and marking as Completed:', { asin, email });
    
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }
    
    const TARGET_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TARGET_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // STEP 1: Read all data from the sheet
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TARGET_SHEET_ID,
      range: `${TARGET_SHEET_TAB}!A:H`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      return res.json({
        success: false,
        error: 'No data found in sheet',
        updated: false
      });
    }
    
    // STEP 2: Find headers to determine column indices
    const headers = values[0];
    
    // Find column indices
    const asinColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'asin1'
    );
    const emailColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'email_id'
    );
    const statusColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'claimed_status'
    );
    const endTimeColumnIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'end_time'
    );
    
    console.log('📊 Column indices:', {
      asinColumnIndex,
      emailColumnIndex,
      statusColumnIndex,
      endTimeColumnIndex,
      headers: headers.slice(0, 8)
    });
    
    if (asinColumnIndex === -1 || emailColumnIndex === -1) {
      return res.json({
        success: false,
        error: `Required columns not found. Found columns: ${headers.join(', ')}`,
        updated: false
      });
    }
    
    // STEP 3: Find matching row
    let matchingRowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      const rowAsin = row[asinColumnIndex] ? row[asinColumnIndex].toString().trim() : '';
      const rowEmail = row[emailColumnIndex] ? row[emailColumnIndex].toString().trim().toLowerCase() : '';
      
      if (rowAsin === asin && rowEmail === email.toLowerCase()) {
        matchingRowIndex = i;
        console.log(`✅ Found matching row at index ${matchingRowIndex + 1}:`, {
          rowAsin,
          rowEmail
        });
        break;
      }
    }
    
    if (matchingRowIndex === -1) {
      return res.json({
        success: true,
        updated: false,
        message: `No matching row found for ASIN: ${asin} and Email: ${email}`,
        note: 'This is normal if the user/ASIN combination is not in the sheet'
      });
    }
    
    // STEP 4: Generate IST timestamp
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const istTime = new Date(now.getTime() + istOffset);
    
    // Format: YYYY-MM-DD HH:MM:SS
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    const hours = String(istTime.getHours()).padStart(2, '0');
    const minutes = String(istTime.getMinutes()).padStart(2, '0');
    const seconds = String(istTime.getSeconds()).padStart(2, '0');
    
    const endTimeValue = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    console.log('✅ Setting End_Time to:', endTimeValue);
    
    // STEP 5: Prepare batch updates - Update End_Time AND Claimed_Status
    const updates = [];
    
    // Update End_Time column
    if (endTimeColumnIndex !== -1) {
      updates.push({
        range: `${TARGET_SHEET_TAB}!${String.fromCharCode(65 + endTimeColumnIndex)}${matchingRowIndex + 1}`,
        majorDimension: 'ROWS',
        values: [[endTimeValue]]
      });
    } else if (headers.length > 7) {
      // Add to column H (8th column)
      const columnLetter = String.fromCharCode(65 + 7); // H column
      updates.push({
        range: `${TARGET_SHEET_TAB}!${columnLetter}${matchingRowIndex + 1}`,
        majorDimension: 'ROWS',
        values: [[endTimeValue]]
      });
      
      // Also update header if needed
      updates.push({
        range: `${TARGET_SHEET_TAB}!${columnLetter}1`,
        majorDimension: 'ROWS',
        values: [['End_Time']]
      });
    }
    
    // Update Claimed_Status to "Completed"
    if (statusColumnIndex !== -1) {
      updates.push({
        range: `${TARGET_SHEET_TAB}!${String.fromCharCode(65 + statusColumnIndex)}${matchingRowIndex + 1}`,
        majorDimension: 'ROWS',
        values: [['Completed']]
      });
    }
    
    // STEP 6: Execute batch update
    if (updates.length > 0) {
      await sheetsApi.spreadsheets.values.batchUpdate({
        auth: authClient,
        spreadsheetId: TARGET_SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      
      console.log('✅ Successfully updated End_Time and marked as Completed:', {
        asin,
        email,
        endTime: endTimeValue,
        rowNumber: matchingRowIndex + 1
      });
      
      return res.json({
        success: true,
        updated: true,
        message: `Updated End_Time and marked as Completed for ASIN ${asin}`,
        endTime: endTimeValue,
        rowNumber: matchingRowIndex + 1
      });
    } else {
      return res.json({
        success: false,
        error: 'Could not update sheet - column indices not found',
        updated: false
      });
    }
    
  } catch (err) {
    console.error('❌ Error updating End_Time:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      updated: false
    });
  }
});

// ==================================================
// 📌 USER CLAIMED ASINS ENDPOINT (UPDATED)
// ==================================================

/**
 * POST /api/user-claimed-asins
 * Get user's claimed ASINs with their status
 * Only returns ASINs with status: "Claimed" or "In Progress"
 * Excludes: "Completed", "Unclaimed"
 */
app.post('/api/user-claimed-asins', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    
    console.log('🔍 [USER-CLAIMED-ASINS] Fetching active ASINs for email:', email);
    
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }
    
    const TARGET_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TARGET_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // Read all data from the sheet (up to column H for End_Time)
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TARGET_SHEET_ID,
      range: `${TARGET_SHEET_TAB}!A:H`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      console.log('📭 No data found in the sheet');
      return res.json({
        success: true,
        claimedAsins: []
      });
    }
    
    // Column indices
    const listingIdIndex = 0; // Column A - listing-id
    const asinIndex = 1;      // Column B - ASIN1
    const storeNameIndex = 2; // Column C - store_name
    const statusIndex = 3;    // Column D - Claimed_Status
    const timestampIndex = 4; // Column E - Last_Claim_Timestamp
    const emailIndex = 5;     // Column F - Email_id
    const startTimeIndex = 6; // Column G - Start_Time
    const endTimeIndex = 7;   // Column H - End_Time
    
    const headers = values[0];
    console.log('📋 Sheet headers:', headers);
    
    const userEmailLower = email.toLowerCase();
    const claimedAsins = [];
    
    console.log(`🔍 Scanning ${values.length - 1} rows for user: ${email}`);
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      
      // Ensure row has enough columns
      if (row.length < 6) continue;
      
      const rowEmail = row[emailIndex] ? row[emailIndex].toString().trim().toLowerCase() : '';
      const rowAsin = row[asinIndex] ? row[asinIndex].toString().trim() : '';
      const rowStatus = row[statusIndex] ? row[statusIndex].toString().trim() : '';
      const rowStartTime = row.length > startTimeIndex ? (row[startTimeIndex] ? row[startTimeIndex].toString().trim() : '') : '';
      const rowEndTime = row.length > endTimeIndex ? (row[endTimeIndex] ? row[endTimeIndex].toString().trim() : '') : '';
      
      // Check if this row belongs to the user AND status is not "Unclaimed" or "Completed"
      if (rowEmail === userEmailLower && rowAsin && rowStatus) {
        const rowStatusLower = rowStatus.toLowerCase();
        
        // Skip if status is Unclaimed or Completed
        if (rowStatusLower === 'unclaimed' || rowStatusLower === 'completed') {
          continue;
        }
        
        console.log(`Row ${i + 1}: ASIN="${rowAsin}", Status="${rowStatus}", StartTime="${rowStartTime}", EndTime="${rowEndTime}"`);
        
        // Determine status based on logic
        let finalStatus = rowStatus;
        let canEdit = false;
        let isCompleted = false;
        let isInProgress = false;
        
        if (rowStatusLower === 'claimed') {
          if (rowEndTime && rowEndTime.trim() !== '') {
            finalStatus = 'Completed';
            isCompleted = true;
            canEdit = false;
          } else if (rowStartTime && rowStartTime.trim() !== '') {
            finalStatus = 'In Progress';
            isInProgress = true;
            canEdit = true;
          } else {
            finalStatus = 'Claimed';
            canEdit = true;
          }
        } else if (rowStatusLower === 'in progress') {
          isInProgress = true;
          canEdit = true;
        }
        
        // Only include ASINs that are Claimed or In Progress
        if (finalStatus.toLowerCase() === 'claimed' || finalStatus.toLowerCase() === 'in progress') {
          claimedAsins.push({
            asin: rowAsin,
            status: finalStatus,
            startTime: rowStartTime,
            endTime: rowEndTime,
            isCompleted: isCompleted,
            isInProgress: isInProgress,
            canEdit: canEdit,
            rowIndex: i + 1,
            listingId: row[listingIdIndex] || '',
            storeName: row[storeNameIndex] || ''
          });
          
          console.log(`   Status: ${finalStatus}, canEdit: ${canEdit}`);
        }
      }
    }
    
    console.log(`✅ Total active ASINs found for user ${email}: ${claimedAsins.length}`);
    
    // Remove duplicates - keep only unique ASINs (take the latest if there are duplicates)
    const uniqueAsins = [];
    const seenAsins = new Set();
    
    // Sort by row index descending to get the latest entries first
    claimedAsins.sort((a, b) => b.rowIndex - a.rowIndex);
    
    for (const asinData of claimedAsins) {
      if (!seenAsins.has(asinData.asin)) {
        seenAsins.add(asinData.asin);
        uniqueAsins.push(asinData);
      }
    }
    
    console.log(`📊 Final unique ASINs: ${uniqueAsins.length}`);
    console.log('📋 Summary:');
    uniqueAsins.forEach(asinData => {
      console.log(`   ASIN: ${asinData.asin}, Status: "${asinData.status}", canEdit: ${asinData.canEdit}`);
    });
    
    return res.json({
      success: true,
      claimedAsins: uniqueAsins,
      totalRowsScanned: values.length - 1,
      userEmail: email
    });
    
  } catch (err) {
    console.error('❌ Error fetching user claimed ASINs:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      claimedAsins: []
    });
  }
});

// ==================================================
// 📌 CHECK ASIN COMPLETION STATUS ENDPOINT (UPDATED)
// ==================================================

/**
 * POST /api/check-asin-completion
 * Check if ASIN is completed and return status
 */
app.post('/api/check-asin-completion', async (req, res) => {
  try {
    const { asin, email } = req.body;
    
    if (!asin || !email) {
      return res.status(400).json({
        success: false,
        error: 'Both ASIN and email are required'
      });
    }
    
    console.log('🔍 Checking completion status for:', { asin, email });
    
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }
    
    const TARGET_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TARGET_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // Read all data from the sheet
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TARGET_SHEET_ID,
      range: `${TARGET_SHEET_TAB}!A:H`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      return res.json({
        success: true,
        status: 'not_found',
        isCompleted: false,
        isInProgress: false,
        canEdit: false
      });
    }
    
    // Column indices
    const asinColumnIndex = 1;      // Column B - ASIN1
    const emailColumnIndex = 5;     // Column F - Email_id
    const statusColumnIndex = 3;    // Column D - Claimed_Status
    const endTimeColumnIndex = 7;   // Column H - End_Time
    const startTimeColumnIndex = 6; // Column G - Start_Time
    
    const userEmailLower = email.toLowerCase();
    
    // Find the specific ASIN for this user
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      if (row.length < 6) continue;
      
      const rowEmail = row[emailColumnIndex] ? row[emailColumnIndex].toString().trim().toLowerCase() : '';
      const rowAsin = row[asinColumnIndex] ? row[asinColumnIndex].toString().trim() : '';
      const rowStatus = row[statusColumnIndex] ? row[statusIndex].toString().trim() : '';
      const rowEndTime = row.length > endTimeColumnIndex ? (row[endTimeColumnIndex] ? row[endTimeColumnIndex].toString().trim() : '') : '';
      const rowStartTime = row.length > startTimeColumnIndex ? (row[startTimeColumnIndex] ? row[startTimeColumnIndex].toString().trim() : '') : '';
      
      if (rowEmail === userEmailLower && rowAsin === asin) {
        // Determine status based on logic
        let finalStatus = rowStatus;
        let canEdit = false;
        let isCompleted = false;
        let isInProgress = false;
        
        if (rowStatus.toLowerCase() === 'claimed') {
          if (rowEndTime && rowEndTime.trim() !== '') {
            finalStatus = 'Completed';
            isCompleted = true;
            canEdit = false;
          } else if (rowStartTime && rowStartTime.trim() !== '') {
            finalStatus = 'In Progress';
            isInProgress = true;
            canEdit = true;
          } else {
            finalStatus = 'Claimed';
            canEdit = true;
          }
        } else if (rowStatus.toLowerCase() === 'completed') {
          isCompleted = true;
          canEdit = false;
        } else if (rowStatus.toLowerCase() === 'in progress') {
          isInProgress = true;
          canEdit = true;
        } else if (rowStatus.toLowerCase() === 'unclaimed') {
          canEdit = false;
        }
        
        return res.json({
          success: true,
          status: finalStatus,
          isCompleted: isCompleted,
          isInProgress: isInProgress,
          hasEndTime: !!rowEndTime && rowEndTime.trim() !== '',
          hasStartTime: !!rowStartTime && rowStartTime.trim() !== '',
          endTime: rowEndTime,
          startTime: rowStartTime,
          canEdit: canEdit
        });
      }
    }
    
    // ASIN not found for this user
    return res.json({
      success: true,
      status: 'not_found',
      isCompleted: false,
      isInProgress: false,
      canEdit: false
    });
    
  } catch (err) {
    console.error('❌ Error checking ASIN completion:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==================================================
// 📌 CLAIMED LISTINGS DASHBOARD ENDPOINT
// ==================================================

/**
 * GET /api/claimed-listings
 * Get all claimed listings for Lead/Admin dashboard
 */
app.get('/api/claimed-listings', async (req, res) => {
  try {
    console.log('🔍 [CLAIMED-LISTINGS] Fetching claimed listings for Lead/Admin dashboard');
    
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }
    
    const TARGET_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TARGET_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // Read all data from the sheet (up to column H for End_Time)
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TARGET_SHEET_ID,
      range: `${TARGET_SHEET_TAB}!A:H`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      console.log('📭 No data found in the sheet');
      return res.json({
        success: true,
        listings: [],
        total: 0
      });
    }
    
    // Column indices
    const listingIdIndex = 0;     // Column A - listing-id
    const asinIndex = 1;          // Column B - ASIN1
    const storeNameIndex = 2;     // Column C - store_name
    const statusIndex = 3;        // Column D - Claimed_Status
    const timestampIndex = 4;     // Column E - Last_Claim_Timestamp
    const emailIndex = 5;         // Column F - Email_id
    const startTimeIndex = 6;     // Column G - Start_Time
    const endTimeIndex = 7;       // Column H - End_Time
    
    const headers = values[0] || [];
    console.log('📋 Sheet headers:', headers);
    
    const listings = [];
    
    // Skip header row
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      
      // Check if row has basic data (at least listing-id)
      if (row.length < 1 || !row[listingIdIndex]) continue;
      
      const listing = {
        'listing-id': row[listingIdIndex] ? row[listingIdIndex].toString().trim() : '',
        asin1: row[asinIndex] ? row[asinIndex].toString().trim() : '',
        store_name: row[storeNameIndex] ? row[storeNameIndex].toString().trim() : '',
        Claimed_Status: row[statusIndex] ? row[statusIndex].toString().trim() : '',
        Last_Claim_Timestamp: row[timestampIndex] ? row[timestampIndex].toString().trim() : '',
        Email_id: row[emailIndex] ? row[emailIndex].toString().trim() : '',
        Start_Time: row.length > startTimeIndex ? (row[startTimeIndex] ? row[startTimeIndex].toString().trim() : '') : '',
        End_Time: row.length > endTimeIndex ? (row[endTimeIndex] ? row[endTimeIndex].toString().trim() : '') : '',
        rowIndex: i + 1
      };
      
      listings.push(listing);
    }
    
    console.log(`✅ Loaded ${listings.length} total listings from sheet`);
    
    return res.json({
      success: true,
      listings: listings,
      total: listings.length,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${TARGET_SHEET_ID}/edit`,
      sheetTab: TARGET_SHEET_TAB
    });
    
  } catch (err) {
    console.error('❌ Error fetching claimed listings:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      listings: []
    });
  }
});

// ==================================================
// 📌 UNCLAIM LISTING ENDPOINT
// ==================================================

/**
 * POST /api/unclaim-listing
 * Unclaim a listing (Lead/Admin only)
 */
app.post('/api/unclaim-listing', async (req, res) => {
  try {
    const { listingId, unclaimedBy } = req.body;
    
    if (!listingId || !unclaimedBy) {
      return res.status(400).json({
        success: false,
        error: 'Both listingId and unclaimedBy are required'
      });
    }
    
    console.log('🔓 [UNCLAIM] Request to unclaim listing:', { listingId, unclaimedBy });
    
    if (!sheetsClient || !sheetsApi) {
      throw new Error('Google Sheets API not initialized');
    }
    
    const TARGET_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TARGET_SHEET_TAB = 'KAM';
    
    const authClient = await sheetsClient.getClient();
    
    // Read all data from the sheet
    const response = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TARGET_SHEET_ID,
      range: `${TARGET_SHEET_TAB}!A:H`,
    });
    
    const values = response.data.values;
    
    if (!values || values.length === 0) {
      return res.json({
        success: false,
        error: 'No data found in sheet',
        updated: false
      });
    }
    
    // Find headers
    const headers = values[0];
    
    // Find column indices
    const listingIdIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'listing-id'
    );
    const statusIndex = headers.findIndex(h => 
      h && h.toString().trim().toLowerCase() === 'claimed_status'
    );
    
    // Find the listing to unclaim
    let matchingRowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i] || [];
      const rowListingId = row[listingIdIndex] ? row[listingIdIndex].toString().trim() : '';
      
      if (rowListingId === listingId.toString().trim()) {
        matchingRowIndex = i;
        console.log(`✅ Found matching listing at row ${matchingRowIndex + 1}`);
        break;
      }
    }
    
    if (matchingRowIndex === -1) {
      return res.json({
        success: false,
        error: `Listing ID ${listingId} not found in sheet`,
        updated: false
      });
    }
    
    // Prepare updates
    const updates = [];
    
    // Update Claimed_Status to 'Unclaimed'
    if (statusIndex !== -1) {
      updates.push({
        range: `${TARGET_SHEET_TAB}!${String.fromCharCode(65 + statusIndex)}${matchingRowIndex + 1}`,
        values: [['Unclaimed']]
      });
    }
    
    // Execute batch update
    if (updates.length > 0) {
      await sheetsApi.spreadsheets.values.batchUpdate({
        auth: authClient,
        spreadsheetId: TARGET_SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates
        }
      });
      
      console.log('✅ Successfully unclaimed listing:', {
        listingId,
        unclaimedBy,
        rowNumber: matchingRowIndex + 1
      });
      
      return res.json({
        success: true,
        updated: true,
        message: `Successfully unclaimed listing ${listingId}`,
        listingId,
        unclaimedBy,
        rowNumber: matchingRowIndex + 1
      });
    } else {
      return res.json({
        success: false,
        error: 'Could not update sheet - column indices not found',
        updated: false
      });
    }
    
  } catch (err) {
    console.error('❌ Error unclaiming listing:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
      updated: false
    });
  }
});

// ==================================================
// 📌 CHECK LISTING CLAIMS ENDPOINT
// ==================================================

app.post('/api/check-listing-claim', async (req, res) => {
  try {
    const { listingIds } = req.body;
    
    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'listingIds array is required'
      });
    }

    const authClient = await sheetsClient.getClient();
    const TABLE2_SHEET_ID = '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs';
    const TABLE2_SHEET_TAB = 'KAM';
    
    // Get all claimed listings
    const sheetResponse = await sheetsApi.spreadsheets.values.get({
      auth: authClient,
      spreadsheetId: TABLE2_SHEET_ID,
      range: `${TABLE2_SHEET_TAB}!A:H`,
    });
    
    const sheetData = sheetResponse.data.values || [];
    const claimedMap = new Map();
    
    // Build map (skip header)
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (row && row.length >= 6) {
        const listingId = row[0];
        const status = row[3];
        if (listingId && status && status.toLowerCase() !== 'unclaimed' && status.toLowerCase() !== 'completed') {
          claimedMap.set(listingId.trim(), {
            claimed: true,
            claimed_by: row[5],
            claimed_at: row[4],
            status: row[3]
          });
        }
      }
    }
    
    // Check each requested listingId
    const results = {};
    listingIds.forEach(id => {
      const claimInfo = claimedMap.get(id);
      results[id] = claimInfo || { claimed: false };
    });

    res.json({
      success: true,
      results,
      totalChecked: listingIds.length,
      totalClaimed: Object.values(results).filter(r => r.claimed).length
    });

  } catch (err) {
    console.error('❌ Error in /api/check-listing-claim:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================
// 📌 SEARCH SELLERS ENDPOINT
// ==================================================

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
    totalRows: appendValues.length,
    updatedRows,
    tabName,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  };
}

// ==================================================
// 📌 GOOGLE SHEETS UPLOAD ENDPOINT
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
// 🚀 Health Check Endpoint for Cloud Run
// ==================================================

app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      bigQuery: !!bigquery,
      googleSheets: !!(sheetsClient && sheetsApi),
      port: PORT,
      environment: process.env.NODE_ENV || 'development'
    }
  };
  
  res.json(healthStatus);
});

// ==================================================
// 🚀 Start Server
// ==================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🌐 Allowed Origins: ${getAllowedOrigins().join(', ')}`);
  console.log(bigquery ? "🟢 BigQuery ACTIVE (ADC)" : "🔴 BigQuery DISABLED");
  console.log(sheetsClient && sheetsApi ? "📊 Google Sheets Integration: ACTIVE (ADC)" : "📊 Google Sheets Integration: DISABLED");
  console.log("🔍 Dual Scraper System: READY");
  console.log("📤 BigQuery Insert Endpoint: READY");
  console.log("📤 Google Sheets Upload Endpoint: READY");
  console.log("📡 Combined Export Endpoint: READY (/api/gcp/combined-export)");
  console.log("🕐 Start_Time Update Endpoint: READY (/api/update-start-time)");
  console.log("✅ End_Time Update Endpoint: READY (/api/update-end-time)");
  console.log("📧 User Claimed ASINs Endpoint: READY (/api/user-claimed-asins)");
  console.log("🔍 Check ASIN Completion Endpoint: READY (/api/check-asin-completion)");
  console.log("👥 Seller Allocation System: READY");
  console.log("📋 Table 2 - Claim Listings: READY (/api/claim-listings)");
  console.log("   ├─ Max 10 listings per claim");
  console.log("   ├─ Status Flow: Claimed → In Progress → Completed");
  console.log("   └─ Updates Google Sheet (1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs)");
  console.log("📊 Claimed Listings Dashboard: READY (/api/claimed-listings)");
  console.log("🔓 Unclaim Listing: READY (/api/unclaim-listing)");
  console.log("🏥 Health Check: READY (/health)");
});
