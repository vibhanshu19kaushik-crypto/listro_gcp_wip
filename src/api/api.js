// API service for fetching data from Amazon Comparator API
const API_BASE_URL = 'http://localhost:3000';

// ==================== GOOGLE SHEETS FUNCTIONS ====================

// Fetch golden sheet data from Google Sheets (Golden tab)
const fetchGoldenSheetData = async () => {
  console.log('📊 Fetching golden sheet data from Google Sheets...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/golden-sheet-data`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch golden sheet data`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'API returned error');
    }
    
    console.log('✅ Golden sheet data fetched successfully from Google Sheets:', {
      totalRows: data.totalRows,
      fromCache: data.fromCache,
      headers: data.headers
    });
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching golden sheet data from Google Sheets:', error);
    throw new Error(`Failed to fetch golden sheet data: ${error.message}`);
  }
};

// ==================== COMPLETE SCRAPING FUNCTION (From First Version) ====================

// Scrape product data from a given URL
const scrapeProductFromUrl = async (productUrl) => {
  console.log('🔍 Scraping product data from URL:', productUrl);
  try {
    const response = await fetch(`${API_BASE_URL}/api/scrape-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: productUrl })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to scrape product data');
    }
    
    if (!responseData.success) {
      throw new Error(responseData.error || 'Scraping failed');
    }
    
    // Handle multiple possible response structures - check nested levels
    let productData;
    
    // Check if response has 'product' key (new scraper format)
    if (responseData.product) {
      productData = responseData;
    }
    // Deep nested: data.data.data (triple nested)
    else if (responseData.data?.data?.data) {
      productData = responseData.data.data.data;
    }
    // Double nested: data.data structure
    else if (responseData.data?.data) {
      productData = responseData.data.data;
    } 
    // Single nested with basic_information (old format)
    else if (responseData.data?.basic_information) {
      productData = responseData.data;
    }
    // Direct in data
    else if (responseData.data) {
      productData = responseData.data;
    }
    // Otherwise, assume data is directly in response (old format)
    else {
      productData = responseData;
    }
    
    if (!productData) {
      throw new Error('No product data found in response');
    }
    
    console.log('📦 Raw scraped data:', productData);
    
    // Helper function to safely get nested values
    const safeGet = (obj, path, defaultValue = null) => {
      try {
        return path.split('.').reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
      } catch {
        return defaultValue;
      }
    };

    // Helper function to filter out null/undefined/N/A values
    const filterValidData = (data) => {
      if (!data || typeof data !== 'object') return null;
      const filtered = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value && value !== 'N/A' && value !== 'null' && value !== 'undefined') {
          filtered[key] = value;
        }
      });
      return Object.keys(filtered).length > 0 ? filtered : null;
    };

    // Extract product info from new format
    const product = productData.product || productData;
    const details = productData.details || {};
    const raw = productData.raw || {};
    
    // Transform the scraped data to match our application's format
    const transformedProduct = {
      // Basic information
      asin: safeGet(product, 'asin') || 
            safeGet(raw, 'manufacturingDetails.ASIN') ||
            (Array.isArray(details.manufacturingDetails) ? 
              details.manufacturingDetails.find(d => d.label === 'ASIN')?.value : null),
      
      title: safeGet(product, 'title'),
      
      brand: safeGet(product, 'brand') ||
             safeGet(raw, 'productDetails.Brand'),
      
      url: productUrl,
      
      // Images - filter out invalid URLs
      images: (Array.isArray(product.images) ? product.images : [])
        .filter(img => img && img.startsWith('http')),
      
      // Features/Bullets
      features: (Array.isArray(details.featureBullets) ? details.featureBullets : [])
        .filter(f => f && f !== 'N/A' && f.trim().length > 0),
      
      // Description
      description: safeGet(product, 'description'),
      
      // Product Details - organized by sections
      productDetails: filterValidData(raw.productDetails),
      
      // Manufacturing Details
      manufacturingDetails: filterValidData(raw.manufacturingDetails),
      
      // Additional Info
      additionalInfo: filterValidData(raw.additionalInfo),
      
      // Flatten all details into arrays for easy rendering
      productDetailsArray: Array.isArray(details.productDetails) 
        ? details.productDetails.filter(d => d.value && d.value !== 'N/A')
        : [],
        
      manufacturingDetailsArray: Array.isArray(details.manufacturingDetails)
        ? details.manufacturingDetails.filter(d => d.value && d.value !== 'N/A')
        : [],
        
      additionalInfoArray: Array.isArray(details.additionalInfo)
        ? details.additionalInfo.filter(d => d.value && d.value !== 'N/A')
        : [],
      
      // Store raw data for reference
      rawData: productData
    };
    
    console.log('✅ Product data scraped and transformed successfully:', {
      title: transformedProduct.title,
      asin: transformedProduct.asin,
      brand: transformedProduct.brand,
      imageCount: transformedProduct.images.length,
      featureCount: transformedProduct.features.length,
      hasDescription: !!transformedProduct.description,
      hasProductDetails: !!transformedProduct.productDetails,
      hasManufacturingDetails: !!transformedProduct.manufacturingDetails
    });
    
    return transformedProduct;
  } catch (error) {
    console.error('❌ Error scraping product:', error);
    throw new Error(`Failed to scrape product: ${error.message}`);
  }
};

// ==================== GCP BIGQUERY FUNCTIONS ====================

// Fetch all sellers from GCP
const fetchSheetData = async () => {
  console.log('🔄 Fetching seller data from GCP...');
  try {
    const response = await fetch(`${API_BASE_URL}/api/gcp/sellers`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch seller data from GCP`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to fetch seller data from GCP');
    }
    
    console.log('✅ GCP seller data fetched successfully:', {
      totalSellers: data.data.length,
      source: data.source
    });
    
    // Transform GCP data to ensure consistent field names
    const transformedData = data.data.map(seller => ({
      sellerId: seller.seller_id,
      sellerName: seller.seller_name || seller.name || 'Unknown Seller',
      ...seller
    }));
    
    return {
      success: true,
      data: transformedData,
      headers: transformedData.length > 0 ? Object.keys(transformedData[0]) : [],
      totalRows: data.totalRows
    };
    
  } catch (error) {
    console.error('❌ Error fetching from GCP:', error);
    
    // Fallback to Google Sheets if GCP fails
    console.log('🔄 Falling back to Google Sheets...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/golden-sheet-data`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch from Google Sheets`);
      }
      
      const sheetData = await response.json();
      console.log('✅ Using Google Sheets fallback');
      return sheetData;
      
    } catch (fallbackError) {
      console.error('❌ Google Sheets fallback also failed:', fallbackError);
      throw new Error(`GCP failed: ${error.message}, Fallback also failed: ${fallbackError.message}`);
    }
  }
};

