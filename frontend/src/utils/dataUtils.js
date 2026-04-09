/**
 * Helper function to safely get values with multiple possible column names
 */
export const getColumnValue = (item, possibleKeys) => {
  if (!item) return '';
  for (const key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
      return item[key];
    }
  }
  return '';
};

/**
 * Format timestamp for display (IST)
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp || timestamp.trim() === '') return '-';
 
  if (timestamp.includes('-') && timestamp.includes(':')) {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {
      return timestamp;
    }
  }
 
  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (e) {}
 
  return timestamp;
};

/**
 * Format BigQuery table name for display
 */
export const formatTableName = (fullTableName) => {
  if (!fullTableName) return '';
  const parts = fullTableName.split('.');
  return parts[parts.length - 1];
};

/**
 * Handle CSV download for listing data
 */
export const downloadListingCsv = (data, headers, sellerId) => {
  if (!data || data.length === 0) {
    alert('No data available to download');
    return;
  }

  const tableHeaders = headers.length > 0 ? headers : Object.keys(data[0] || {});
  const headersWithLink = [...tableHeaders, 'Listing Link'];

  const csvContent = [
    headersWithLink.join(','),
    ...data.map(item => {
      const asin = item['asin1'] || item['ASIN'] || item['asin'] || '';
      const listingLink = asin ? `https://www.amazon.in/dp/${asin}` : '';
      const rowData = tableHeaders.map(header => `"${item[header] || ''}"`);
      return [...rowData, `"${listingLink}"`].join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  const todayDate = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `${sellerId}_${todayDate}_gcp_data.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};
