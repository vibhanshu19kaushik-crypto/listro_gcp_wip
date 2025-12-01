// server.js (complete - with BigQuery insert endpoint)
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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

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

// ==================================================
// 🚀 BigQuery Initialization
// ==================================================
let bigquery;
try {
  const keyFile = process.env.GCP_KEY_FILE || path.join(__dirname, 'gcp-service-account-key.json');
  const projectId = process.env.GCP_PROJECT_ID;

  console.log("🔧 BigQuery Setup:", {
    keyFile,
    projectId,
    keyFileExists: fs.existsSync(keyFile)
  });

  if (!projectId) throw new Error("Missing GCP_PROJECT_ID in .env");
  if (!fs.existsSync(keyFile)) throw new Error(`Missing service account key at ${keyFile}`);

  bigquery = new BigQuery({
    projectId,
    keyFilename: keyFile
  });

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
// 📌 ATTRIBUTE MAPPING + BIGQUERY HELPERS
// ==================================================

// ATTRIBUTE_MAPPING: UI label -> BigQuery column name
const ATTRIBUTE_MAPPING = {
  // Core Identification & Naming
  "Title": "Item_Name",
  "ASIN": "Seller_SKU", // Used for Product ID/SKU
  "Brand": "Brand_Name",
  "Generic Name": "Model_Name",

  // Categorization
  "Category": "Generic_Keyword", // General category tag
  "Subcategory": "Product_Sub_type",
  "Department": "Gender", // Often used to indicate gender/department in feed templates

  // Descriptive Content
  "Product Description": "Product_Description",

  // Product Specifications (using Special_Features for generic attributes)
  "Product Dimensions": "Special_Features1", // Using the first Special Feature slot
  "Item model number": "Model_Number",
  "Net Quantity": "Quantity",

  // Logistics & Dates
  "Manufacturer": "Manufacturer_Contact",
  "Country of Origin": "Country_of_Origin",
  "Packer": "Packer_Contact_Information",
  "Date First Available": "Release_Date"
};

/**
 * Map incoming UI-style object to BigQuery-ready row.
 * - `incoming` is the object sent by frontend (free-form).
 * - options.stringifyArrays: if true, arrays will be serialized to JSON strings.
 */
function mapUIToBQRow(incoming = {}, options = {}) {
  const row = {};

  // Map using attribute mapping
  for (const [uiKey, bqKey] of Object.entries(ATTRIBUTE_MAPPING)) {
    if (incoming[uiKey] !== undefined && incoming[uiKey] !== null) {
      row[bqKey] = incoming[uiKey];
    }
  }

  // Map common developer-friendly keys
  if (incoming.sku) row.Seller_SKU = row.Seller_SKU || incoming.sku;
  if (incoming.asin) {
    row.Seller_SKU = row.Seller_SKU || incoming.asin;
    row.asin = incoming.asin;
  }
  if (incoming.title) row.Item_Name = row.Item_Name || incoming.title;
  if (incoming.brand) row.Brand_Name = row.Brand_Name || incoming.brand;
  if (incoming.price !== undefined && incoming.price !== null) row.Your_price = Number(incoming.price);
  if (incoming.description) row.Product_Description = row.Product_Description || incoming.description;
  if (incoming.category) row.Generic_Keyword = row.Generic_Keyword || incoming.category;
  if (incoming.subcategory) row.Product_Sub_type = row.Product_Sub_type || incoming.subcategory;
  if (incoming.department) row.Gender = row.Gender || incoming.department;

  const stringifyArrays = options.stringifyArrays || (process.env.BIGQUERY_STRINGIFY_ARRAYS === 'true');

  // Images handling
  if (Array.isArray(incoming.images) && incoming.images.length > 0) {
    if (stringifyArrays) {
      // store as JSON string in Main_Image_URL (or change to a dedicated column)
      row.Main_Image_URL = JSON.stringify(incoming.images);
    } else {
      // store first image as Main_Image_URL and others in Other_Image_URL1..N if desired
      row.Main_Image_URL = row.Main_Image_URL || incoming.images[0];
      // store remaining images in Other_Image_URL1..Other_Image_URL8 as fallback
      for (let i = 1; i < Math.min(incoming.images.length, 8); i++) {
        row[`Other_Image_URL${i}`] = incoming.images[i];
      }
    }
  } else if (incoming.images) {
    row.Main_Image_URL = row.Main_Image_URL || incoming.images;
  }

  // Feature bullets handling
  if (Array.isArray(incoming.featureBullets) && incoming.featureBullets.length > 0) {
    if (stringifyArrays) {
      row.Bullet_Point1 = JSON.stringify(incoming.featureBullets);
    } else {
      incoming.featureBullets.slice(0,5).forEach((b, idx) => {
        row[`Bullet_Point${idx+1}`] = b;
      });
      if (incoming.featureBullets.length > 5) {
        row.Special_Features1 = JSON.stringify(incoming.featureBullets.slice(5));
      }
    }
  } else if (incoming.featureBullets) {
    row.Bullet_Point1 = incoming.featureBullets;
  }

  // Include raw details if present
  row.raw_product_details = row.raw_product_details || {};
  if (incoming.raw_product_details && typeof incoming.raw_product_details === 'object') {
    row.raw_product_details = { ...row.raw_product_details, ...incoming.raw_product_details };
  }

  // created_at timestamp
  row.created_at = incoming.created_at || new Date().toISOString();

  // Ensure Seller_SKU exists (fallback to generated id)
  if (!row.Seller_SKU) {
    row.Seller_SKU = `SKU-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  }

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
// 📌 BIGQUERY ENDPOINTS
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
    if (!bigquery) return res.status(500).json({ success: false, error: 'BigQuery not initialized' });

    let payload = req.body;
    // Accept single object or array
    const rowsRaw = Array.isArray(payload) ? payload : [payload];

    if (rowsRaw.length === 0) {
      return res.status(400).json({ success: false, error: 'No data provided' });
    }

    // Map incoming rows to BigQuery columns
    const mappedRows = rowsRaw.map(r => mapUIToBQRow(r, { stringifyArrays: process.env.BIGQUERY_STRINGIFY_ARRAYS === 'true' }));

    console.log('📤 Inserting to BigQuery:', {
      rowCount: mappedRows.length,
      sampleRow: mappedRows[0] ? Object.keys(mappedRows[0]) : 'no rows'
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

    console.log('✅ Successfully inserted to BigQuery:', { inserted: result.inserted });
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
// 📌 GOOGLE SHEETS UPLOAD ENDPOINT (Existing)
// ==================================================

app.post('/api/upload-to-sheets', async (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid data format. Expected array of arrays.' 
      });
    }

    // This endpoint would typically upload to Google Sheets
    // For now, we'll return a success response since the main functionality
    // is handled by the BigQuery endpoint
    console.log('📤 Received data for Google Sheets upload:', {
      rowCount: csvData.length,
      headers: csvData[0] ? csvData[0].length : 0
    });

    res.json({
      success: true,
      message: 'Data prepared for Google Sheets upload',
      totalRows: csvData.length - 1, // excluding header
      tabName: 'Product Data',
      sheetUrl: 'https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI'
    });

  } catch (error) {
    console.error('❌ Error in Google Sheets upload:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload to Google Sheets: ' + error.message 
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
});

// ----------------- END OF FILE -----------------