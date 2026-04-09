const { runQuery } = require('../utils/gcpClient');

/**
 * GCP / BigQuery Service for Listro
 * Extracts logic from the monolithic server.js
 */

async function getSellers() {
  const query = `
    SELECT DISTINCT
      seller_id,
      store_name
    FROM \`ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA\`
    WHERE seller_id IS NOT NULL AND seller_id != ''
    ORDER BY store_name
  `;
  const rows = await runQuery(query);
  return { success: true, data: rows, totalRows: rows.length };
}

async function getSellerListings(sellerId) {
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
    LIMIT 1000
  `;
  const rows = await runQuery(query, { sellerId });
  return { success: true, data: rows, totalRows: rows.length };
}

async function getResourceAllocation(sellerId, storeName = '') {
  const query = `
    SELECT 
      *
    FROM \`ops-excellence.amazon_sp_data.RESOURCE_ALLOCATION\`
    WHERE seller_id = @sellerId
    ${storeName ? 'AND store_name = @storeName' : ''}
    ORDER BY last_claim_timestamp DESC
  `;
  const params = { sellerId };
  if (storeName) params.storeName = storeName;

  const rows = await runQuery(query, params);
  return { success: true, data: rows, totalRows: rows.length };
}

async function searchSellers(searchTerm) {
  const query = `
    SELECT DISTINCT
      seller_id,
      store_name
    FROM \`ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA\`
    WHERE 
      LOWER(seller_id) LIKE @term OR 
      LOWER(store_name) LIKE @term
    ORDER BY store_name
  `;
  const rows = await runQuery(query, { term: `%${searchTerm.toLowerCase()}%` });
  return { success: true, data: rows, totalRows: rows.length };
}

module.exports = {
  getSellers,
  getSellerListings,
  getResourceAllocation,
  searchSellers
};
