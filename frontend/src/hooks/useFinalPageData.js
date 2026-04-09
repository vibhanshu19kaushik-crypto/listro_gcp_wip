import { useState, useEffect } from 'react';

export const useFinalPageData = () => {
  const [comparisonData, setComparisonData] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [allImages, setAllImages] = useState([]);

  useEffect(() => {
    // 1. User Info
    const user = JSON.parse(localStorage.getItem('user')) || { name: "User", email: "" };
    setUserInfo(user);

    // 2. Load Source Data
    const storedExisting = localStorage.getItem('existingProduct');
    const existingProductData = storedExisting ? JSON.parse(storedExisting) : null;
    
    const storedFilters = localStorage.getItem('productFilters');
    const productAttributes = storedFilters ? JSON.parse(storedFilters) : {};
    
    const storedGoldStandard = localStorage.getItem('goldStandardProduct');
    const goldStandardData = storedGoldStandard ? JSON.parse(storedGoldStandard) : null;

    if (!existingProductData) return;

    // 3. Process Images
    const storedAllImages = localStorage.getItem('allProductImages');
    let productImages = [];
    if (storedAllImages) {
      try { productImages = JSON.parse(storedAllImages); } catch (e) {}
    }

    if (productImages.length === 0) {
      const storedGenerated = localStorage.getItem('generatedImages');
      const generated = storedGenerated ? JSON.parse(storedGenerated) : [];
      if (existingProductData.images) {
        existingProductData.images.forEach((url, i) => productImages.push({ url, type: 'existing', label: `Existing Image ${i + 1}` }));
      }
      generated.forEach((url, i) => productImages.push({ url, type: 'generated', label: `Generated ${i + 1}` }));
    }
    setAllImages(productImages);

    // 4. Construct Aggregate Data
    const extractPrice = (p) => parseFloat(p?.price || p?.productDetails?.Price || 0);
    const extractBrand = (p) => p?.brand || p?.productDetails?.Brand || 'N/A';
    
    const acceptedAttributes = existingProductData.acceptedAttributes || [];
    const priceFromAttr = acceptedAttributes.find(a => a.key?.toLowerCase().includes('price'))?.value;

    const data = {
      originalTitle: existingProductData.title || 'N/A',
      originalPrice: priceFromAttr || extractPrice(existingProductData),
      originalAsin: existingProductData.asin || existingProductData.id || 'N/A',
      originalImage: existingProductData.images?.[0] || '',
      competitorTitle: goldStandardData?.title || 'Gold Standard',
      competitorPrice: extractPrice(goldStandardData),
      competitorAsin: goldStandardData?.asin || 'N/A',
      competitorImage: goldStandardData?.images?.[0] || '',
      description: existingProductData.description || 'No description',
      features: existingProductData.features || [],
      brandComparison: {
        original: extractBrand(existingProductData),
        competitor: extractBrand(goldStandardData)
      },
      productAttributes,
      productDetails: existingProductData.productDetailsArray || [],
      manufacturingDetails: existingProductData.manufacturingDetailsArray || [],
      acceptedAttributes,
      category: productAttributes.Category || 'N/A',
      subcategory: productAttributes.Subcategory || 'N/A',
      department: productAttributes.Department || existingProductData.department || 'General'
    };

    setComparisonData(data);
  }, []);

  return { comparisonData, userInfo, allImages };
};
