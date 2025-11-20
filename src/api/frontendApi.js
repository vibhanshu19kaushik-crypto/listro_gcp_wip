// // Frontend API service (ES6 modules for React)
// const API_BASE_URL = 'http://localhost:3000';


// // ==================== GCP BIGQUERY FUNCTIONS ====================


// // Fetch all sellers from GCP
// export const fetchSheetData = async () => {
//  console.log('ðŸ”„ Fetching seller data from GCP...');
//  try {
//    const response = await fetch(`${API_BASE_URL}/api/gcp/sellers`);
//    const data = await response.json();
  
//    if (!response.ok || !data.success) {
//      throw new Error(data.error || 'Failed to fetch seller data from GCP');
//    }
  
//    console.log('âœ… GCP seller data fetched successfully:', {
//      totalSellers: data.data.length,
//      source: data.source
//    });
  
//    // Transform GCP data to match your component's expected format
//    return {
//      success: true,
//      data: data.data,
//      headers: data.data.length > 0 ? Object.keys(data.data[0]) : [],
//      totalRows: data.totalRows
//    };
  
//  } catch (error) {
//    console.error('âŒ Error fetching from GCP:', error);
  
//    // Fallback to Google Sheets if GCP fails
//    console.log('ðŸ”„ Falling back to Google Sheets...');
//    try {
//      const response = await fetch(`${API_BASE_URL}/api/sheet-data`);
//      const sheetData = await response.json();
    
//      if (!response.ok) {
//        throw new Error('Both GCP and Google Sheets failed');
//      }
    
//      console.log('âœ… Using Google Sheets fallback');
//      return sheetData;
    
//    } catch (fallbackError) {
//      throw new Error(`GCP failed: ${error.message}, Fallback also failed: ${fallbackError.message}`);
//    }
//  }
// };


// // Fetch seller listings from GCP with better fallback
// export const fetchSellerData = async (sellerId) => {
//   console.log(`🔄 Fetching listings for seller ${sellerId}...`);
//   try {
//     const response = await fetch(`${API_BASE_URL}/api/gcp/sellers/${sellerId}/listings`);
//     const data = await response.json();
    
//     if (!response.ok || !data.success) {
//       throw new Error(data.error || `Failed to fetch listings for seller ${sellerId}`);
//     }
    
//     console.log('✅ GCP seller listings fetched successfully');
//     return {
//       success: true,
//       data: data.data,
//       headers: data.data.length > 0 ? Object.keys(data.data[0]) : []
//     };
    
//   } catch (error) {
//     console.error('❌ Error fetching seller data from GCP:', error.message);
    
//     // Enhanced fallback: Use Google Sheets data
//     console.log('🔄 Falling back to Google Sheets data...');
//     try {
//       const sheetData = await fetchSheetData();
      
//       // Filter by seller_id if available, otherwise show all data
//       const filteredData = sheetData.data.filter(item => 
//         item.seller_id === sellerId || !sheetData.data.some(item => item.seller_id)
//       );
      
//       console.log(`✅ Using ${filteredData.length} rows from Google Sheets fallback`);
      
//       return {
//         success: true,
//         data: filteredData,
//         headers: sheetData.headers,
//         source: 'google-sheets-fallback'
//       };
      
//     } catch (fallbackError) {
//       throw new Error(`GCP failed: ${error.message}, Fallback also failed: ${fallbackError.message}`);
//     }
//   }
// };


// // ==================== EXISTING FUNCTIONS ====================


// // Fetch golden sheet data from the API
// export const fetchGoldenSheetData = async () => {
//  console.log('Fetching golden sheet data from API...');
//  try {
//    const response = await fetch(`${API_BASE_URL}/api/golden-sheet-data`);
//    const data = await response.json();
  
//    if (!response.ok) {
//      throw new Error(data.error || 'Failed to fetch golden sheet data');
//    }
  
//    if (!data.success) {
//      throw new Error(data.error || 'API returned error');
//    }
  
//    console.log('âœ… Golden sheet data fetched successfully:', {
//      totalRows: data.totalRows,
//      fromCache: data.fromCache,
//      headers: data.headers
//    });
  
//    return data;
//  } catch (error) {
//    console.error('Error fetching golden sheet data:', error);
//    throw new Error(`Failed to fetch golden sheet data: ${error.message}`);
//  }
// };


// // Scrape product data from a given URL
// export const scrapeProductFromUrl = async (productUrl) => {
//  console.log('ðŸ” Scraping product data from URL:', productUrl);
//  try {
//    const response = await fetch(`${API_BASE_URL}/api/scrape-product`, {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json',
//      },
//      body: JSON.stringify({ url: productUrl })
//    });
  
//    const responseData = await response.json();
  
//    if (!response.ok) {
//      throw new Error(responseData.error || 'Failed to scrape product data');
//    }
  
//    if (!responseData.success) {
//      throw new Error(responseData.error || 'Scraping failed');
//    }
  
//    return responseData;
//  } catch (error) {
//    console.error('âŒ Error scraping product:', error);
//    throw new Error(`Failed to scrape product: ${error.message}`);
//  }
// };


// // AI text generation
// export const generateProductTitle = async (subcategory, productDetails) => {
//  console.log('ðŸ¤– Generating AI product title with:', { subcategory, productDetails });
//   try {
//    const requestBody = {
//      subcategory,
//      type: 'title',
//      ...productDetails
//    };


//    const response = await fetch('http://localhost:5000/api/generate-title-description', {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json',
//      },
//      body: JSON.stringify(requestBody),
//    });


