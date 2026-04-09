// src/utils/scraperUtils.js

/**
 * Standardizes raw product data into the format expected by the Listro UI.
 * Ported from legacy api.js to support the new modular architecture.
 */
export const transformScrapedProduct = (responseData) => {
  // Handle multiple possible response structures
  let productData;

  if (responseData.product) {
    productData = responseData;
  } else if (responseData.data?.data?.data) {
    productData = responseData.data.data.data;
  } else if (responseData.data?.data) {
    productData = responseData.data.data;
  } else if (responseData.data?.basic_information) {
    productData = responseData.data;
  } else if (responseData.data) {
    productData = responseData.data;
  } else {
    productData = responseData;
  }

  if (!productData) return null;

  const safeGet = (obj, path, defaultValue = null) => {
    try {
      return path.split(".").reduce((acc, part) => acc?.[part], obj) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const filterValidData = (data) => {
    if (!data || typeof data !== "object") return null;
    const filtered = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value && value !== "N/A" && value !== "null" && value !== "undefined") {
        filtered[key] = value;
      }
    });
    return Object.keys(filtered).length > 0 ? filtered : null;
  };

  const product = productData.product || productData;
  const details = productData.details || {};
  const raw = productData.raw || {};

  return {
    asin: safeGet(product, "asin") || safeGet(raw, "manufacturingDetails.ASIN") || 
          (Array.isArray(details.manufacturingDetails) ? details.manufacturingDetails.find(d => d.label === "ASIN")?.value : null),
    title: safeGet(product, "title"),
    brand: safeGet(product, "brand") || safeGet(raw, "productDetails.Brand"),
    url: safeGet(product, "url"),
    category: safeGet(product, "category") || "Unknown",
    images: (Array.isArray(product.images) ? product.images : []).filter(img => img && img.startsWith("http")),
    existingImages: (Array.isArray(product.existingImages) ? product.existingImages : 
                    Array.isArray(product.images) ? product.images : []).filter(img => img && img.startsWith("http")),
    features: (Array.isArray(details.featureBullets) ? details.featureBullets : []).filter(f => f && f !== "N/A" && f.trim().length > 0),
    description: safeGet(product, "description"),
    productDetails: filterValidData(raw.productDetails),
    manufacturingDetails: filterValidData(raw.manufacturingDetails),
    additionalInfo: filterValidData(raw.additionalInfo),
    productOverview: filterValidData(product.productOverview),
    productInformation: product.productInformation || null,
    technicalDetails: filterValidData(product.technicalDetails),
    whatsInBox: safeGet(product, "whatsInBox") || null,
    safetyInfo: safeGet(product, "safetyInfo") || null,
    
    // Arrays for rendering
    productOverviewArray: Array.isArray(details.productOverview) ? details.productOverview.filter(d => d.value && d.value !== "N/A") : [],
    productInformationArrays: (() => {
      const isObject = details.productInformation && typeof details.productInformation === 'object';
      if (!isObject) return {};
      const result = {};
      Object.keys(details.productInformation).forEach(sub => {
        if (Array.isArray(details.productInformation[sub])) {
          result[sub] = details.productInformation[sub].filter(d => d.value && d.value !== "N/A");
        }
      });
      return result;
    })(),
    moreProductDetailsArray: Array.isArray(details.moreProductDetails) ? details.moreProductDetails.filter(d => d.value && d.value !== "N/A") : [],
    productDetailsArray: Array.isArray(details.productDetails) ? details.productDetails.filter(d => d.value && d.value !== "N/A") : [],
    manufacturingDetailsArray: Array.isArray(details.manufacturingDetails) ? details.manufacturingDetails.filter(d => d.value && d.value !== "N/A") : [],
    additionalInfoArray: Array.isArray(details.additionalInfo) ? details.additionalInfo.filter(d => d.value && d.value !== "N/A") : [],
    productDetailsListArray: Array.isArray(details.productDetailsList) ? details.productDetailsList.filter(d => d.value && d.value !== "N/A") : [],
    rawData: productData
  };
};
