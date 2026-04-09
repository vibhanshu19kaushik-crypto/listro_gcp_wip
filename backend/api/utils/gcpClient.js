/**
 * utils/gcpClient.js
 * 
 * Unified GCP Client initialization (BigQuery, Storage, Sheets).
 * Replaces ad-hoc client initialization logic from legacy server.js.
 * Utilizes ADC (Application Default Credentials) for secure authentication.
 */
const { BigQuery } = require('@google-cloud/bigquery');
const { Storage } = require('@google-cloud/storage');
const { google } = require('googleapis');
const config = require('../config');

/**
 * Shared Google Cloud Clients for Listro Backend
 * Uses Application Default Credentials (ADC) for seamless local/Cloud Run auth.
 */

let bigquery = null;
let storage = null;
let sheetsApi = null;
let googleAuth = null;

const { projectId } = config.gcp;

try {
  console.log("🔧 Initializing GCP Clients with Project ID:", projectId);

  // 1. BigQuery
  bigquery = new BigQuery({ projectId });
  
  // 2. Cloud Storage
  storage = new Storage({ projectId });

  // 3. Google Sheets API via googleapis
  googleAuth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    projectId: projectId
  });
  sheetsApi = google.sheets({ version: 'v4', auth: googleAuth });

  console.log("✅ GCP Clients (BigQuery, Storage, Sheets) initialized successfully via ADC.");
} catch (err) {
  console.error("❌ Failed to initialize GCP Clients:", err.message);
}

/**
 * Generic query runner for BigQuery
 */
async function runQuery(query, params = {}) {
  if (!bigquery) throw new Error("BigQuery client not initialized");
  const [rows] = await bigquery.query({ query, params });
  return rows;
}

module.exports = {
  bigquery,
  storage,
  sheetsApi,
  googleAuth,
  runQuery,
  projectId
};