// Fetch seller listings from GCP
const fetchSellerData = async (sellerId) => {
  console.log(`🔄 Fetching listings for seller ${sellerId} from GCP...`);
  try {
    const response = await fetch(`${API_BASE_URL}/api/gcp/sellers/${sellerId}/listings`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch listings for seller ${sellerId}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || `Failed to fetch listings for seller ${sellerId}`);
    }
    
    console.log('✅ GCP seller listings fetched successfully:', {
      sellerId: sellerId,
      totalListings: data.data.length,
      source: data.source
    });
    
    // Transform listings data if needed
    const transformedListings = data.data.map(listing => ({
      sellerId: listing.seller_id || sellerId,
      ...listing
    }));
    
    return {
      success: true,
      data: transformedListings,
      headers: transformedListings.length > 0 ? Object.keys(transformedListings[0]) : []
    };
    
  } catch (error) {
    console.error('❌ Error fetching seller data from GCP:', error);
    
    // Fallback for seller data
    console.log('🔄 Falling back to mock data for seller listings...');
    try {
      // Generate mock listings data as fallback
      const mockListings = Array.from({ length: 10 }, (_, index) => ({
        id: `listing-${sellerId}-${index}`,
        title: `Product ${index + 1} from Seller ${sellerId}`,
        price: (Math.random() * 100 + 10).toFixed(2),
        category: ['Electronics', 'Home', 'Fashion', 'Sports'][index % 4],
        rating: (Math.random() * 2 + 3).toFixed(1),
        reviews: Math.floor(Math.random() * 1000),
        availability: 'In Stock',
        seller_id: sellerId,
        sellerId: sellerId
      }));
      
      return {
        success: true,
        data: mockListings,
        headers: Object.keys(mockListings[0] || {})
      };
      
    } catch (fallbackError) {
      throw new Error(`Failed to fetch seller data: ${error.message}`);
    }
  }
};

