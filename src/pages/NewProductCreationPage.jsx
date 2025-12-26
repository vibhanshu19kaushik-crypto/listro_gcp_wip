// Page 4b: New Product Creation Page with Form and Gold Standard Reference


import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Star, Save, Plus, Check, Wand2, Edit2, Hash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { goldStandardProduct } from '../data/mockData.js';
import { generateProductTitle, generateProductDescription } from '../api/api.js';

import { PYTHON_API_BASE_URL } from '../api/config.js'; 



const NewProductCreationPage = () => {
 const navigate = useNavigate();


 // Golden Product Data from Local Storage
 const [goldenProduct, setGoldenProduct] = useState(null);


 // Product SKU-ID State
 const [productSkuId, setProductSkuId] = useState('');
 const [isEditingSkuId, setIsEditingSkuId] = useState(false);
 const [acceptedSkuId, setAcceptedSkuId] = useState('');


 // Product Title State
 const [productTitle, setProductTitle] = useState('');
 const [isEditingTitle, setIsEditingTitle] = useState(false);
 const [acceptedTitle, setAcceptedTitle] = useState('');
 const titleTextareaRef = useRef(null);
  // Product Description State
 const [productDescription, setProductDescription] = useState('');
 const [isEditingDescription, setIsEditingDescription] = useState(false);
 const [acceptedDescription, setAcceptedDescription] = useState('');
 const descTextareaRef = useRef(null);


 // Product Features State
 const [productFeatures, setProductFeatures] = useState([]);
 const [featureValues, setFeatureValues] = useState({});
 const [newFeature, setNewFeature] = useState('');


 // Product Attributes State
 const [productAttributes, setProductAttributes] = useState({});
 const [showAddAttribute, setShowAddAttribute] = useState(false);
 const [newAttributeKey, setNewAttributeKey] = useState('');
 const [newAttributeValue, setNewAttributeValue] = useState('');
 const [selectedAttributeType, setSelectedAttributeType] = useState('');
 const [usedAttributes, setUsedAttributes] = useState(new Set()); // Track used attributes


 // NEW: Keywords State
 const [keywords, setKeywords] = useState('');
 const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
 const [isEditingKeywords, setIsEditingKeywords] = useState(false);
 const [tempKeywords, setTempKeywords] = useState('');
 const [keywordStats, setKeywordStats] = useState({
   count: 0,
   charCount: 0
 });


 // Loading states for AI generation
 const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
 const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
 const [isGeneratingSkuId, setIsGeneratingSkuId] = useState(false);


 // Predefined attribute options
 const predefinedAttributes = [
   { key: 'material', label: 'Material' },
   { key: 'color', label: 'Color' },
   { key: 'size', label: 'Size' },
   { key: 'hsn code', label: 'Hsn Code' },
   { key: 'your_price', label: 'Your Price' },
   { key: 'pattern', label: 'Pattern' },
   { key: 'm.r.p.', label: 'M.R.P.' },
   { key: 'sku-id', label: 'SKU-ID' },
   { key: 'brand_name', label: 'Brand Name' },
   { key: 'custom', label: 'Custom Attribute' }
 ];


 // Fetch Golden Product from Local Storage on Component Mount
 useEffect(() => {
   try {
     const storedGoldenProduct = localStorage.getItem('goldStandardProduct');
     if (storedGoldenProduct) {
       const parsedProduct = JSON.parse(storedGoldenProduct);
       setGoldenProduct(parsedProduct);
      
       // Initialize product attributes dynamically based on golden product
       const initialAttributes = {};
       const initialUsedAttributes = new Set();


       if (parsedProduct.details) {
         // MockData format with details object
         Object.keys(parsedProduct.details).forEach(key => {
           initialAttributes[key] = '';
           initialUsedAttributes.add(key);
         });
       } else {
         // Scraped format - combine all attribute arrays
         const allArrays = [
           ...(parsedProduct.productDetailsArray || []),
           ...(parsedProduct.manufacturingDetailsArray || []),
           ...(parsedProduct.additionalInfoArray || [])
         ];
        
         allArrays.forEach(item => {
           const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '') ||
                     item.key?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
           if (key && !initialAttributes[key]) { // Avoid duplicates
             initialAttributes[key] = '';
             initialUsedAttributes.add(key);
           }
         });
        
         // If no attributes found, use mockData structure
         if (Object.keys(initialAttributes).length === 0) {
           Object.keys(goldStandardProduct.details).forEach(key => {
             initialAttributes[key] = '';
             initialUsedAttributes.add(key);
           });
         }
       }

       // Set used attributes
       setUsedAttributes(initialUsedAttributes);
      
       // Initialize Features with blank input fields
       const features = parsedProduct.features || [];
       setProductFeatures(features.map((feature, index) => ({
         id: index,
         text: feature,
         accepted: false
       })));
      
       // Initialize featureValues as empty for all features
       const initialFeatureValues = {};
       features.forEach((_, index) => {
         initialFeatureValues[index] = '';
       });
       setFeatureValues(initialFeatureValues);
      
       setProductAttributes(initialAttributes);
     } else {
       // Fallback to mockData if nothing in localStorage
       setGoldenProduct(goldStandardProduct);
      
       // Initialize attributes from mockData
       const initialAttributes = {};
       const initialUsedAttributes = new Set();
       
       Object.keys(goldStandardProduct.details).forEach(key => {
         initialAttributes[key] = '';
         initialUsedAttributes.add(key);
       });
       
       setUsedAttributes(initialUsedAttributes);
       setProductAttributes(initialAttributes);


       // Initialize features from mockData with blank input fields
       const features = goldStandardProduct.features || [];
       setProductFeatures(features.map((feature, index) => ({
         id: index,
         text: feature,
         accepted: false
       })));


       // Initialize featureValues as empty for all features
       const initialFeatureValues = {};
       features.forEach((_, index) => {
         initialFeatureValues[index] = '';
       });
       setFeatureValues(initialFeatureValues);
     }
   } catch (error) {
     console.error('Error fetching golden product from localStorage:', error);
     // Fallback to mockData
     setGoldenProduct(goldStandardProduct);
    
     const initialAttributes = {};
     const initialUsedAttributes = new Set();
     
     Object.keys(goldStandardProduct.details).forEach(key => {
       initialAttributes[key] = '';
       initialUsedAttributes.add(key);
     });

     setUsedAttributes(initialUsedAttributes);
     const features = goldStandardProduct.features || [];
     setProductFeatures(features.map((feature, index) => ({
       id: index,
       text: feature,
       accepted: false
     })));


     // Initialize featureValues as empty for all features
     const initialFeatureValues = {};
     features.forEach((_, index) => {
       initialFeatureValues[index] = '';
     });
     setFeatureValues(initialFeatureValues);


     setProductAttributes(initialAttributes);
   }
 }, []);


 // NEW: Update keyword stats when keywords change
 useEffect(() => {
   if (keywords) {
     const keywordArray = keywords.split(';').filter(k => k.trim() !== '');
    
     setKeywordStats({
       count: keywordArray.length,
       charCount: keywords.length
     });
   } else {
     setKeywordStats({
       count: 0,
       charCount: 0
     });
   }
 }, [keywords]);


 // NEW: Function to generate keywords from golden product
 const generateKeywordsFromGoldenProduct = async () => {
   if (!goldenProduct) {
     alert('Golden product data not loaded');
     return;
   }


   setIsGeneratingKeywords(true);
   try {
     const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-keywords`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         title: goldenProduct.title || '',
         category: 'Clothing',
         subcategory: getSubcategoryFromProduct(),
         details: extractKeyDetails()
       }),
     });
    
     const data = await response.json();
     if (data.success) {
       // Clean the keywords - remove any extra text like "Here are X more relevant Amazon keywords:"
       let cleanedKeywords = data.keywords;
      
       // Remove common AI response patterns
       cleanedKeywords = cleanedKeywords
         .replace(/Here are \d+ more relevant Amazon keywords:/gi, '')
         .replace(/Additional keywords:/gi, '')
         .replace(/More keywords:/gi, '')
         .replace(/Keywords:/gi, '')
         .replace(/\.$/, '') // Remove trailing period
         .trim();
      
       // Ensure proper semicolon format
       if (cleanedKeywords.includes(';')) {
         // Clean each keyword
         const keywordArray = cleanedKeywords.split(';')
           .map(k => k.trim())
           .filter(k => k.length > 0);
        
         // Remove duplicates and limit to 8
         const uniqueKeywords = [...new Set(keywordArray)].slice(0, 8);
         cleanedKeywords = uniqueKeywords.join('; ');
       }
      
       setKeywords(cleanedKeywords);
     } else {
       throw new Error(data.error || 'Failed to generate keywords');
     }
   } catch (error) {
     console.error('Error generating keywords:', error);
     alert(`Failed to generate keywords: ${error.message}`);
   } finally {
     setIsGeneratingKeywords(false);
   }
 };


 // NEW: Start editing keywords
 const startEditingKeywords = () => {
   setTempKeywords(keywords);
   setIsEditingKeywords(true);
 };


 // NEW: Save edited keywords
 const saveEditedKeywords = () => {
   setKeywords(tempKeywords);
   setIsEditingKeywords(false);
 };


 // NEW: Cancel editing keywords
 const cancelEditingKeywords = () => {
   setIsEditingKeywords(false);
 };


 // NEW: Helper function to get subcategory from product
 const getSubcategoryFromProduct = () => {
   if (!goldenProduct) return 'Clothing';
  
   if (goldenProduct.category) return goldenProduct.category;
   if (goldenProduct.title) {
     const title = goldenProduct.title.toLowerCase();
     if (title.includes('dress')) return 'Dress';
     if (title.includes('shirt')) return 'Shirt';
     if (title.includes('pant')) return 'Pants';
     if (title.includes('jacket')) return 'Jacket';
     if (title.includes('skirt')) return 'Skirt';
   }
   return 'Clothing';
 };


 // NEW: Helper function to extract key details
 const extractKeyDetails = () => {
   if (!goldenProduct) return {};
  
   const details = {};
  
   // Extract from productDetailsArray
   if (goldenProduct.productDetailsArray) {
     goldenProduct.productDetailsArray.forEach(item => {
       if (item.key && item.value) {
         details[item.key.toLowerCase()] = item.value;
       }
     });
   }
  
   // Extract from manufacturingDetailsArray
   if (goldenProduct.manufacturingDetailsArray) {
     goldenProduct.manufacturingDetailsArray.forEach(item => {
       if (item.key && item.value) {
         details[item.key.toLowerCase()] = item.value;
       }
     });
   }
  
   // Extract from details object (mockData format)
   if (goldenProduct.details) {
     Object.entries(goldenProduct.details).forEach(([key, value]) => {
       details[key.toLowerCase()] = value;
     });
   }
  
   return details;
 };


 // NEW: Function to automatically extract attributes from keywords
 const autoExtractAttributesFromKeywords = () => {
   if (!keywords.trim()) return;
  
   const keywordArray = keywords.split(';').map(k => k.trim().toLowerCase());
  
   // Common patterns to extract
   const patterns = {
     material: ['cotton', 'polyester', 'silk', 'wool', 'linen', 'denim', 'leather', 'nylon', 'spandex', 'rayon', 'viscose', 'modal'],
     color: ['black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'navy', 'maroon', 'beige', 'cream'],
     style: ['casual', 'formal', 'bohemian', 'vintage', 'modern', 'traditional', 'ethnic', 'western', 'sporty', 'elegant', 'classic'],
     pattern: ['solid', 'striped', 'floral', 'printed', 'checkered', 'polka dot', 'geometric', 'abstract', 'plain', 'patterned'],
     occasion: ['wedding', 'party', 'casual', 'office', 'beach', 'formal', 'everyday', 'evening', 'work', 'travel', 'home'],
     season: ['summer', 'winter', 'spring', 'fall', 'autumn', 'all-season', 'year-round', 'seasonal'],
     fit: ['slim', 'regular', 'loose', 'fitted', 'relaxed', 'tailored', 'oversized', 'tight', 'comfortable']
   };
  
   const updatedAttributes = { ...productAttributes };
   let extractedCount = 0;
  
   // Check each keyword against patterns
   keywordArray.forEach(keyword => {
     Object.entries(patterns).forEach(([attribute, values]) => {
       values.forEach(value => {
         if (keyword.includes(value) && (!updatedAttributes[attribute] || updatedAttributes[attribute].trim() === '')) {
           updatedAttributes[attribute] = value.charAt(0).toUpperCase() + value.slice(1);
           extractedCount++;
         }
       });
     });
   });
  
   if (extractedCount > 0) {
     setProductAttributes(updatedAttributes);
   }
 };


 // Run auto-extraction when keywords change and have at least 3 keywords
 useEffect(() => {
   if (keywords && keywordStats.count >= 3) {
     autoExtractAttributesFromKeywords();
   }
 }, [keywords]);


 // SKU-ID Handlers
 const handleAcceptSkuId = () => {
   setAcceptedSkuId(productSkuId);
   setIsEditingSkuId(false);
 };


 const handleCancelSkuId = () => {
   setProductSkuId(acceptedSkuId);
   setIsEditingSkuId(false);
 };


 const handleAIGenerateSkuId = async () => {
  setIsGeneratingSkuId(true);
  try {
    // Build request data
    const requestData = {
      title: acceptedTitle || '',
      subcategory: getSubcategoryFromProduct(),
      category: 'Clothing',
      attributes: productAttributes
    };

    // Call the new SKU generation endpoint
    const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-sku-for-listing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });
    
    const data = await response.json();
    
    if (data.success) {
      setProductSkuId(data.sku);
      setIsEditingSkuId(true);
      
      // Show explanation in console or alert
      console.log(`SKU Generated: ${data.sku}`);
      console.log(`Explanation: ${data.explanation}`);
    } else {
      // Use fallback if available
      if (data.fallback_sku) {
        setProductSkuId(data.fallback_sku);
        setIsEditingSkuId(true);
        alert(`Generated fallback SKU: ${data.fallback_sku}`);
      } else {
        throw new Error(data.error || 'Failed to generate SKU');
      }
    }
  } catch (error) {
    console.error('Error generating SKU-ID:', error);
    
    // Fallback: generate SKU locally
    const timestamp = Date.now().toString().slice(-6);
    const categoryCode = getSubcategoryFromProduct().substring(0, 2).toUpperCase();
    const fallbackSku = `${categoryCode}CL${timestamp}${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
    
    setProductSkuId(fallbackSku);
    setIsEditingSkuId(true);
    alert(`Generated fallback SKU: ${fallbackSku}`);
  } finally {
    setIsGeneratingSkuId(false);
  }
};

 const handleFeatureChange = (featureId, value) => {
   setFeatureValues(prev => ({
     ...prev,
     [featureId]: value
   }));
 };


 const handleAttributeChange = (key, value) => {
   setProductAttributes(prev => ({
     ...prev,
     [key]: value
   }));
 };


 const handleAddAttribute = () => {
   const attributeKey = selectedAttributeType === 'custom'
     ? newAttributeKey.trim().toLowerCase().replace(/\s+/g, '')
     : selectedAttributeType;
  
   if (attributeKey && newAttributeValue.trim()) {
     setProductAttributes(prev => ({
       ...prev,
       [attributeKey]: newAttributeValue.trim()
     }));
     
     // Add the selected attribute to usedAttributes (only for non-custom)
     if (selectedAttributeType !== 'custom') {
       setUsedAttributes(prev => new Set([...prev, selectedAttributeType]));
     }
     
     setNewAttributeKey('');
     setNewAttributeValue('');
     setSelectedAttributeType('');
     setShowAddAttribute(false);
   }
 };


 const handleAddFeature = () => {
   if (newFeature.trim()) {
     const newId = productFeatures.length;
     const newFeatureObj = {
       id: newId,
       text: newFeature.trim(),
       accepted: false
     };
     setProductFeatures([...productFeatures, newFeatureObj]);
     setFeatureValues(prev => ({ ...prev, [newId]: '' })); // Initialize as empty
     setNewFeature('');
   }
 };


 const handleSaveDraft = () => {
   // Build product object similar to existingProduct structure
   const newProductData = {
     id: 'NEW-' + Date.now(), // Generate unique ID
     asin: 'NEW-' + Date.now(),
     title: acceptedTitle,
     brand: null,
     amazonUrl: null, // No URL for new products
    
     // Images - empty for now (will be generated)
     images: [],
    
     // Features/Bullets - use only the values from featureValues (user input)
     features: productFeatures.map(feature =>
       featureValues[feature.id] || '' // Use only user input, fallback to empty string
     ).filter(feature => feature.trim() !== ''), // Remove empty features
    
     // Description
     description: acceptedDescription,
    
     // NEW: Include keywords
     keywords: keywords,
    
     // NEW: Include SKU-ID
     skuId: acceptedSkuId,
    
     // Convert attributes to array format matching existing product structure
     productDetailsArray: Object.entries(productAttributes).map(([key, value]) => ({
       label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim(),
       key: key,
       value: value || 'N/A'
     })),
    
     manufacturingDetailsArray: [],
     additionalInfoArray: [],
    
     // Mark as new product
     isNewProduct: true,
     
     // Add timestamp for cache invalidation
     loadedAt: new Date().toISOString(),
     version: Date.now()
   };
  
   console.log('💾 Saving new product data:', newProductData);
  
   // Clear old existing product data before storing new
   localStorage.removeItem('existingProduct');
   localStorage.removeItem('generatedImages');
   localStorage.removeItem('selectedImages');
   console.log('🗑️ Cleared old existingProduct data from localStorage');
  
   // Save to SAME localStorage key as existing product
   localStorage.setItem('existingProduct', JSON.stringify(newProductData));
   console.log('✅ Stored NEW product in existingProduct localStorage with version:', newProductData.version);
  
   // Navigate with isNewProduct flag to show 2-column layout
   navigate('/compare-images', { state: { isNewProduct: true } });
 };


 // Auto-resize textareas
 useLayoutEffect(() => {
   if (titleTextareaRef.current) {
     titleTextareaRef.current.style.height = 'auto';
     titleTextareaRef.current.style.height = titleTextareaRef.current.scrollHeight + 'px';
   }
 }, [productTitle]);


 useLayoutEffect(() => {
   if (descTextareaRef.current) {
     descTextareaRef.current.style.height = 'auto';
     descTextareaRef.current.style.height = descTextareaRef.current.scrollHeight + 'px';
   }
 }, [productDescription]);


 // Title Handlers
 const handleAcceptTitle = () => {
   setAcceptedTitle(productTitle);
   setIsEditingTitle(false);
 };


 const handleCancelTitle = () => {
   setProductTitle(acceptedTitle);
   setIsEditingTitle(false);
 };


 const handleAIGenerateTitle = async () => {
   setIsGeneratingTitle(true);
   try {
     const subcategory = 'Product'; // You can make this dynamic
    
     // Clean product attributes before sending - create readable labels
     const cleanedProductDetails = {};
     Object.entries(productAttributes).forEach(([key, value]) => {
       if (value && value.trim()) {
         // Convert camelCase or lowercase keys to readable labels
         const readableKey = key
           .replace(/([A-Z])/g, ' $1') // Add space before capital letters
           .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lower and upper
           .trim()
           .split(' ')
           .map(word => word.charAt(0).toUpperCase() + word.slice(1))
           .join(' ');
        
         cleanedProductDetails[readableKey] = value.trim();
       }
     });


     if (Object.keys(cleanedProductDetails).length === 0) {
       alert('Please fill in some product attributes before generating Listro title.');
       setIsGeneratingTitle(false);
       return;
     }


     console.log('🎯 Sending to Listro (Title):', cleanedProductDetails);


     const generatedTitle = await generateProductTitle(subcategory, cleanedProductDetails);
     setProductTitle(generatedTitle);
     setIsEditingTitle(true);
   } catch (error) {
     console.error('Error generating title:', error);
     alert(`Failed to generate title: ${error.message}`);
   } finally {
     setIsGeneratingTitle(false);
   }
 };


 // Description Handlers
 const handleAcceptDescription = () => {
   setAcceptedDescription(productDescription);
   setIsEditingDescription(false);
 };


 const handleCancelDescription = () => {
   setProductDescription(acceptedDescription);
   setIsEditingDescription(false);
 };


 const handleAIGenerateDescription = async () => {
   setIsGeneratingDescription(true);
   try {
     const subcategory = 'Product'; // You can make this dynamic
    
     // Clean product attributes before sending - create readable labels
     const cleanedProductDetails = {};
     Object.entries(productAttributes).forEach(([key, value]) => {
       if (value && value.trim()) {
         // Convert camelCase or lowercase keys to readable labels
         const readableKey = key
           .replace(/([A-Z])/g, ' $1') // Add space before capital letters
           .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lower and upper
           .trim()
           .split(' ')
           .map(word => word.charAt(0).toUpperCase() + word.slice(1))
           .join(' ');
        
         cleanedProductDetails[readableKey] = value.trim();
       }
     });


     if (Object.keys(cleanedProductDetails).length === 0) {
       alert('Please fill in some product attributes before generating Listro description.');
       setIsGeneratingDescription(false);
       return;
     }


     console.log('🎯 Sending to Listro (Description):', cleanedProductDetails);


     const generatedDescription = await generateProductDescription(subcategory, cleanedProductDetails);
     setProductDescription(generatedDescription);
     setIsEditingDescription(true);
   } catch (error) {
     console.error('Error generating description:', error);
     alert(`Failed to generate description: ${error.message}`);
   } finally {
     setIsGeneratingDescription(false);
   }
 };


 const calculateProgress = () => {
   // Count filled fields dynamically
   let totalFields = 0;
   let filledFields = 0;


   // 1. SKU-ID field
   totalFields += 1;
   if (productSkuId.trim() !== '') filledFields += 1;


   // 2. Title field
   totalFields += 1;
   if (productTitle.trim() !== '') filledFields += 1;


   // 3. Description field
   totalFields += 1;
   if (productDescription.trim() !== '') filledFields += 1;


   // 4. NEW: Keywords field
   totalFields += 1;
   if (keywords.trim() !== '') filledFields += 1;


   // 5. All attribute fields (including custom attributes)
   Object.entries(productAttributes).forEach(([key, value]) => {
     totalFields += 1;
     if (value && value.trim() !== '') {
       filledFields += 1;
     }
   });


   // 6. All feature fields - check only featureValues (user input)
   productFeatures.forEach(feature => {
     totalFields += 1;
     const featureValue = featureValues[feature.id]; // Only check user input
     if (featureValue && featureValue.trim() !== '') {
       filledFields += 1;
     }
   });


   return { filled: filledFields, total: totalFields };
 };


 // Helper function to get description from golden product
 const getDescription = () => {
   if (!goldenProduct) return '';
   // Try different possible description fields
   return goldenProduct.description ||
          (goldenProduct.features && goldenProduct.features.length > 0 ? goldenProduct.features.join(' • ') : '') ||
          'No description available';
 };


 // Helper function to get all attribute sections
 const getAllAttributeSections = () => {
   if (!goldenProduct) return [];
  
   const sections = [];
  
   // Product Details
   if (goldenProduct.productDetailsArray && goldenProduct.productDetailsArray.length > 0) {
     sections.push({
       title: 'Product Details',
       color: 'blue',
       items: goldenProduct.productDetailsArray
     });
   }
  
   // Manufacturing Details
   if (goldenProduct.manufacturingDetailsArray && goldenProduct.manufacturingDetailsArray.length > 0) {
     sections.push({
       title: 'Manufacturing Details',
       color: 'green',
       items: goldenProduct.manufacturingDetailsArray
     });
   }
  
   // Additional Info
   if (goldenProduct.additionalInfoArray && goldenProduct.additionalInfoArray.length > 0) {
     sections.push({
       title: 'Additional Information',
       color: 'purple',
       items: goldenProduct.additionalInfoArray
     });
   }
  
   return sections;
 };


 const progress = calculateProgress();
 // FIXED: Proceed button should always be active
 const isFormComplete = true; // Always true so proceed button is always active


 // Show loading state while fetching golden product
 if (!goldenProduct) {
   return (
     <div className="min-h-screen bg-gray-50 flex items-center justify-center">
       <div className="text-center">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
         <p className="mt-4 text-gray-600">Loading golden product data...</p>
       </div>
     </div>
   );
 }


 return (
   <div className="min-h-screen bg-gray-50">
     <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
       {/* Page Header */}
       <div className="text-center mb-6">
         <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Listing</h1>
         <p className="text-sm text-gray-600">
           Use the Gold Standard as your guide to create an optimized product listing
         </p>
       </div>


       {/* Main Content Container */}
       <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        
         {/* Column Headers */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 pb-4 border-b border-gray-200">
           {/* Left Column Header */}
           <div className="flex items-center gap-2">
             <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
             <h2 className="text-xl font-semibold text-gray-900">Gold Standard Listing</h2>
           </div>
           {/* Right Column Header */}
           <div>
             <h2 className="text-xl font-semibold text-gray-900">Your New Listing</h2>
           </div>
         </div>


         {/* =========================== */}
         {/* NEW: KEYWORDS SECTION - FIXED VERSION */}
         {/* =========================== */}
         <div className="mb-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
             <div>
               <h3 className="text-lg font-semibold text-gray-700">Reference Keywords</h3>
               <p className="text-sm text-gray-500 mt-1">
                 Keywords from gold standard (for reference)
               </p>
             </div>
             <div>
               <div className="flex items-center justify-between">
                 <h3 className="text-lg font-semibold text-gray-700">Listing Keywords</h3>
                 <div className="flex items-center gap-2">
                   <button
                     className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                     onClick={generateKeywordsFromGoldenProduct}
                     disabled={isGeneratingKeywords}
                   >
                     <Wand2 className={`h-4 w-4 ${isGeneratingKeywords ? 'animate-spin' : ''}`} />
                     <span>{isGeneratingKeywords ? 'Generating...' : 'Listro Generate'}</span>
                   </button>
                 </div>
               </div>
               <p className="text-sm text-gray-500 mt-1">
                 Enter 7-8 keywords (separated by ;) - Max 250 characters
               </p>
             </div>
           </div>
          
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Left: Gold Standard Keywords Reference - FIXED SIZE */}
             <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4 min-h-[144px]">
               <div className="bg-white/60 rounded-md p-3 border border-yellow-200 h-full flex flex-col">
                 <div className="flex flex-wrap gap-2 mb-2">
                   {(() => {
                     // Extract keywords from golden product
                     const extractedKeywords = [];
                     if (goldenProduct.title) {
                       const titleWords = goldenProduct.title.split(/\s+/).filter(word => word.length > 2 && !['for', 'and', 'the', 'with', 'this', 'that', 'from'].includes(word.toLowerCase()));
                       extractedKeywords.push(...titleWords.slice(0, 4));
                     }
                    
                     // Get unique keywords, limit to 8
                     const uniqueKeywords = [...new Set(extractedKeywords)].slice(0, 8);
                    
                     return uniqueKeywords.map((keyword, index) => (
                       <span
                         key={index}
                         className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300"
                       >
                         {keyword}
                       </span>
                     ));
                   })()}
                 </div>
                 <p className="text-xs text-gray-500 mt-auto italic">
                   Keywords extracted from gold standard listing
                 </p>
               </div>
             </div>


             {/* Right: Your Keywords Input - FIXED SIZE */}
             <div className="space-y-3">
               {isEditingKeywords ? (
                 <div className="space-y-3">
                   <textarea
                     className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[100px]"
                     value={tempKeywords}
                     onChange={e => setTempKeywords(e.target.value)}
                     placeholder="Enter keywords separated by semicolons (;)..."
                     maxLength={250}
                   />
                   <div className="flex gap-2">
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                       onClick={saveEditedKeywords}
                     >
                       <Check className="h-4 w-4" />
                       <span>Save Keywords</span>
                     </button>
                     <button
                       className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                       onClick={cancelEditingKeywords}
                     >
                       Cancel
                     </button>
                   </div>
                 </div>
               ) : (
                 <>
                   <div className="relative min-h-[144px]">
                     <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white h-full">
                       {keywords ? (
                         <div className="h-full overflow-y-auto">
                           <div className="flex flex-wrap gap-2">
                             {keywords.split(';')
                               .map(k => k.trim())
                               .filter(k => k.length > 0)
                               .map((keyword, index) => (
                                 <span
                                   key={index}
                                   className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"
                                 >
                                   {keyword}
                                 </span>
                               ))
                             }
                           </div>
                           {/* Show empty state if no keywords */}
                           {keywords.split(';').filter(k => k.trim()).length === 0 && (
                             <div className="text-gray-400 italic h-full flex items-center justify-center">
                               Enter keywords separated by semicolons (;)
                             </div>
                           )}
                         </div>
                       ) : (
                         <div className="text-gray-400 italic h-full flex items-center justify-center">
                           Enter keywords separated by semicolons (;)
                         </div>
                       )}
                     </div>
                     <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-1 rounded">
                       {keywordStats.charCount}/250 chars
                     </div>
                   </div>
                  
                   {/* Keywords Stats - SIMPLIFIED */}
                   <div className="flex items-center justify-between text-sm text-gray-600">
                     <div>
                       <span>Keywords: <strong>{keywordStats.count}</strong>/8 recommended</span>
                     </div>
                    
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                       onClick={startEditingKeywords}
                     >
                       <Edit2 className="h-4 w-4" />
                       <span>Edit Keywords</span>
                     </button>
                   </div>
                 </>
               )}
              
               {/* Keyword Tips - SIMPLIFIED */}
               <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                 <p className="text-xs text-blue-800">
                   💡 <strong>Tip:</strong> Keywords auto-extract attributes. Enter 7-8 relevant keywords separated by semicolons.
                 </p>
               </div>
             </div>
           </div>
         </div>


         {/* Product Attributes Section */}
         <div className="mb-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
             <h3 className="text-lg font-semibold text-gray-700">Golden Listing Attributes</h3>
             <h3 className="text-lg font-semibold text-gray-700">New Listing Attributes</h3>
           </div>
           <div className="space-y-3">
             {goldenProduct.details ? (
               // MockData format - side by side display
               <>
                 {Object.entries(productAttributes).map(([key, value]) => (
                   <div key={key} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Left: Gold Standard Attribute */}
                     <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-3">
                       <div className="text-xs font-semibold text-gray-600 mb-2 capitalize">
                         {key.replace(/([A-Z])/g, ' $1').trim()}
                       </div>
                       <p className="text-sm font-medium text-gray-800">
                         {goldenProduct.details[key]}
                       </p>
                     </div>


                     {/* Right: Your Product Attribute Input */}
                     <div className="bg-white border border-gray-200 rounded-lg p-3">
                       <div className="text-xs font-semibold text-gray-600 mb-2 capitalize">
                         {key.replace(/([A-Z])/g, ' $1').trim()}
                       </div>
                       <input
                         type="text"
                         className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                         value={value}
                         onChange={e => handleAttributeChange(key, e.target.value)}
                         placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}...`}
                       />
                     </div>
                   </div>
                 ))}
               </>
             ) : (
               // Scraped format with multiple arrays - side by side display
               <>
                 {(() => {
                   const allAttributes = [];
                   const seenKeys = new Set();
                   const normalizeKey = (key) => {
                     if (!key) return '';
                     return key.trim()
                       .replace(/[\n\r\s:‏‎]+/g, '')
                       .toLowerCase();
                   };


                   // Collect all attributes from all sections with deduplication
                   if (goldenProduct.productDetailsArray && goldenProduct.productDetailsArray.length > 0) {
                     goldenProduct.productDetailsArray.forEach((item) => {
                       const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                       const normalizedKey = normalizeKey(item.label || item.key || '');
                       if (!seenKeys.has(normalizedKey)) {
                         seenKeys.add(normalizedKey);
                         allAttributes.push({ ...item, inputKey: key });
                       }
                     });
                   }
                  
                   if (goldenProduct.manufacturingDetailsArray && goldenProduct.manufacturingDetailsArray.length > 0) {
                     goldenProduct.manufacturingDetailsArray.forEach((item) => {
                       const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                       const normalizedKey = normalizeKey(item.label || item.key || '');
                       if (!seenKeys.has(normalizedKey)) {
                         seenKeys.add(normalizedKey);
                         allAttributes.push({ ...item, inputKey: key });
                       }
                     });
                   }
                  
                   if (goldenProduct.additionalInfoArray && goldenProduct.additionalInfoArray.length > 0) {
                     goldenProduct.additionalInfoArray.forEach((item) => {
                       const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                       const normalizedKey = normalizeKey(item.label || item.key || '');
                       if (!seenKeys.has(normalizedKey)) {
                         seenKeys.add(normalizedKey);
                         allAttributes.push({ ...item, inputKey: key });
                       }
                     });
                   }


                   // Render deduplicated attributes side by side
                   return allAttributes.map((item, index) => (
                     <div key={`attr-${index}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                       {/* Left: Gold Standard Attribute */}
                       <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-3">
                         <div className="text-xs font-semibold text-gray-600 mb-2">
                           {item.label || item.key || 'Attribute'}
                         </div>
                         <p className="text-sm font-medium text-gray-800">{item.value || 'N/A'}</p>
                       </div>


                       {/* Right: Your Product Attribute Input */}
                       <div className="bg-white border border-gray-200 rounded-lg p-3">
                         <div className="text-xs font-semibold text-gray-600 mb-2">
                           {item.label || item.key || 'Attribute'}
                         </div>
                         <input
                           type="text"
                           className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                           value={productAttributes[item.inputKey] || ''}
                           onChange={e => handleAttributeChange(item.inputKey, e.target.value)}
                           placeholder={`Enter ${item.label?.toLowerCase() || 'value'}...`}
                         />
                       </div>
                     </div>
                   ));
                 })()}
                
                 {/* Custom Added Attributes Section */}
                 {(() => {
                   // Get all keys from golden product
                   const goldenKeys = new Set();
                  
                   if (goldenProduct.productDetailsArray) {
                     goldenProduct.productDetailsArray.forEach(item => {
                       const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                       if (key) goldenKeys.add(key);
                     });
                   }
                  
                   if (goldenProduct.manufacturingDetailsArray) {
                     goldenProduct.manufacturingDetailsArray.forEach(item => {
                       const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                       if (key) goldenKeys.add(key);
                     });
                   }
                  
                   if (goldenProduct.additionalInfoArray) {
                     goldenProduct.additionalInfoArray.forEach(item => {
                       const key = item.label?.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
                       if (key) goldenKeys.add(key);
                     });
                   }
                  
                   // Find custom attributes (not in golden product)
                   const customAttributes = Object.entries(productAttributes).filter(([key]) => !goldenKeys.has(key));
                  
                   return customAttributes.length > 0 && (
                     <>
                       {customAttributes.map(([key, value]) => (
                         <div key={`custom-${key}`} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                           {/* Left: Empty placeholder */}
                           <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                             <div className="text-xs font-semibold text-gray-600 mb-2 capitalize">
                               {key.replace(/([A-Z])/g, ' $1').trim()}
                             </div>
                             <p className="text-sm text-gray-400 italic">Custom attribute</p>
                           </div>
                          
                           {/* Right: Custom Attribute Input */}
                           <div className="bg-white border border-gray-200 rounded-lg p-3">
                             <div className="text-xs font-semibold text-gray-600 mb-2 capitalize">
                               {key.replace(/([A-Z])/g, ' $1').trim()}
                             </div>
                             <input
                               type="text"
                               className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                               value={value}
                               onChange={e => handleAttributeChange(key, e.target.value)}
                               placeholder={`Enter ${key.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}...`}
                             />
                           </div>
                         </div>
                       ))}
                     </>
                   );
                 })()}
               </>
             )}
            
             {/* Add Attribute Button/Form */}
             {showAddAttribute ? (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div></div>
                 <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                   <div className="space-y-2">
                     {/* Dropdown for attribute selection */}
                     <select
                       className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                       value={selectedAttributeType}
                       onChange={e => setSelectedAttributeType(e.target.value)}
                     >
                       <option value="">Select Attribute Type</option>
                       {predefinedAttributes.map(attr => {
                         const isUsed = usedAttributes.has(attr.key);
                         return (
                           <option 
                             key={attr.key} 
                             value={attr.key}
                             disabled={isUsed && attr.key !== 'custom'}
                             className={isUsed ? 'text-gray-400' : ''}
                           >
                             {attr.label} {isUsed && attr.key !== 'custom' ? '(Already Used)' : ''}
                           </option>
                         );
                       })}
                     </select>
                    
                     {/* Show custom attribute name input only if "Custom Attribute" is selected */}
                     {selectedAttributeType === 'custom' && (
                       <input
                         type="text"
                         placeholder="Custom Attribute Name (e.g., Brand)"
                         className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                         value={newAttributeKey}
                         onChange={e => setNewAttributeKey(e.target.value)}
                       />
                     )}
                    
                     {/* Attribute value input */}
                     <input
                       type="text"
                       placeholder={`Enter ${selectedAttributeType === 'custom' ? 'attribute' : selectedAttributeType || 'attribute'} value...`}
                       className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                       value={newAttributeValue}
                       onChange={e => setNewAttributeValue(e.target.value)}
                       disabled={!selectedAttributeType}
                     />
                    
                     <div className="flex gap-2">
                       <button
                         className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors text-sm ${
                           selectedAttributeType && newAttributeValue.trim() && (selectedAttributeType !== 'custom' || newAttributeKey.trim())
                             ? 'bg-green-600 text-white hover:bg-green-700'
                             : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                         }`}
                         onClick={handleAddAttribute}
                         disabled={!selectedAttributeType || !newAttributeValue.trim() || (selectedAttributeType === 'custom' && !newAttributeKey.trim())}
                       >
                         <Check className="h-3.5 w-3.5" />
                         <span>Add</span>
                       </button>
                       <button
                         className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                         onClick={() => {
                           setShowAddAttribute(false);
                           setNewAttributeKey('');
                           setNewAttributeValue('');
                           setSelectedAttributeType('');
                         }}
                       >
                         Cancel
                       </button>
                     </div>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div></div>
                 <button
                   className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm justify-center"
                   onClick={() => setShowAddAttribute(true)}
                 >
                   <Plus className="h-4 w-4" />
                   <span>Add New Attribute</span>
                 </button>
               </div>
             )}
           </div>
         </div>


         {/* About This Item (Features/Bullet Points) Section */}
         <div className="mb-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
             <h3 className="text-lg font-semibold text-gray-700">About This Item</h3>
             <h3 className="text-lg font-semibold text-gray-700">About This Item</h3>
           </div>
          
           {/* Create aligned rows for each feature */}
           <div className="space-y-4">
             {productFeatures.map((feature, index) => (
               <div key={feature.id} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Left: Gold Standard Feature */}
                 <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4">
                   <div className="bg-white/60 rounded-md p-3 border border-yellow-200">
                     {goldenProduct.features && goldenProduct.features[index] ? (
                       <div className="flex items-start">
                         <span className="text-yellow-600 mr-2">•</span>
                         <span className="text-gray-800 text-sm leading-relaxed">
                           {goldenProduct.features[index]}
                         </span>
                       </div>
                     ) : (
                       <p className="text-gray-500 text-sm italic">No corresponding feature</p>
                     )}
                   </div>
                 </div>


                 {/* Right: Blank Feature Input Field */}
                 <div className="bg-white border border-gray-300 rounded-lg p-4">
                   <div className="flex items-start">
                     <span className="text-blue-600 mr-2 mt-1">•</span>
                     <div className="flex-1">
                       <input
                         type="text"
                         className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                         value={featureValues[feature.id] || ''} // Always starts blank
                         onChange={e => handleFeatureChange(feature.id, e.target.value)}
                         placeholder="Enter feature description..."
                       />
                     </div>
                   </div>
                 </div>
               </div>
             ))}
            
             {/* Add New Feature Section */}
             {productFeatures.length > 0 && (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* Empty left side for alignment */}
                 <div></div>
                
                 {/* Right: Add New Feature Input */}
                 <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                   <div className="space-y-2">
                     <input
                       type="text"
                       placeholder="Add new feature..."
                       className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                       value={newFeature}
                       onChange={e => setNewFeature(e.target.value)}
                       onKeyPress={(e) => {
                         if (e.key === 'Enter' && newFeature.trim()) {
                           handleAddFeature();
                         }
                       }}
                     />
                     <button
                       className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors text-sm ${
                         newFeature.trim()
                           ? 'bg-green-600 text-white hover:bg-green-700'
                           : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                       }`}
                       onClick={handleAddFeature}
                       disabled={!newFeature.trim()}
                     >
                       <Plus className="h-3.5 w-3.5" />
                       <span>Add Feature</span>
                     </button>
                   </div>
                 </div>
               </div>
             )}
           </div>
         </div>


         {/* =========================== */}
         {/* NEW: PRODUCT SKU-ID SECTION */}
         {/* =========================== */}
         <div className="mb-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
             <h3 className="text-lg font-semibold text-gray-700">Golden Listing SKU-ID</h3>
             <h3 className="text-lg font-semibold text-gray-700">New Listing SKU-ID</h3>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Left: Gold Standard SKU-ID Reference */}
             <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4 h-full flex items-center">
               <div className="bg-white/60 rounded-md p-3 border border-yellow-200 w-full">
                 <p className="text-gray-800 text-sm leading-relaxed">
                   {(() => {
                     // Extract SKU-ID from golden product
                     if (goldenProduct.details && goldenProduct.details.skuId) {
                       return goldenProduct.details.skuId;
                     }
                     // Try to find SKU-ID in productDetailsArray
                     if (goldenProduct.productDetailsArray) {
                       const skuItem = goldenProduct.productDetailsArray.find(item => 
                         item.key && item.key.toLowerCase().includes('sku') ||
                         item.label && item.label.toLowerCase().includes('sku')
                       );
                       if (skuItem) return skuItem.value;
                     }
                     return 'No SKU-ID reference available';
                   })()}
                 </p>
               </div>
             </div>


             {/* Right: Your Product SKU-ID Input with Generation */}
             <div className="h-full flex flex-col">
               {isEditingSkuId ? (
                 <div className="space-y-3">
                   <input
                     type="text"
                     className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                     value={productSkuId}
                     onChange={e => setProductSkuId(e.target.value)}
                     placeholder="Enter your product SKU-ID..."
                   />
                   <div className="flex gap-2">
                     <button
                       className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                       onClick={handleAcceptSkuId}
                     >
                       <Check className="h-4 w-4" />
                       <span>Accept</span>
                     </button>
                     <button
                       className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                       onClick={handleCancelSkuId}
                     >
                       Cancel
                     </button>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-3">
                   <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 min-h-[60px] flex items-center">
                     {acceptedSkuId || <span className="text-gray-400 italic">No SKU-ID yet</span>}
                   </div>
                   <div className="flex flex-wrap gap-2">
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                       onClick={handleAIGenerateSkuId}
                       disabled={isGeneratingSkuId}
                     >
                       <Hash className={`h-4 w-4 ${isGeneratingSkuId ? 'animate-spin' : ''}`} />
                       <span>{isGeneratingSkuId ? 'Generating...' : 'Listro Generate'}</span>
                     </button>
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                       onClick={() => setIsEditingSkuId(true)}
                     >
                       <Edit2 className="h-4 w-4" />
                       <span>Edit</span>
                     </button>
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>


         {/* Product Title Section */}
         <div className="mb-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
             <h3 className="text-lg font-semibold text-gray-700"> Title</h3>
             <h3 className="text-lg font-semibold text-gray-700"> Title</h3>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Left: Gold Standard Product Title */}
             <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4 h-full flex items-center">
               <div className="bg-white/60 rounded-md p-3 border border-yellow-200 w-full">
                 <p className="text-gray-800 text-sm leading-relaxed">
                   {goldenProduct.title}
                 </p>
               </div>
             </div>


             {/* Right: Your Product Title Input with AI Generation */}
             <div className="h-full flex flex-col">
               {isEditingTitle ? (
                 <div className="space-y-3">
                   <textarea
                     ref={titleTextareaRef}
                     className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                     value={productTitle}
                     onChange={e => setProductTitle(e.target.value)}
                     rows={3}
                     placeholder="Enter your product title..."
                   />
                   <div className="flex gap-2">
                     <button
                       className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                       onClick={handleAcceptTitle}
                     >
                       <Check className="h-4 w-4" />
                       <span>Accept</span>
                     </button>
                     <button
                       className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                       onClick={handleCancelTitle}
                     >
                       Cancel
                     </button>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-3">
                   <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 min-h-[60px]">
                     {acceptedTitle || <span className="text-gray-400 italic">No title yet</span>}
                   </div>
                   <div className="flex flex-wrap gap-2">
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                       onClick={handleAIGenerateTitle}
                       disabled={isGeneratingTitle}
                     >
                       <Wand2 className={`h-4 w-4 ${isGeneratingTitle ? 'animate-spin' : ''}`} />
                       <span>{isGeneratingTitle ? 'Generating...' : 'Listro Generate'}</span>
                     </button>
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                       onClick={() => setIsEditingTitle(true)}
                     >
                       <Edit2 className="h-4 w-4" />
                       <span>Edit</span>
                     </button>
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>


         {/* Product Description Section */}
         <div className="mb-8">
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
             <h3 className="text-lg font-semibold text-gray-700"> Description</h3>
             <h3 className="text-lg font-semibold text-gray-700"> Description</h3>
           </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Left: Gold Standard Description */}
             <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4 h-full flex items-center">
               <div className="bg-white/60 rounded-md p-3 border border-yellow-200 w-full">
                 <p className="text-gray-800 text-sm leading-relaxed">
                   {getDescription()}
                 </p>
               </div>
             </div>


             {/* Right: Your Product Description Input with AI Generation */}
             <div className="h-full flex flex-col">
               {isEditingDescription ? (
                 <div className="space-y-3">
                   <textarea
                     ref={descTextareaRef}
                     className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                     value={productDescription}
                     onChange={e => setProductDescription(e.target.value)}
                     rows={4}
                     placeholder="Enter your product description..."
                   />
                   <div className="flex gap-2">
                     <button
                       className="flex items-center space-x-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                       onClick={handleAcceptDescription}
                     >
                       <Check className="h-4 w-4" />
                       <span>Accept</span>
                     </button>
                     <button
                       className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                       onClick={handleCancelDescription}
                     >
                       Cancel
                     </button>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-3">
                   <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 min-h-[80px]">
                     {acceptedDescription || <span className="text-gray-400 italic">No description yet</span>}
                   </div>
                   <div className="flex flex-wrap gap-2">
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                       onClick={handleAIGenerateDescription}
                       disabled={isGeneratingDescription}
                     >
                       <Wand2 className={`h-4 w-4 ${isGeneratingDescription ? 'animate-spin' : ''}`} />
                       <span>{isGeneratingDescription ? 'Generating...' : 'Listro Generate'}</span>
                     </button>
                     <button
                       className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                       onClick={() => setIsEditingDescription(true)}
                     >
                       <Edit2 className="h-4 w-4" />
                       <span>Edit</span>
                     </button>
                   </div>
                 </div>
               )}
             </div>
           </div>
         </div>


       </div>


       {/* Action Bar */}
       <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
         <div className="flex items-center justify-between">
           <div className="text-sm text-gray-600">
             <span className="font-medium">Progress:</span>
             <span className="ml-2">{progress.filled} of {progress.total} fields completed</span>
           </div>
           <button
             onClick={handleSaveDraft}
             // FIXED: Proceed button should always be active
             className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium cursor-pointer"
           >
             <Save className="h-4 w-4" />
             <span>Proceed</span>
           </button>
         </div>
       </div>


       {/* Tips Section */}
       <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
         <h4 className="font-medium text-blue-900 mb-2 text-sm flex items-center gap-2">
           <span>💡</span> Optimization Tips
         </h4>
         <ul className="text-sm text-blue-800 space-y-1.5">
           <li>• Generate keywords from the gold standard listing for inspiration</li>
           <li>• Keywords auto-extract attributes when you enter them</li>
           <li>• Use relevant keywords in your title for better searchability</li>
           <li>• Include specific listing details and benefits in the description</li>
           <li>• Fill in all attributes to provide complete listing information</li>
           <li>• Reference the gold standard for inspiration on structure and content</li>
         </ul>
       </div>
     </div>
   </div>
 );
};


export default NewProductCreationPage;

