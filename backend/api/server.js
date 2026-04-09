// server.js (Cloud Run Production Version)
// Updated for Cloud Run with ADC authentication

/**
 * server.js
 * 
 * Entry point for the modularized Listro Backend.
 * This file has been refactored from a 4000+ line monolith to a clean router entry point.
 * Core Logic resides in:
 * - backend/routes/      : API endpoint definitions
 * - backend/services/    : Business logic & data processing
 * - backend/utils/       : Shared utilities (GCP clients)
 * - backend/config/      : Environmental constants
 */
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const { BigQuery } = require('@google-cloud/bigquery');
const { google } = require('googleapis');

// --- New Modular Core ---
const config = require('./config');
const { errorHandler, APIError } = require('./middleware/errorHandler');


// ==================================================

// ==================================================
// 📌 SELLER ALLOCATION SHEET CONFIG
// ==================================================
const app = express();
const PORT = config.port;

// ✅ Centralized CORS configuration
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = config.cors.allowedOrigins;
      if (!origin || allowed.includes(origin) || (config.cors.customOrigin && origin === config.cors.customOrigin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked for origin: ${origin}`);
        callback(null, true); // Permissive for WIP, but logged
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

// Implement the new modular routing architecture alongside the monolithic routes
const sheetRoutes = require('./routes/sheetRoutes');
const gcpRoutes = require('./routes/gcpRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const homeKitchenRoutes = require('./routes/homeKitchenRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const scrapingRoutes = require('./routes/scrapingRoutes');

app.use('/api', sheetRoutes);
app.use('/api/gcp', gcpRoutes);
app.use('/api', allocationRoutes);
app.use('/api', auditRoutes);
app.use('/api', homeKitchenRoutes);
app.use('/api', mediaRoutes);
app.use('/api', scrapingRoutes);




// --- Entry Point Initialization ---
// toISTTimestamp moved to allocationService.js


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

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      bigQuery: !!bigquery,
      googleSheets: !!(sheetsClient && sheetsApi),
      port: config.port,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

async function runQuery(query, params = {}) {
  if (!bigquery) throw new Error("BigQuery not initialized");
  const [rows] = await bigquery.query({ query, params });
  return rows;
}

// --- Legacy Home & Kitchen logic REMOVED (Moved to services/homeKitchenService.js) ---


// ==================================================
// �🚀 Start Server
// ==================================================
// 404 Handler for undefined routes
app.use((req, res, next) => {
  const err = new Error(`Route ${req.originalUrl} not found`);
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  next(err);
});

// Standardized Global Error Handling Middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`🌐 Allowed Origins: ${config.cors.allowedOrigins.join(', ')}`);
  console.log(bigquery ? "🟢 BigQuery ACTIVE (ADC)" : "🔴 BigQuery DISABLED");
  console.log(sheetsClient && sheetsApi ? "📊 Google Sheets Integration: ACTIVE (ADC)" : "📊 Google Sheets Integration: DISABLED");
  console.log("🔍 Dual Scraper System: READY");
  console.log("📤 BigQuery Insert Endpoint: READY");
  console.log("📤 Google Sheets Upload Endpoint: READY");
  console.log("📡 Combined Export Endpoint: READY (/api/gcp/combined-export)");
  console.log("🕐 Start_Time Update Endpoint: READY (/api/update-start-time)");
  console.log("✅ End_Time Update Endpoint: READY (/api/update-end-time)");
  console.log("🏥 Health Check: READY (/health)");
});