// ==================== AI GENERATION FUNCTIONS ====================

// AI text generation
const generateProductTitle = async (subcategory, productDetails) => {
  console.log('🤖 Generating AI product title with:', { subcategory, productDetails });
  
  try {
    const requestBody = {
      subcategory,
      type: 'title',
      ...productDetails
    };

    const response = await fetch('http://localhost:5000/api/generate-title-description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to generate title`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Title generation failed');
    }
    
    console.log('✅ AI product title generated successfully');
    return data.generated_title;
  } catch (error) {
    console.error('❌ Error generating AI product title:', error);
    
    // Fallback: Generate a simple title
    const fallbackTitle = `${productDetails.color || ''} ${subcategory} ${productDetails.material || ''}`.trim();
    console.log('🔄 Using fallback title:', fallbackTitle);
    return fallbackTitle;
  }
};

const generateProductDescription = async (subcategory, productDetails) => {
  console.log('🤖 Generating AI product description with:', { subcategory, productDetails });
  
  try {
    const requestBody = {
      subcategory,
      type: 'description',
      ...productDetails
    };

    const response = await fetch('http://localhost:5000/api/generate-title-description', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to generate description`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Description generation failed');
    }
    
    console.log('✅ AI product description generated successfully');
    return data.generated_description;
  } catch (error) {
    console.error('❌ Error generating AI product description:', error);
    
    // Fallback: Generate a simple description
    const fallbackDescription = `High-quality ${subcategory} made from ${productDetails.material || 'premium materials'}. Features ${productDetails.features || 'excellent durability and performance'}.`;
    console.log('🔄 Using fallback description');
    return fallbackDescription;
  }
};

// AI image generation
const generateAIImage = async (imageFile, styleIndex, attributes = {}) => {
  console.log('🎨 Generating AI image with:', { styleIndex, attributes });
  
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('style_index', styleIndex.toString());
    formData.append('attributes', JSON.stringify(attributes));

    const response = await fetch('http://localhost:5000/generate-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to generate image`);
    }

    const data = await response.json();
    
    let imageUrl;
    if (data.gcs_url) {
      imageUrl = data.gcs_url;
    } else if (data.filename) {
      imageUrl = `http://localhost:5000/generated_images/${data.filename}`;
    } else {
      throw new Error('No image URL returned from server');
    }
    
    console.log('✅ AI image generated successfully');
    return imageUrl;
  } catch (error) {
    console.error('❌ Error generating AI image:', error);
    throw new Error(`Failed to generate AI image: ${error.message}`);
  }
};

// ==================== LEGACY/COMPATIBILITY FUNCTIONS ====================

// Legacy function kept for compatibility
const fetchSellerDataByCategory = async (category) => {
  console.log(`Fetching data for category: ${category}`);
  try {
    const sheetData = await fetchSheetData();
    
    let filteredData = sheetData.data;
    if (category && category !== 'All Categories') {
      filteredData = sheetData.data.filter(item => 
        item.Category && item.Category.toLowerCase() === category.toLowerCase()
      );
    }
    
    const transformedData = filteredData.map((item, index) => ({
      productID: `API-${Date.now()}-${index}`,
      productName: `${item.Category} - ${item.Subcategory} (${item.Gender}, ${item['Age Group']})`,
      category: item.Category,
      rating: (Math.random() * 2 + 3).toFixed(1),
      reviews: Math.floor(Math.random() * 10000) + 100,
      availability: 'In Stock',
      url: item.URL,
      gender: item.Gender,
      ageGroup: item['Age Group'],
      subcategory: item.Subcategory,
      sellerId: item.sellerId || item.seller_id
    }));
    
    return transformedData;
  } catch (error) {
    throw new Error(`Failed to fetch data for ${category}: ${error.message}`);
  }
};

// Helper function to extract seller ID from various field names
const getSellerId = (seller) => {
  return seller.sellerId || seller.seller_id || seller.id || seller.sellerID;
};

// Export all functions using ES6 modules
export {
  fetchSheetData,
  fetchSellerData,
  fetchGoldenSheetData,
  scrapeProductFromUrl,
  fetchSellerDataByCategory,
  generateProductTitle,
  generateProductDescription,
  generateAIImage,
  getSellerId
};