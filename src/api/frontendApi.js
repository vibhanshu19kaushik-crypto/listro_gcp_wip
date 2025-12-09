// src/api/frontendApi.js

// Base URLs for backends (single source of truth)
import {
  NODE_API_BASE_URL,
  PYTHON_API_BASE_URL,
} from "./config";

/* ============================================================
   GCP BIGQUERY – MAIN DATA SOURCE (NODE BACKEND)
============================================================ */

// Fetch all sellers from GCP
export const fetchSheetData = async () => {
  console.log("🔄 Fetching seller data from GCP...");
  const response = await fetch(`${NODE_API_BASE_URL}/api/gcp/sellers`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch sellers from GCP");
  }

  console.log("✅ GCP seller data fetched successfully:", {
    totalSellers: data.data.length,
    source: data.source,
  });

  return {
    success: true,
    data: data.data,
    headers: data.data.length > 0 ? Object.keys(data.data[0]) : [],
    totalRows: data.totalRows,
    source: "gcp",
  };
};

// Fetch listings for a specific seller
export const fetchSellerData = async (sellerId) => {
  console.log(`🔄 Fetching listings for seller ${sellerId} from GCP...`);
  const response = await fetch(
    `${NODE_API_BASE_URL}/api/gcp/sellers/${sellerId}/listings`
  );
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to fetch seller listings");
  }

  console.log("✅ GCP seller listings fetched successfully:", {
    sellerId,
    totalListings: data.data.length,
  });

  return {
    success: true,
    data: data.data,
    headers: data.data.length > 0 ? Object.keys(data.data[0]) : [],
  };
};

// Search sellers
export const searchSellers = async (searchTerm) => {
  console.log("🔎 Searching sellers:", searchTerm);
  const res = await fetch(
    `${NODE_API_BASE_URL}/api/gcp/sellers/search/${encodeURIComponent(
      searchTerm
    )}`
  );
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "Search failed");
  }

  return data;
};

/* ============================================================
   GOLDEN SHEET ENDPOINT (NODE BACKEND)
============================================================ */

export const fetchGoldenSheetData = async () => {
  console.log("📊 Fetching golden sheet data from API...");
  const response = await fetch(`${NODE_API_BASE_URL}/api/golden-sheet-data`);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Golden sheet fetch failed");
  }

  console.log("✅ Golden sheet data fetched successfully:", {
    totalRows: data.totalRows,
    fromCache: data.fromCache,
    headers: data.headers,
  });

  return data;
};

/* ============================================================
   SCRAPER (NODE BACKEND)
============================================================ */

export const scrapeProductFromUrl = async (productUrl) => {
  console.log("🔍 Scraping product data from URL:", productUrl);

  const response = await fetch(`${NODE_API_BASE_URL}/api/scrape-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: productUrl }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Scraping failed");
  }

  console.log("✅ Scraping completed successfully");
  return data;
};

/* ============================================================
   AI TEXT GENERATION (PYTHON BACKEND)
============================================================ */

export const generateProductTitle = async (subcategory, productDetails) => {
  console.log("🤖 Generating AI product title with:", {
    subcategory,
    productDetails,
  });

  const response = await fetch(
    `${PYTHON_API_BASE_URL}/api/generate-title-description`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subcategory,
        type: "title",
        ...productDetails,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Title generation failed");
  }

  console.log("✅ AI product title generated successfully");
  return data.generated_title;
};

export const generateProductDescription = async (
  subcategory,
  productDetails
) => {
  console.log("🤖 Generating AI product description with:", {
    subcategory,
    productDetails,
  });

  const response = await fetch(
    `${PYTHON_API_BASE_URL}/api/generate-title-description`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subcategory,
        type: "description",
        ...productDetails,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Description generation failed");
  }

  console.log("✅ AI product description generated successfully");
  return data.generated_description;
};

/* ============================================================
   AI IMAGE GENERATION (PYTHON BACKEND)
============================================================ */

export const generateAIImage = async (
  imageFile,
  styleIndex,
  attributes = {}
) => {
  console.log("🎨 Generating AI image with:", { styleIndex, attributes });

  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("style_index", styleIndex.toString());
  formData.append("attributes", JSON.stringify(attributes));

  const response = await fetch(`${PYTHON_API_BASE_URL}/generate-image`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Image generation failed");
  }

  const imageUrl =
    data.gcs_url ||
    `${PYTHON_API_BASE_URL}/generated_images/${data.filename}`;

  console.log("✅ AI image generated successfully:", imageUrl);
  return imageUrl;
};
