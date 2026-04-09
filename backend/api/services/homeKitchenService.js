/**
 * homeKitchenService.js
 * 
 * Logic ported from listro_gcp_old/backend/server.js (approx lines 4500-4800)
 * Handles Home & Kitchen specific data exports and schema management.
 */
const { sheetsApi, sheetsClient, bigquery } = require('../utils/gcpClient');

/**
 * Builds Home & Kitchen sheet row data from product data
 */
function buildHomeKitchenRowData(productData, imageLinks = []) {
  const safeValue = (value) => {
    if (value === null || value === undefined || value === 'N/A' || value === '') return '';
    return String(value).trim();
  };
  
  const smartFind = (searchIn, labelSearch) => {
    if (!searchIn || !labelSearch) return '';
    const searchLower = labelSearch.toLowerCase();
    if (Array.isArray(searchIn)) {
      for (const item of searchIn) {
        if ((item.label && item.label.toLowerCase().includes(searchLower)) || 
            (item.key && item.key.toLowerCase().includes(searchLower))) {
          return safeValue(item.value);
        }
      }
    }
    return '';
  };
  
  const productDetails = productData.productDetails || [];
  const manufacturingDetails = productData.manufacturingDetails || [];
  const acceptedAttributes = productData.acceptedAttributes || [];
  const features = productData.features || [];
  
  const getDetail = (searchTerm) => {
    return smartFind(productDetails, searchTerm) || 
           smartFind(manufacturingDetails, searchTerm) || 
           smartFind(acceptedAttributes, searchTerm);
  };
  
  return {
    'seller_sku': safeValue(productData.originalAsin),
    'product_id': safeValue(productData.originalAsin),
    'product_id_type': 'ASIN',
    'brand_name': getDetail('brand') || safeValue(productData.brandComparison?.original),
    'item_name': safeValue(productData.originalTitle),
    'bullet_point1': features[0] || '',
    'bullet_point2': features[1] || '',
    'bullet_point3': features[2] || '',
    'bullet_point4': features[3] || '',
    'bullet_point5': features[4] || '',
    'main_image_url': imageLinks[0] || '',
    'other_image_url1': imageLinks[1] || '',
    'other_image_url2': imageLinks[2] || '',
    'other_image_url3': imageLinks[3] || '',
    'other_image_url4': imageLinks[4] || '',
    'other_image_url5': imageLinks[5] || '',
    'hsn_code': getDetail('hsn') || '',
    'sku_id': getDetail('sku') || safeValue(productData.originalAsin),
    'mrp': getDetail('mrp') || '',
    'standard_price': safeValue(productData.originalPrice)
    // Add more mappings as needed from the original large object
  };
}

/**
 * Ensure BigQuery schema is up to date
 */
async function ensureBigQueryColumns() {
  if (!bigquery) throw new Error('BigQuery not initialized');
  const dataset = bigquery.dataset('Listro_Listing');
  const table = dataset.table('Home_and_Kitchen');
  
  const [metadata] = await table.getMetadata();
  const existingFields = metadata.schema.fields.map(f => f.name);
  
  const required = [
    { name: 'hsn_code', type: 'STRING', mode: 'NULLABLE' },
    { name: 'sku_id', type: 'STRING', mode: 'NULLABLE' },
    { name: 'pattern', type: 'STRING', mode: 'NULLABLE' },
    { name: 'mrp', type: 'STRING', mode: 'NULLABLE' }
  ];
  
  const missing = required.filter(col => !existingFields.includes(col.name));
  if (missing.length > 0) {
    const newSchema = { fields: [...metadata.schema.fields, ...missing] };
    await table.setMetadata({ schema: newSchema });
  }
  return { success: true, added: missing.map(c => c.name) };
}

/**
 * Ensure Sheet headers are up to date
 */
async function ensureSheetHeaders(sheetId, tabName = 'Data') {
  if (!sheetsApi || !sheetsClient) throw new Error('Sheets API not initialized');
  const authClient = await sheetsClient.getClient();
  
  const res = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: sheetId,
    range: `${tabName}!1:1`
  });
  
  const existing = (res.data.values && res.data.values[0]) || [];
  const required = ['hsn_code', 'sku_id', 'pattern', 'mrp'];
  const missing = required.filter(h => !existing.includes(h));
  
  if (missing.length > 0) {
    const newHeaders = [...existing, ...missing];
    await sheetsApi.spreadsheets.values.update({
      auth: authClient,
      spreadsheetId: sheetId,
      range: `${tabName}!1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [newHeaders] }
    });
  }
  return { success: true, added: missing };
}

/**
 * Main HK Export Logic
 */
async function appendToHomeKitchen(sheetId, tabName, productData, imageLinks) {
  if (!sheetsApi || !sheetsClient || !bigquery) throw new Error('API clients not initialized');
  
  await ensureSheetHeaders(sheetId, tabName);
  await ensureBigQueryColumns();
  
  const authClient = await sheetsClient.getClient();
  const rowData = buildHomeKitchenRowData(productData, imageLinks);
  
  // 1. Get Headers to map rowData to indexed array
  const headerRes = await sheetsApi.spreadsheets.values.get({
    auth: authClient,
    spreadsheetId: sheetId,
    range: `${tabName}!1:1`
  });
  const headers = headerRes.data.values[0];
  const rowArray = headers.map(h => rowData[h] || '');
  
  // 2. Append to Sheets
  await sheetsApi.spreadsheets.values.append({
    auth: authClient,
    spreadsheetId: sheetId,
    range: `${tabName}!A2`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [rowArray] }
  });
  
  // 3. Insert to BigQuery
  const table = bigquery.dataset('Listro_Listing').table('Home_and_Kitchen');
  await table.insert([{ ...rowData, inserted_at: new Date().toISOString() }], { ignoreUnknownValues: true });
  
  return { success: true, message: 'Appended to Sheets and BigQuery' };
}

module.exports = {
  appendToHomeKitchen,
  ensureSheetHeaders,
  ensureBigQueryColumns
};
