/**
 * auditService.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js (approx lines 1958-3200)
 * Handles Start/End time tracking, UI-to-BigQuery mapping, and streaming exports.
 */
const { sheetsApi, sheetsClient, bigquery, runQuery } = require('../utils/gcpClient');
const config = require('../config');
const { toISTTimestamp } = require('./allocationService');

const { 
  kamSheetId: KAM_SHEET_ID, 
  kamSheetTab: KAM_SHEET_TAB,
  datasetId: DATASET_ID,
  tableId: TABLE_ID
} = config.gcp;

const KAM_ID = config.sheets.kamSheetId;
const KAM_TAB = config.sheets.kamSheetTab;

/**
 * Maps UI incoming data to BigQuery schema
 */
function mapUIToBQRow(incoming, options = {}) {
  const row = {
    Seller_ID: incoming.seller_id || "",
    Store_Name: incoming.store_name || "",
    SKU_Status: incoming.sku_status || "Active",
    Listing_ID: incoming.listing_id || incoming['listing-id'] || "",
    ASIN: incoming.asin1 || incoming.asin || "",
    Product_Name: incoming.product_name || "",
    Brand: incoming.brand || "",
    Category: incoming.category || "",
    Sub_Category: incoming.sub_category || "",
    Gender: incoming.gender || incoming.department || "",
    Your_price: String(incoming.price || ""),
    Attributes: JSON.stringify(incoming.attributes || {}),
    Main_Image_URL: "",
    Other_Image_URL1: "",
    Other_Image_URL2: "",
    Other_Image_URL3: "",
    Other_Image_URL4: "",
    Other_Image_URL5: "",
    Bullet_Point1: "",
    Bullet_Point2: "",
    Bullet_Point3: "",
    Bullet_Point4: "",
    Bullet_Point5: "",
    Date: new Date().toISOString().split('T')[0],
    Seller_SKU: incoming.seller_sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  };

  // Image handling
  if (Array.isArray(incoming.images) && incoming.images.length > 0) {
    row.Main_Image_URL = incoming.images[0];
    for (let i = 1; i < Math.min(incoming.images.length, 6); i++) {
        row[`Other_Image_URL${i}`] = incoming.images[i];
    }
  }

  // Bullets handling
  if (Array.isArray(incoming.featureBullets) && incoming.featureBullets.length > 0) {
    incoming.featureBullets.slice(0, 5).forEach((b, idx) => {
        row[`Bullet_Point${idx + 1}`] = b;
    });
  }

  return row;
}

/**
 * BigQuery Streaming Insert
 */
async function insertToBQ(rows = []) {
  if (!bigquery) throw new Error('BigQuery not initialized');
  if (rows.length === 0) return { inserted: 0 };

  const table = bigquery.dataset(DATASET_ID).table(TABLE_ID);
  const rowsWithIds = rows.map(r => ({
    insertId: r.Seller_SKU || `${Date.now()}-${Math.random()}`,
    json: r
  }));

  await table.insert(rowsWithIds, { raw: true });
  return { inserted: rows.length };
}

/**
 * Update Start Time in Google Sheet
 */
async function updateStartTime(asin, email) {
  if (!sheetsClient || !sheetsApi) throw new Error('Sheets API not initialized');
  const authClient = await sheetsClient.getClient();

  const res = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: KAM_ID,
    range: `${KAM_TAB}!A:F`,
  });

  const values = res.data.values || [];
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === asin && values[i][5]?.toLowerCase() === email.toLowerCase()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) throw new Error('Claimed ASIN not found in sheet');

  const ts = toISTTimestamp();
  await sheetsApi.spreadsheets.values.update({
    auth: authClient,
    spreadsheetId: KAM_ID,
    range: `${KAM_TAB}!G${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[ts]] }
  });

  return { success: true, startTime: ts };
}

/**
 * Update End Time and mark Completed
 */
async function updateEndTime(asin, email) {
  if (!sheetsClient || !sheetsApi) throw new Error('Sheets API not initialized');
  const authClient = await sheetsClient.getClient();

  const res = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: KAM_ID,
    range: `${KAM_TAB}!A:F`,
  });

  const values = res.data.values || [];
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i][1] === asin && values[i][5]?.toLowerCase() === email.toLowerCase()) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) throw new Error('Active claim not found');

  const ts = toISTTimestamp();
  await sheetsApi.spreadsheets.values.batchUpdate({
    auth: authClient,
    spreadsheetId: KAM_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `${KAM_TAB}!D${rowIndex}`, values: [['Completed']] },
        { range: `${KAM_TAB}!H${rowIndex}`, values: [[ts]] }
      ]
    }
  });

  return { success: true, endTime: ts };
}

/**
 * Combined Export: BigQuery + Sheets End Time
 */
async function combinedExport(payload) {
    const { items, userEmail } = payload;
    const bqRows = items.map(item => mapUIToBQRow(item));
    
    // 1. Insert to BQ
    const bqResult = await insertToBQ(bqRows);
    
    // 2. Update Sheets for each ASIN
    const sheetResults = [];
    for (const item of items) {
        try {
            const res = await updateEndTime(item.asin1 || item.asin, userEmail);
            sheetResults.push({ asin: item.asin1, success: true });
        } catch (err) {
            sheetResults.push({ asin: item.asin1, success: false, error: err.message });
        }
    }

    return { 
        success: true, 
        bqInserted: bqResult.inserted, 
        sheetUpdated: sheetResults.filter(r => r.success).length 
    };
}

module.exports = {
  updateStartTime,
  updateEndTime,
  insertToBQ,
  combinedExport,
  mapUIToBQRow
};