//    if (!response.ok) {
//      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
//      throw new Error(errorData.error || `Server error: ${response.status}`);
//    }


//    const data = await response.json();
  
//    if (!data.success) {
//      throw new Error(data.error || 'Title generation failed');
//    }
  
//    console.log('âœ… AI product title generated successfully:', data.generated_title);
//    return data.generated_title;
//  } catch (error) {
//    console.error('âŒ Error generating AI product title:', error);
//    throw new Error(`Failed to generate product title: ${error.message}`);
//  }
// };


// export const generateProductDescription = async (subcategory, productDetails) => {
//  console.log('ðŸ¤– Generating AI product description with:', { subcategory, productDetails });
//   try {
//    const requestBody = {
//      subcategory,
//      type: 'description',
//      ...productDetails
//    };


//    const response = await fetch('http://localhost:5000/api/generate-title-description', {
//      method: 'POST',
//      headers: {
//        'Content-Type': 'application/json',
//      },
//      body: JSON.stringify(requestBody),
//    });


//    if (!response.ok) {
//      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
//      throw new Error(errorData.error || `Server error: ${response.status}`);
//    }


//    const data = await response.json();
  
//    if (!data.success) {
//      throw new Error(data.error || 'Description generation failed');
//    }
  
//    console.log('âœ… AI product description generated successfully:', data.generated_description);
//    return data.generated_description;
//  } catch (error) {
//    console.error('âŒ Error generating AI product description:', error);
//    throw new Error(`Failed to generate product description: ${error.message}`);
//  }
// };


// // AI image generation
// export const generateAIImage = async (imageFile, styleIndex, attributes = {}) => {
//  console.log('ðŸŽ¨ Generating AI image with:', { styleIndex, attributes });
//   try {
//    const formData = new FormData();
//    formData.append('image', imageFile);
//    formData.append('style_index', styleIndex.toString());
//    formData.append('attributes', JSON.stringify(attributes));


//    const response = await fetch('http://localhost:5000/generate-image', {
//      method: 'POST',
//      body: formData,
//    });


//    if (!response.ok) {
//      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
//      throw new Error(errorData.error || `Server error: ${response.status}`);
//    }


//    const data = await response.json();
  
//    let imageUrl;
//    if (data.gcs_url) {
//      imageUrl = data.gcs_url;
//      console.log('âœ… AI image generated successfully (GCS):', imageUrl);
//    } else if (data.filename) {
//      imageUrl = `http://localhost:5000/generated_images/${data.filename}`;
//      console.log('âœ… AI image generated successfully (Local):', imageUrl);
//    } else {
//      throw new Error('No image URL returned from server');
//    }
  
//    return imageUrl;
//  } catch (error) {
//    console.error('âŒ Error generating AI image:', error);
//    throw new Error(`Failed to generate AI image: ${error.message}`);
//  }
// };

// Frontend API service for React
const API_BASE_URL = "http://localhost:3000";

/* ============================================================
   GCP BIGQUERY – MAIN DATA SOURCE
============================================================ */

// Fetch all sellers from GCP
export const fetchSheetData = async () => {
  const response = await fetch(`${API_BASE_URL}/api/gcp/sellers`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch sellers from GCP");
  }

  return {
    success: true,
    data: data.data,
    headers: data.data.length > 0 ? Object.keys(data.data[0]) : [],
    totalRows: data.totalRows,
    source: "gcp"
  };
};

// Fetch listings for a specific seller
export const fetchSellerData = async (sellerId) => {
  const response = await fetch(
    `${API_BASE_URL}/api/gcp/sellers/${sellerId}/listings`
  );
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch seller listings");
  }

  return {
    success: true,
    data: data.data,
    headers: data.data.length > 0 ? Object.keys(data.data[0]) : []
  };
};

// Search sellers
export const searchSellers = async (searchTerm) => {
  const res = await fetch(
    `${API_BASE_URL}/api/gcp/sellers/search/${searchTerm}`
  );
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "Search failed");
  }

  return data;
};

/* ============================================================
   GOLDEN SHEET ENDPOINT (IF ENABLED)
============================================================ */

export const fetchGoldenSheetData = async () => {
  const response = await fetch(`${API_BASE_URL}/api/golden-sheet-data`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Golden sheet fetch failed");
  }

  return data;
};

/* ============================================================
   SCRAPER
============================================================ */

export const scrapeProductFromUrl = async (productUrl) => {
  const response = await fetch(`${API_BASE_URL}/api/scrape-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: productUrl })
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Scraping failed");
  }

  return data;
};

/* ============================================================
   AI TEXT GENERATION (PORT 5000)
============================================================ */

export const generateProductTitle = async (subcategory, productDetails) => {
  const response = await fetch(
    "http://localhost:5000/api/generate-title-description",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subcategory,
        type: "title",
        ...productDetails
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Title generation failed");
  }

  return data.generated_title;
};

export const generateProductDescription = async (
  subcategory,
  productDetails
) => {
  const response = await fetch(
    "http://localhost:5000/api/generate-title-description",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subcategory,
        type: "description",
        ...productDetails
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Description generation failed");
  }

  return data.generated_description;
};

/* ============================================================
   AI IMAGE GENERATION
============================================================ */

export const generateAIImage = async (imageFile, styleIndex, attributes = {}) => {
  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("style_index", styleIndex.toString());
  formData.append("attributes", JSON.stringify(attributes));

  const response = await fetch("http://localhost:5000/generate-image", {
    method: "POST",
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Image generation failed");
  }

  return (
    data.gcs_url ||
    `http://localhost:5000/generated_images/${data.filename}`
  );
};
