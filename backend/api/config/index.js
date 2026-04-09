/**
 * config/index.js
 * 
 * Centralized configuration for the modular Listro Backend.
 * Replaces hardcoded strings from legacy server.js with environment-aware constants.
 */
require('dotenv').config();

const config = {
  // Server Port
  port: process.env.PORT || 4001,

  // GCP Configuration
  gcp: {
    projectId: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'ops-excellence',
    gcsBucketName: "listro-image-store",
    datasetId: process.env.BIGQUERY_DATASET || 'Amazon_Listing',
    tableId: process.env.BIGQUERY_TABLE || 'amazon_product_data',
  },

  // Spreadsheet Configuration
  sheets: {
    allocationSheetId: '1MlqeJixTmp6Cj2FSkGLsN08OBP9Kx5565NuxGrb0v18',
    allocationSheetTab: 'Data',
    kamSheetId: '1xW-EPvia-VsBE0N7xTE94kxhdZgJ3LGtY6uZ-bRo_Rs',
    kamSheetTab: 'KAM',
    csvUrls: {
      main: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=75817034`,
      golden: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=62256398`,
      homeKitchen: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=595415787`,
      electronics: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=1045343195`,
      beauty: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=2015214996`,
      healthPersonalCare: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=459027410`,
      grocery: `https://docs.google.com/spreadsheets/d/1C6s96_hmDTYjwwkq5r4ekAh5FrtAvPJqN54WwYl_eVI/export?format=csv&gid=644738797`
    }
  },

  // CORS Configuration
  cors: {
    allowedOrigins: [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5174', // New port for WIP branch
      'https://listrov3-frontend-648176215467.asia-south1.run.app',
      'https://listrov4-frontend-648176215467.asia-south1.run.app',
      'https://listrov4-frontend-mzhpbbuvma-el.a.run.app',
      'https://listro-imagen-frontend-648176215467.asia-south1.run.app'
    ],
    customOrigin: process.env.FRONTEND_ORIGIN
  }
};

module.exports = config;
