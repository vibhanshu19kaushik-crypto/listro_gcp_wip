import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Wand2, Check, Edit2, Eye, ExternalLink, Star, Plus, Loader2, ChevronDown, Hash } from 'lucide-react';
import { goldStandardProduct } from '../data/mockData.js';
import { useNavigate, useLocation } from 'react-router-dom';
import { scrapeProductFromUrl } from '../api/api.js';
import { NODE_API_BASE_URL, PYTHON_API_BASE_URL } from '../api/config.js';

// Component for editable attributes (not features - for product details like brand, fabric, etc.)
function AttributeEditableCell({ attributeKey, initialValue, onAccept, isAccepted }) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [acceptedValue, setAcceptedValue] = useState(initialValue);

  const handleAccept = () => {
    setAcceptedValue(value);
    setIsEditing(false);
    onAccept();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-600">{attributeKey}</div>
        {isAccepted && (
          <div className="flex items-center text-green-600">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
              onClick={handleAccept}
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept</span>
            </button>
            <button
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
              onClick={() => {
                setValue(acceptedValue);
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-gray-800 text-sm flex-1">{acceptedValue}</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </button>
            {!isAccepted && (
              <button
                className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs"
                onClick={handleAccept}
              >
                <Check className="h-3 w-3" />
                <span>Accept</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ProductComparator = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Golden Product Data from Local Storage
  const [goldenProduct, setGoldenProduct] = useState(null);
  // URL Input State
  const [productUrl, setProductUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  // Product Title State
  const [productTitle, setProductTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [acceptedTitle, setAcceptedTitle] = useState('');
  const [originalTitle, setOriginalTitle] = useState('');
  const titleTextareaRef = useRef(null);
  // About this Item State
  const [productFeatures, setProductFeatures] = useState([]);
  const [editingFeatures, setEditingFeatures] = useState({});
  const [featureValues, setFeatureValues] = useState({});
  const [showAddFeature, setShowAddFeature] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  // Product Description State
  const [productDescription, setProductDescription] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [acceptedDescription, setAcceptedDescription] = useState('');
  const [originalDescription, setOriginalDescription] = useState('');
  const descTextareaRef = useRef(null);

  // Product Attributes State (details like brand, fabric, etc.)
  const [productAttributes, setProductAttributes] = useState([]);
  const [editingAttributes, setEditingAttributes] = useState({});
  const [attributeValues, setAttributeValues] = useState({});
  const [showAddAttribute, setShowAddAttribute] = useState(false);
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [selectedAttributeType, setSelectedAttributeType] = useState('');

  // Predefined attribute options
  const [predefinedAttributes, setPredefinedAttributes] = useState([
    { key: 'material', label: 'Material', used: false },
    { key: 'color', label: 'Color', used: false },
    { key: 'size', label: 'Size', used: false },
    { key: 'hsn code', label: 'Hsn Code', used: false },
    { key: 'your_price', label: 'Your Price', used: false },
    { key: 'pattern', label: 'Pattern', used: false },
    { key: 'm.r.p.', label: 'M.R.P.', used: false },
    { key: 'sku-id', label: 'SKU-ID', used: false },
    { key: 'brand_name', label: 'Brand Name', used: false },
    { key: 'custom', label: 'Custom Attribute', used: false }
  ]);

  // Loading states for AI generation
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // ASIN Dropdown State
  const [asinDropdownOpen, setAsinDropdownOpen] = useState(false);
  const [asinList, setAsinList] = useState([]);
  const [selectedAsin, setSelectedAsin] = useState('');
  const [isLoadingAsins, setIsLoadingAsins] = useState(false);

  // Freeze ASIN selection state
  const [isAsinSelectionFrozen, setIsAsinSelectionFrozen] = useState(false);

  // UI behavior flag: when user chose "Edit Existing Listing" in previous step,
  // the URL/ASIN are predetermined and we auto-load without showing the Load URL button.
  const isEditExistingFlow =
    localStorage.getItem('actionType') === 'edit' &&
    !!localStorage.getItem('comparisonPageSelectedAsin');

  // Product SKU-ID State (matching NewProductCreationPage format)
  const [productSkuId, setProductSkuId] = useState('');
  const [isEditingSkuId, setIsEditingSkuId] = useState(false);
  const [acceptedSkuId, setAcceptedSkuId] = useState('');
  const [isGeneratingSkuId, setIsGeneratingSkuId] = useState(false);

  // Save state
  const [lastSavedTime, setLastSavedTime] = useState(null);

  // Track if we need to save on unmount
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load golden product from localStorage (already scraped in ComparisonSetupPage)
  useEffect(() => {
    const loadGoldenProduct = () => {
      try {
        const storedGoldenProduct = localStorage.getItem('goldStandardProduct');
        console.log('🔍 Loading Golden Product from localStorage...');
        
        if (storedGoldenProduct) {
          const parsedProduct = JSON.parse(storedGoldenProduct);
          console.log('🌟 Golden Product loaded successfully:', {
            asin: parsedProduct.asin,
            title: parsedProduct.title?.substring(0, 50),
            category: parsedProduct.category,
            hasProductOverviewArray: !!parsedProduct.productOverviewArray,
            productOverviewCount: parsedProduct.productOverviewArray?.length || 0,
            hasProductInformationArrays: !!parsedProduct.productInformationArrays,
            productInformationSections: Object.keys(parsedProduct.productInformationArrays || {}).length,
            hasTechnicalDetails: !!parsedProduct.technicalDetails,
            technicalDetailsCount: parsedProduct.technicalDetails ? Object.keys(parsedProduct.technicalDetails).length : 0
          });

          // Set the golden product (already in correct format from ComparisonSetupPage)
          setGoldenProduct(parsedProduct);
          console.log('✅ Golden product loaded and ready');
        } else {
          console.log('ℹ️ No golden product found in localStorage');
        }
      } catch (error) {
        console.error('❌ Error loading golden product:', error);
      }
    };

    loadGoldenProduct();
  }, []); // Run once on mount

  // Re-align attributes when golden product is loaded AND scraped data is available
  useEffect(() => {
    if (goldenProduct && scrapedData) {
      console.log('🔄 Both golden product and scraped data available - aligning attributes...');
      console.log('Golden product structure:', {
        productOverviewArray: goldenProduct.productOverviewArray?.length || 0,
        productInformationArrays: Object.keys(goldenProduct.productInformationArrays || {}).length,
        technicalDetails: goldenProduct.technicalDetails ? Object.keys(goldenProduct.technicalDetails).length : 0
      });
      console.log('Scraped data structure:', {
        productOverviewArray: scrapedData.productOverviewArray?.length || 0,
        productInformationArrays: Object.keys(scrapedData.productInformationArrays || {}).length,
        technicalDetails: scrapedData.technicalDetails ? Object.keys(scrapedData.technicalDetails).length : 0
      });
      
      // Process attributes with both golden and scraped data
      const alignedAttrs = getAlignedAttributesFromData(scrapedData);
      console.log('🔗 Aligned attributes count:', alignedAttrs.length);
      
      const initialValues = {};
      alignedAttrs.forEach(attr => {
        initialValues[attr.id] = attr.scrapedValue;
      });
      
      setAttributeValues(initialValues);
      setProductAttributes(alignedAttrs.map(attr => ({
        ...attr,
        accepted: false
      })));
      
      console.log('✅ Attributes aligned successfully');
    }
  }, [goldenProduct, scrapedData]); // Re-run when either changes

  // Set up auto-save on page leave
  useEffect(() => {
    // Function to save data automatically
    const autoSave = () => {
      if (scrapedData && hasUnsavedChanges) {
        saveToCacheSilently();
      }
    };

    // Save when component unmounts (page switch)
    return () => {
      autoSave();
    };
  }, [scrapedData, hasUnsavedChanges, location.pathname]);

  // Set up beforeunload handler to save when user closes tab/window
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (scrapedData && hasUnsavedChanges) {
        saveToCacheSilently();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [scrapedData, hasUnsavedChanges]);

  // Track changes to mark when we have unsaved data
  useEffect(() => {
    // This is a simple check - you might want to make it more sophisticated
    if (scrapedData) {
      setHasUnsavedChanges(true);
    }
  }, [productAttributes, productFeatures, acceptedTitle, acceptedDescription, scrapedData]);

  // Load saved attributes from localStorage cache
  const loadSavedAttributes = () => {
    try {
      const savedAttributes = localStorage.getItem('savedProductAttributes');
      const savedTitle = localStorage.getItem('savedProductTitle');
      const savedDescription = localStorage.getItem('savedProductDescription');
      const savedFeatures = localStorage.getItem('savedProductFeatures');
      const savedLastSavedTime = localStorage.getItem('lastSavedTime');

      if (savedLastSavedTime) {
        setLastSavedTime(new Date(savedLastSavedTime));
      }

      if (savedAttributes) {
        const parsedAttributes = JSON.parse(savedAttributes);
        if (Array.isArray(parsedAttributes) && parsedAttributes.length > 0) {
          // Update attribute values from saved cache
          const updatedAttributeValues = {};
          parsedAttributes.forEach(attr => {
            if (attr.id !== undefined) {
              updatedAttributeValues[attr.id] = attr.value;
            }
          });
          setAttributeValues(prev => ({ ...prev, ...updatedAttributeValues }));

          // Mark predefined attributes as used if they exist in saved attributes
          const savedAttrKeys = parsedAttributes.map(attr => attr.key?.toLowerCase());
          setPredefinedAttributes(prev => prev.map(attr => ({
            ...attr,
            used: savedAttrKeys.includes(attr.key.toLowerCase()) || savedAttrKeys.includes(attr.label?.toLowerCase())
          })));
        }
      }

      if (savedTitle) {
        setAcceptedTitle(savedTitle);
        setProductTitle(savedTitle);
      }

      if (savedDescription) {
        setAcceptedDescription(savedDescription);
        setProductDescription(savedDescription);
      }

      if (savedFeatures) {
        const parsedFeatures = JSON.parse(savedFeatures);
        if (Array.isArray(parsedFeatures) && parsedFeatures.length > 0) {
          setProductFeatures(parsedFeatures);
        }
      }
    } catch (error) {
      console.error('Error loading saved attributes from cache:', error);
    }
  };

  // Save current state to localStorage cache (silent version - no alerts)
  const saveToCacheSilently = () => {
    if (!scrapedData) return;

    try {
      // Prepare attributes for saving
      const attributesToSave = productAttributes.map(attr => ({
        id: attr.id,
        key: attr.key,
        value: attributeValues[attr.id] || attr.scrapedValue || '',
        accepted: attr.accepted,
        section: attr.section || 'Custom Attributes',
        isCustom: attr.isExtra || false
      }));

      // Save to localStorage
      localStorage.setItem('savedProductAttributes', JSON.stringify(attributesToSave));
      localStorage.setItem('savedProductTitle', acceptedTitle);
      localStorage.setItem('savedProductDescription', acceptedDescription);
      localStorage.setItem('savedProductFeatures', JSON.stringify(productFeatures));

      const now = new Date();
      localStorage.setItem('lastSavedTime', now.toISOString());
      setLastSavedTime(now);
      
      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
      
      console.log('✅ Product data auto-saved to cache');
    } catch (error) {
      console.error('Error auto-saving to cache:', error);
    }
  };

  // Fetch ASINs and check action type when component mounts
  useEffect(() => {
    fetchAsinList();
    checkActionType();
  }, []);

  // Auto-load listing when coming from "Edit Existing Listing" flow.
  // We intentionally reuse the existing silent loader to avoid changing scraping behavior.
  const hasAutoLoadedRef = useRef(false);
  useEffect(() => {
    if (hasAutoLoadedRef.current) return;

    const actionType = localStorage.getItem('actionType');
    const comparisonPageAsin = localStorage.getItem('comparisonPageSelectedAsin');

    const isEditExistingFlow = actionType === 'edit' && !!comparisonPageAsin;
    if (!isEditExistingFlow) return;
    if (!productUrl || isLoadingUrl || scrapedData) return;

    hasAutoLoadedRef.current = true;
    // Small delay so state (selectedAsin/productUrl) from fetchAsinList settles.
    setTimeout(() => {
      handleLoadUrlSilently();
    }, 0);
  }, [productUrl, isLoadingUrl, scrapedData]);

  // Check action type from localStorage
  const checkActionType = () => {
    const actionType = localStorage.getItem('actionType');
    if (actionType === 'edit') {
      // For edit action, freeze ASIN selection
      setIsAsinSelectionFrozen(true);
    } else if (actionType === 'new') {
      // For new action, keep ASIN selection disabled
      setIsAsinSelectionFrozen(false);
    }
  };

  // Function to fetch ASINs from localStorage - ONLY SELECTED ONES
 // Replace the existing fetchAsinList function with this:
const fetchAsinList = async () => {
  try {
    setIsLoadingAsins(true);
    
    // ALWAYS PRIORITIZE: Get the ASIN specifically selected from ComparisonSetupPage
    const comparisonPageAsin = localStorage.getItem('comparisonPageSelectedAsin');
    
    if (comparisonPageAsin) {
      console.log(`✅ Using ASIN from Comparison Setup page: ${comparisonPageAsin}`);
      
      // Set the selected ASIN
      setSelectedAsin(comparisonPageAsin);
      
      // Construct Amazon URL
      const amazonUrl = `https://www.amazon.in/dp/${comparisonPageAsin}`;
      setProductUrl(amazonUrl);
      
      // Set ASIN list to only contain this ASIN
      setAsinList([comparisonPageAsin]);
      
      // Auto-load the product immediately
      if (!scrapedData && amazonUrl && amazonUrl.includes('amazon.in/dp/')) {
        console.log(`🔄 Auto-loading product for ASIN: ${comparisonPageAsin}`);
        handleLoadUrlSilently();
      }
      
      return;
    }
    
    // If no specific ASIN from ComparisonSetupPage, then check for selected ASINs
    const storedSelectedAsins = localStorage.getItem('selectedAsins');
    
    if (storedSelectedAsins) {
      try {
        const parsedAsins = JSON.parse(storedSelectedAsins);
        if (Array.isArray(parsedAsins) && parsedAsins.length > 0) {
          // Clean and deduplicate ASINs
          const cleanAsins = parsedAsins
            .filter(asin => asin && asin.trim() !== '')
            .map(asin => asin.trim());
          
          const uniqueAsins = [...new Set(cleanAsins)];
          setAsinList(uniqueAsins);
          
          console.log(`📋 Loaded ${uniqueAsins.length} selected ASINs from localStorage:`, uniqueAsins);
          
          // For edit action, auto-select first ASIN
          const actionType = localStorage.getItem('actionType');
          if (uniqueAsins.length > 0 && actionType === 'edit' && !selectedAsin) {
            setSelectedAsin(uniqueAsins[0]);
            const amazonUrl = `https://www.amazon.in/dp/${uniqueAsins[0]}`;
            setProductUrl(amazonUrl);
            
            setTimeout(() => {
              if (!scrapedData && amazonUrl.includes('amazon.in/dp/')) {
                handleLoadUrlSilently();
              }
            }, 500);
          }
        }
      } catch (parseError) {
        console.error('Error parsing stored ASINs:', parseError);
      }
    } else {
      console.log('📭 No ASINs found in localStorage');
      setAsinList([]);
    }
    
  } catch (error) {
    console.error('Error loading ASINs:', error);
    setAsinList([]);
  } finally {
    setIsLoadingAsins(false);
  }
};
  // Function to handle ASIN selection - ONLY ALLOWED IF NOT FROZEN
  const handleAsinSelect = (asin) => {
    if (isAsinSelectionFrozen) {
      // If selection is frozen, show message
      alert('ASIN selection is locked because you selected "Edit Existing Listing" in previous step.');
      return;
    }
    
    setSelectedAsin(asin);
    setAsinDropdownOpen(false);

    // If ASIN is selected, construct the Amazon URL
    if (asin) {
      const amazonUrl = `https://www.amazon.in/dp/${asin}`;
      setProductUrl(amazonUrl);
      console.log(`Selected ASIN: ${asin}, URL: ${amazonUrl}`);
    }
  };

  // Function to handle URL input change - ONLY ALLOWED IF NOT FROZEN
  const handleUrlChange = (url) => {
    if (isAsinSelectionFrozen && selectedAsin) {
      // If selection is frozen and ASIN is selected, prevent URL change
      alert('URL cannot be changed because ASIN selection is locked for editing existing listing.');
      return;
    }
    
    setProductUrl(url);

    // If URL doesn't match the selected ASIN, clear the ASIN selection
    if (selectedAsin && !url.includes(selectedAsin)) {
      setSelectedAsin('');
    }
  };

  // Check if all attributes are accepted
  const allAttributesAccepted = productAttributes.every(attr => attr.accepted) &&
    productFeatures.every(feature => feature.accepted);

  // Silent version of handleLoadUrl for auto-loading (doesn't show alerts)
  const handleLoadUrlSilently = async () => {
    const trimmedUrl = productUrl.trim();
    
    if (!trimmedUrl) {
      console.log('URL is empty - skipping auto-load');
      return;
    }
    
    if (!trimmedUrl.includes('amazon.in') && !trimmedUrl.includes('amazon.com')) {
      console.log('Not a valid Amazon URL - skipping auto-load');
      return;
    }
    
    if (!trimmedUrl.includes('/dp/') && !trimmedUrl.includes('/product/')) {
      console.log('URL missing product identifier - skipping auto-load');
      return;
    }

    setIsLoadingUrl(true);
    try {
      const data = await scrapeProductFromUrl(trimmedUrl);
      console.log('🔍 Auto-loaded Scraped Product Data:', data);
      console.log('🏠 Category:', data.category);
      console.log('📋 Technical Details:', data.technicalDetails);
      console.log('📦 Whats In Box:', data.whatsInBox);
      console.log('⚠️ Safety Info:', data.safetyInfo);
      console.log('📊 Product Details Array:', data.productDetailsArray);
      console.log('📊 Manufacturing Details Array:', data.manufacturingDetailsArray);
      console.log('📊 Additional Info Array:', data.additionalInfoArray);
      console.log('📊 Product Details List Array:', data.productDetailsListArray);
      setScrapedData(data);
      
      // Initialize features from scraped data
      const features = data.features || [];
      setProductFeatures(features.map((feature, index) => ({
        id: index,
        text: feature,
        accepted: false
      })));
      // CRITICAL: Clear all feature editing states when loading new product
      setEditingFeatures({});
      setFeatureValues({});
      
      // Set title and description from scraped data
      setProductTitle(data.title || '');
      setAcceptedTitle(data.title || '');
      setOriginalTitle(data.title || '');

      const description = data.description ||
        (data.features && data.features.length > 0 ? data.features.join(' • ') : '') ||
        '';
      setProductDescription(description);
      setAcceptedDescription(description);
      setOriginalDescription(description);

      // Initialize attribute values for editing
      const alignedAttrs = getAlignedAttributesFromData(data);
      console.log('🔗 Aligned Attributes (including H&K):', alignedAttrs);
      const initialValues = {};
      const initialAccepted = {};
      alignedAttrs.forEach(attr => {
        initialValues[attr.id] = attr.scrapedValue;
        initialAccepted[attr.id] = false;
      });
      setAttributeValues(initialValues);
      setProductAttributes(alignedAttrs.map(attr => ({
        ...attr,
        accepted: false
      })));
      // CRITICAL: Clear all attribute editing states when loading new product
      setEditingAttributes({});

      // Mark unsaved changes
      setHasUnsavedChanges(true);

      console.log('Product data auto-loaded successfully!');
    } catch (error) {
      console.error('Error auto-loading product:', error);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Handler for loading URL (manual user action - shows alerts on error)
  const handleLoadUrl = async () => {
    const trimmedUrl = productUrl.trim();
    
    if (!trimmedUrl) {
      alert('Please enter a valid product URL');
      return;
    }
    
    if (!trimmedUrl.includes('amazon.in') && !trimmedUrl.includes('amazon.com')) {
      alert('Please enter a valid Amazon product URL');
      return;
    }
    
    if (!trimmedUrl.includes('/dp/') && !trimmedUrl.includes('/product/')) {
      alert('Please enter a valid Amazon product URL with product ID (should contain /dp/ or /product/)');
      return;
    }

    setIsLoadingUrl(true);
    try {
      const data = await scrapeProductFromUrl(trimmedUrl);
      console.log('🔍 Scraped Product Data:', data);
      console.log('🏠 Category:', data.category);
      console.log('📋 Technical Details:', data.technicalDetails);
      console.log('📦 Whats In Box:', data.whatsInBox);
      console.log('⚠️ Safety Info:', data.safetyInfo);
      console.log('📊 Product Details Array:', data.productDetailsArray);
      console.log('📊 Manufacturing Details Array:', data.manufacturingDetailsArray);
      console.log('📊 Additional Info Array:', data.additionalInfoArray);
      setScrapedData(data);
      
      // Initialize features from scraped data
      const features = data.features || [];
      setProductFeatures(features.map((feature, index) => ({
        id: index,
        text: feature,
        accepted: false
      })));
      // CRITICAL: Clear all feature editing states when loading new product
      setEditingFeatures({});
      setFeatureValues({});
      
      // Set title and description from scraped data
      setProductTitle(data.title || '');
      setAcceptedTitle(data.title || '');
      setOriginalTitle(data.title || '');

      const description = data.description ||
        (data.features && data.features.length > 0 ? data.features.join(' • ') : '') ||
        '';
      setProductDescription(description);
      setAcceptedDescription(description);
      setOriginalDescription(description);

      // Initialize attribute values for editing
      const alignedAttrs = getAlignedAttributesFromData(data);
      const initialValues = {};
      const initialAccepted = {};
      alignedAttrs.forEach(attr => {
        initialValues[attr.id] = attr.scrapedValue;
        initialAccepted[attr.id] = false;
      });
      setAttributeValues(initialValues);
      setProductAttributes(alignedAttrs.map(attr => ({
        ...attr,
        accepted: false
      })));
      // CRITICAL: Clear all attribute editing states when loading new product
      setEditingAttributes({});

      // Mark unsaved changes
      setHasUnsavedChanges(true);

      alert('Product data scraped successfully! Check console for details.');
    } catch (error) {
      console.error('Error scraping URL:', error);
      alert(`Failed to scrape product: ${error.message}`);
    } finally {
      setIsLoadingUrl(false);
    }
  };

  // Helper to get aligned attributes from scraped data
  const getAlignedAttributesFromData = (data) => {
    if (!goldenProduct) return [];

    const goldenAttrs = [];
    const scrapedAttrs = [];
    // Get golden product attributes
    if (goldenProduct.details) {
      Object.entries(goldenProduct.details).forEach(([key, value]) => {
        goldenAttrs.push({
          key: key.replace(/([A-Z])/g, ' $1').trim(),
          value: value,
          section: 'Product Details'
        });
      });
    } else {
      // =============================================
      // PRODUCT OVERVIEW (comes AFTER images, BEFORE Product Information)
      // =============================================
      if (goldenProduct.productOverviewArray && Array.isArray(goldenProduct.productOverviewArray)) {
        console.log('📋 Processing Golden productOverviewArray:', goldenProduct.productOverviewArray.length, 'items');
        goldenProduct.productOverviewArray.forEach(item => {
          goldenAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Product Overview'
          });
        });
      }

      // =============================================
      // PRODUCT INFORMATION (with subsections)
      // =============================================
      if (goldenProduct.productInformationArrays && typeof goldenProduct.productInformationArrays === 'object') {
        console.log('📋 Processing Golden productInformationArrays:', Object.keys(goldenProduct.productInformationArrays).length, 'subsections');
        Object.keys(goldenProduct.productInformationArrays).forEach(subsectionName => {
          const subsectionData = goldenProduct.productInformationArrays[subsectionName];
          if (Array.isArray(subsectionData)) {
            console.log(`  - Subsection: ${subsectionName}, ${subsectionData.length} items`);
            subsectionData.forEach(item => {
              goldenAttrs.push({
                key: item.label || item.key || 'Attribute',
                value: item.value || 'N/A',
                section: subsectionName // Use the subsection name as the section
              });
            });
          }
        });
      }

      // For Home & Kitchen: Technical Details (if present)
      if (goldenProduct.technicalDetails && typeof goldenProduct.technicalDetails === 'object') {
        const techDetailsCount = Object.keys(goldenProduct.technicalDetails).filter(k => k !== 'status').length;
        console.log('🌟 Processing Golden Technical Details:', techDetailsCount, 'items');
        console.log('🌟 Golden Technical Details keys:', Object.keys(goldenProduct.technicalDetails));
        Object.entries(goldenProduct.technicalDetails).forEach(([key, value]) => {
          if (key !== 'status') { // Skip status field
            console.log(`  - Adding Golden Tech Detail: ${key} = ${value?.substring(0, 50)}`);
            goldenAttrs.push({
              key: key,
              value: value || 'N/A',
              section: 'Technical Details'
            });
          }
        });
        console.log(`✅ Added ${techDetailsCount} Golden Technical Details`);
      }
      
      // LEGACY: Product Details Array - include if no Product Overview (for Clothing and other categories)
      if (goldenProduct.productDetailsArray && Array.isArray(goldenProduct.productDetailsArray)) {
        const hasProductOverview = goldenProduct.productOverviewArray && goldenProduct.productOverviewArray.length > 0;
        if (!hasProductOverview) {
          console.log('📋 Processing Golden productDetailsArray (fallback):', goldenProduct.productDetailsArray.length, 'items');
          goldenProduct.productDetailsArray.forEach(item => {
            goldenAttrs.push({
              key: item.label || item.key || 'Attribute',
              value: item.value || 'N/A',
              section: 'Product Information'
            });
          });
        }
      }
      
      // LEGACY: Manufacturing Details Array - include if no new structure (for Clothing and other categories)
      if (goldenProduct.manufacturingDetailsArray && Array.isArray(goldenProduct.manufacturingDetailsArray)) {
        console.log('📋 Processing Golden manufacturingDetailsArray:', goldenProduct.manufacturingDetailsArray.length, 'items');
        goldenProduct.manufacturingDetailsArray.forEach(item => {
          goldenAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Product Information'
          });
        });
      }

      if (goldenProduct.additionalInfoArray && Array.isArray(goldenProduct.additionalInfoArray)) {
        console.log('📋 Processing Golden additionalInfoArray:', goldenProduct.additionalInfoArray.length, 'items');
        goldenProduct.additionalInfoArray.forEach(item => {
          goldenAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Additional Information'
          });
        });
      }

      // For Home & Kitchen: What's in the Box (if present)
      if (goldenProduct.whatsInBox && goldenProduct.whatsInBox !== 'Not specified') {
        goldenAttrs.push({
          key: "What's in the Box",
          value: goldenProduct.whatsInBox,
          section: 'Package Contents'
        });
      }

      // NEW: More Product Details (from detailBulletsWithExceptions)
      if (goldenProduct.moreProductDetailsArray && Array.isArray(goldenProduct.moreProductDetailsArray)) {
        console.log('📋 Processing Golden moreProductDetailsArray:', goldenProduct.moreProductDetailsArray.length, 'items');
        goldenProduct.moreProductDetailsArray.forEach(item => {
          goldenAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'More Product Details'
          });
        });
      }

      // Log summary of golden product extraction
      console.log('\n🌟 GOLDEN PRODUCT EXTRACTION SUMMARY:');
      const goldenSectionCounts = {};
      goldenAttrs.forEach(attr => {
        goldenSectionCounts[attr.section] = (goldenSectionCounts[attr.section] || 0) + 1;
      });
      Object.entries(goldenSectionCounts).forEach(([section, count]) => {
        console.log(`  ${section}: ${count} attributes`);
      });
      console.log(`  TOTAL GOLDEN: ${goldenAttrs.length} attributes\n`);
    }

    // Get scraped product attributes
    if (data) {
      // =============================================
      // PRODUCT OVERVIEW (comes AFTER images, BEFORE Product Information)
      // =============================================
      if (data.productOverviewArray && Array.isArray(data.productOverviewArray)) {
        console.log('📋 Processing productOverviewArray:', data.productOverviewArray.length, 'items');
        data.productOverviewArray.forEach(item => {
          scrapedAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Product Overview'
          });
        });
        console.log(`✅ Added ${data.productOverviewArray.length} Product Overview items to scrapedAttrs`);
      }

      // =============================================
      // PRODUCT INFORMATION (with subsections)
      // =============================================
      if (data.productInformationArrays && typeof data.productInformationArrays === 'object') {
        console.log('📋 Processing productInformationArrays:', Object.keys(data.productInformationArrays).length, 'subsections');
        Object.keys(data.productInformationArrays).forEach(subsectionName => {
          const subsectionData = data.productInformationArrays[subsectionName];
          if (Array.isArray(subsectionData)) {
            console.log(`  - Subsection: ${subsectionName}, ${subsectionData.length} items`);
            subsectionData.forEach(item => {
              scrapedAttrs.push({
                key: item.label || item.key || 'Attribute',
                value: item.value || 'N/A',
                section: subsectionName // Use the subsection name as the section
              });
            });
          }
        });
        console.log(`✅ Added Product Information subsections to scrapedAttrs`);
      }

      // For Home & Kitchen: Technical Details (if present)
      if (data.technicalDetails && typeof data.technicalDetails === 'object') {
        const techDetailsCount = Object.keys(data.technicalDetails).filter(k => k !== 'status').length;
        console.log('🔧 Processing Technical Details:', techDetailsCount, 'items');
        console.log('🔧 Technical Details keys:', Object.keys(data.technicalDetails));
        Object.entries(data.technicalDetails).forEach(([key, value]) => {
          if (key !== 'status') { // Skip status field
            console.log(`  - Adding Tech Detail: ${key} = ${value?.substring(0, 50)}`);
            scrapedAttrs.push({
              key: key,
              value: value || 'N/A',
              section: 'Technical Details'
            });
          }
        });
        console.log(`✅ Added ${techDetailsCount} Technical Details to scrapedAttrs`);
      }
      
      // LEGACY: Product Details Array - include if no Product Overview (for Clothing and other categories)
      if (data.productDetailsArray && Array.isArray(data.productDetailsArray)) {
        const hasProductOverview = data.productOverviewArray && data.productOverviewArray.length > 0;
        if (!hasProductOverview) {
          console.log('📋 Processing productDetailsArray (fallback):', data.productDetailsArray.length, 'items');
          data.productDetailsArray.forEach(item => {
            scrapedAttrs.push({
              key: item.label || item.key || 'Attribute',
              value: item.value || 'N/A',
              section: 'Product Information'
            });
          });
        }
      }
      
      // LEGACY: Manufacturing Details Array - include if no new structure (for Clothing and other categories)
      if (data.manufacturingDetailsArray && Array.isArray(data.manufacturingDetailsArray)) {
        console.log('📋 Processing manufacturingDetailsArray:', data.manufacturingDetailsArray.length, 'items');
        data.manufacturingDetailsArray.forEach(item => {
          scrapedAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Product Information'
          });
        });
      }

      if (data.additionalInfoArray && Array.isArray(data.additionalInfoArray)) {
        console.log('📋 Processing additionalInfoArray:', data.additionalInfoArray.length, 'items');
        console.log('📋 Additional Info keys:', data.additionalInfoArray.map(i => i.label));
        data.additionalInfoArray.forEach(item => {
          console.log('  - Additional Info:', item.label, '=', item.value?.substring(0, 60));
          scrapedAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Additional Information'
          });
        });
        console.log(`✅ Added ${data.additionalInfoArray.length} Additional Info items to scrapedAttrs`);
      } else {
        console.log('❌ No additionalInfoArray found in data');
      }

      // REMOVED: productDetailsListArray - contains repetitive data
      
      // For Home & Kitchen: What's in the Box (if present)
      if (data.whatsInBox && data.whatsInBox !== 'Not specified') {
        scrapedAttrs.push({
          key: "What's in the Box",
          value: data.whatsInBox,
          section: 'Package Contents'
        });
      }
      
      // NEW: More Product Details (from detailBulletsWithExceptions)
      if (data.moreProductDetailsArray && Array.isArray(data.moreProductDetailsArray)) {
        console.log('📋 Processing moreProductDetailsArray:', data.moreProductDetailsArray.length, 'items');
        data.moreProductDetailsArray.forEach(item => {
          console.log('  - More Product Details:', item.label, '=', item.value?.substring(0, 60));
          scrapedAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'More Product Details'
          });
        });
        console.log(`✅ Added ${data.moreProductDetailsArray.length} More Product Details items to scrapedAttrs`);
      } else {
        console.log('❌ No moreProductDetailsArray found in data');
      }
      
      // For Home & Kitchen: Safety Information (if present)
      if (data.safetyInfo && data.safetyInfo !== 'Not specified') {
        scrapedAttrs.push({
          key: "Safety Information",
          value: data.safetyInfo,
          section: 'Safety Information'
        });
      }
    }

    // Log summary of what was extracted
    console.log('\n📊 EXTRACTION SUMMARY:');
    const sectionCounts = {};
    scrapedAttrs.forEach(attr => {
      sectionCounts[attr.section] = (sectionCounts[attr.section] || 0) + 1;
    });
    Object.entries(sectionCounts).forEach(([section, count]) => {
      console.log(`  ${section}: ${count} attributes`);
    });
    console.log(`  TOTAL: ${scrapedAttrs.length} attributes\n`);

    // Create aligned list
    const aligned = [];
    const scrapedMap = new Map();
    const goldenMap = new Map();

    // Separate Product Overview, Product Information subsections, Technical Details, Additional Information, Package Contents, More Product Details, and Safety Information to keep as distinct sections
    // Note: Product Information subsections are dynamic (e.g., "Technical Details", "Additional Information", etc.)
    // REMOVED: Product Details (repetitive data)
    // REMOVED: Manufacturing Details (no specific section on Amazon UI)
    const categorySpecificSections = [
      'Product Overview',
      'Technical Details', 
      'Additional Information', 
      'Package Contents',
      'More Product Details',
      'Safety Information'
    ];
    
    // Also include any dynamic Product Information subsections found in the data
    const dynamicSubsections = new Set();
    [...goldenAttrs, ...scrapedAttrs].forEach(attr => {
      if (attr.section && !categorySpecificSections.includes(attr.section)) {
        // This might be a Product Information subsection
        dynamicSubsections.add(attr.section);
      }
    });
    
    // Add dynamic subsections to categorySpecificSections
    dynamicSubsections.forEach(section => {
      if (!categorySpecificSections.includes(section)) {
        categorySpecificSections.push(section);
        console.log(`📌 Added dynamic subsection to categorySpecific: ${section}`);
      }
    });
    
    const categorySpecificAttrsScraped = [];
    const categorySpecificAttrsGolden = [];
    
    // Separate scraped attributes by category-specific vs regular
    scrapedAttrs.forEach(attr => {
      // Keep category-specific sections separate - don't add to map for matching
      if (categorySpecificSections.includes(attr.section)) {
        categorySpecificAttrsScraped.push(attr);
      } else {
        scrapedMap.set(attr.key.toLowerCase(), attr);
      }
    });

    // Separate golden attributes by category-specific vs regular
    goldenAttrs.forEach(attr => {
      if (categorySpecificSections.includes(attr.section)) {
        categorySpecificAttrsGolden.push(attr);
      } else {
        goldenMap.set(attr.key.toLowerCase(), attr);
      }
    });

    console.log('📊 Total Golden Attrs:', goldenAttrs.length);
    console.log('📊 Total Scraped Attrs:', scrapedAttrs.length);
    console.log('📊 Category-Specific Golden Attrs:', categorySpecificAttrsGolden.length);
    console.log('📊 Category-Specific Scraped Attrs:', categorySpecificAttrsScraped.length);
    console.log('📊 Scraped Map Keys for matching:', Array.from(scrapedMap.keys()));

    // Match golden attributes with scraped attributes (excluding category-specific sections)
    goldenMap.forEach((goldenAttr, key) => {
      const scrapedAttr = scrapedMap.get(key);
      aligned.push({
        id: aligned.length,
        key: goldenAttr.key,
        goldenValue: goldenAttr.value,
        scrapedValue: scrapedAttr ? scrapedAttr.value : '',
        section: goldenAttr.section,
        isMatched: !!scrapedAttr
      });

      if (scrapedAttr) {
        scrapedMap.delete(key);
      }
    });

    // Add remaining unmatched scraped attributes (non-category-specific)
    scrapedMap.forEach((attr) => {
      console.log(`➕ Adding EXTRA scraped attr: ${attr.key} = ${attr.value} (section: ${attr.section})`);
      aligned.push({
        id: aligned.length,
        key: attr.key,
        goldenValue: '',
        scrapedValue: attr.value,
        section: attr.section,
        isMatched: false,
        isExtra: true
      });
    });
    
    // Match category-specific attributes (Technical Details, Additional Info, Product Details, etc.)
    // Create a map for quick lookup
    const categoryScrapedMap = new Map();
    categorySpecificAttrsScraped.forEach(attr => {
      const key = `${attr.section}:${attr.key}`.toLowerCase();
      categoryScrapedMap.set(key, attr);
    });

    categorySpecificAttrsGolden.forEach(goldenAttr => {
      const key = `${goldenAttr.section}:${goldenAttr.key}`.toLowerCase();
      const scrapedAttr = categoryScrapedMap.get(key);
      
      console.log(`🔗 Matching Category-Specific: ${goldenAttr.key} (${goldenAttr.section}) - ${scrapedAttr ? 'FOUND' : 'NOT FOUND'}`);
      
      aligned.push({
        id: aligned.length,
        key: goldenAttr.key,
        goldenValue: goldenAttr.value,
        scrapedValue: scrapedAttr ? scrapedAttr.value : '',
        section: goldenAttr.section,
        isMatched: !!scrapedAttr,
        isCategorySpecific: true
      });

      if (scrapedAttr) {
        categoryScrapedMap.delete(key);
      }
    });

    // Add remaining unmatched category-specific scraped attributes
    categoryScrapedMap.forEach((attr) => {
      console.log(`➕ Adding EXTRA category-specific scraped attr: ${attr.key} = ${attr.value} (section: ${attr.section})`);
      aligned.push({
        id: aligned.length,
        key: attr.key,
        goldenValue: '',
        scrapedValue: attr.value,
        section: attr.section,
        isMatched: false,
        isExtra: true,
        isCategorySpecific: true
      });
    });

    console.log('📊 Final Aligned Attrs Count (before sorting):', aligned.length);
    
    // Sort aligned attributes to ensure proper section order
    // Priority: Product Overview > Product Information subsections > Technical Details > Additional Information > Package Contents > More Product Details > Safety Information
    const sectionOrder = [
      'Product Overview',
      'Technical Details',
      'Additional Information',
      'Package Contents',
      'More Product Details',
      'Safety Information'
    ];
    
    aligned.sort((a, b) => {
      // If both have isCategorySpecific, sort by section order
      if (a.isCategorySpecific && b.isCategorySpecific) {
        const aIndex = sectionOrder.indexOf(a.section);
        const bIndex = sectionOrder.indexOf(b.section);
        
        // If section found in order list, use that order
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        // If one is in order list and other isn't, prioritize the one in list
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        // If neither in order list (Product Information subsections), sort alphabetically
        return a.section.localeCompare(b.section);
      }
      
      // Category-specific sections come before regular attributes
      if (a.isCategorySpecific && !b.isCategorySpecific) return -1;
      if (!a.isCategorySpecific && b.isCategorySpecific) return 1;
      
      // Regular attributes maintain their order
      return 0;
    });
    
    // Re-assign IDs after sorting
    aligned.forEach((attr, index) => {
      attr.id = index;
    });
    
    console.log('📊 Final Aligned Attrs Count (after sorting):', aligned.length);
    console.log('📊 Section order:', aligned.map(a => a.section).filter((v, i, arr) => arr.indexOf(v) === i));
    
    return aligned;
  };

  // Helper function to get description from golden product
  const getGoldenDescription = () => {
    if (!goldenProduct) return '';
    return goldenProduct.description ||
      (goldenProduct.features && goldenProduct.features.length > 0 ? goldenProduct.features.join(' • ') : '') ||
      'No description available';
  };

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

  // SKU-ID Handlers (matching NewProductCreationPage format)
  const handleAcceptSkuId = () => {
    setAcceptedSkuId(productSkuId);
    setIsEditingSkuId(false);
    setHasUnsavedChanges(true);
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
        title: acceptedTitle || productTitle || '',
        subcategory: getSubcategoryFromProduct(),
        category: 'Clothing',
        page_type: 'gno', // Use GNO for Listing Comparison & Editing (not GNC)
        attributes: Object.fromEntries(
          productAttributes.map(attr => [attr.key, attributeValues[attr.id] || attr.scrapedValue || ''])
        )
      };

      // Call the SKU generation endpoint
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
        setHasUnsavedChanges(true);
        
        // Show explanation in console
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

  // Title Handlers
  const handleAcceptTitle = () => {
    setAcceptedTitle(productTitle);
    setIsEditingTitle(false);
    setHasUnsavedChanges(true);
  };

  const handleCancelTitle = () => {
    setProductTitle(acceptedTitle);
    setIsEditingTitle(false);
  };

  const handleAIGenerateTitle = async () => {
    setIsGeneratingTitle(true);
    try {
      const aiPayload = buildAIPayload(scrapedData, productAttributes, attributeValues, "title");
      console.log("Listro Generate Title - Payload:", aiPayload);

      const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-title-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPayload),
      });

      const json = await response.json();
      if (json.success) {
        setProductTitle(json.generated_title || "");
        setIsEditingTitle(true);
        setHasUnsavedChanges(true);
      } else {
        alert("Failed to generate title: " + json.error);
      }
    } catch (error) {
      console.error("Error generating title:", error);
      alert("Failed to generate title: " + error.message);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  // Description Handlers
  const handleAcceptDescription = () => {
    setAcceptedDescription(productDescription);
    setIsEditingDescription(false);
    setHasUnsavedChanges(true);
  };

  const handleCancelDescription = () => {
    setProductDescription(acceptedDescription);
    setIsEditingDescription(false);
  };

  const handleAIGenerateDescription = async () => {
    setIsGeneratingDescription(true);
    try {
      const aiPayload = buildAIPayload(scrapedData, productAttributes, attributeValues, "description");
      console.log("Listro Generate Description - Payload:", aiPayload);

      const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-title-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiPayload),
      });

      const json = await response.json();
      if (json.success) {
        setProductDescription(json.generated_description || "");
        setIsEditingDescription(true);
        setHasUnsavedChanges(true);
      } else {
        alert("Failed to generate description: " + json.error);
      }
    } catch (error) {
      console.error("Error generating description:", error);
      alert("Failed to generate description: " + error.message);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // Feature Handlers
  const handleEditFeature = (featureId) => {
    const currentFeature = productFeatures.find(f => f.id === featureId);
    // Initialize with current text if not already set in featureValues
    if (!featureValues.hasOwnProperty(featureId)) {
      setFeatureValues(prev => ({
        ...prev,
        [featureId]: currentFeature?.text || ''
      }));
    }
    setEditingFeatures(prev => ({ ...prev, [featureId]: true }));
  };

  const handleCancelEditFeature = (featureId, originalText) => {
    setFeatureValues(prev => ({
      ...prev,
      [featureId]: originalText
    }));
    setEditingFeatures(prev => ({ ...prev, [featureId]: false }));
  };

  const handleAcceptFeature = (featureId) => {
    const currentFeature = productFeatures.find(f => f.id === featureId);
    const currentValue = featureValues[featureId] || currentFeature?.text || '';

    setProductFeatures(prev =>
      prev.map(feature =>
        feature.id === featureId ? {
          ...feature,
          accepted: true,
          text: currentValue
        } : feature
      )
    );
    setEditingFeatures(prev => ({ ...prev, [featureId]: false }));
    setHasUnsavedChanges(true);
  };

  const handleFeatureChange = (featureId, value) => {
    setFeatureValues(prev => ({
      ...prev,
      [featureId]: value
    }));
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
      setFeatureValues(prev => ({ ...prev, [newId]: newFeature.trim() }));
      setNewFeature('');
      setShowAddFeature(false);
      setHasUnsavedChanges(true);
    }
  };

  const handleDeleteFeature = (featureId) => {
    setProductFeatures(prev => prev.filter(feature => feature.id !== featureId));
    setHasUnsavedChanges(true);
  };

  // Attribute Handlers
  const handleEditAttribute = (attrId) => {
    setEditingAttributes(prev => ({ ...prev, [attrId]: true }));
  };

  const handleCancelEditAttribute = (attrId, originalValue) => {
    setAttributeValues(prev => ({ ...prev, [attrId]: originalValue }));
    setEditingAttributes(prev => ({ ...prev, [attrId]: false }));
  };

  const handleAcceptAttribute = (attrId) => {
    const currentValue = attributeValues[attrId] ||
      productAttributes.find(attr => attr.id === attrId)?.scrapedValue ||
      '';
    
    // Update the attribute
    const updatedAttributes = productAttributes.map(attr =>
      attr.id === attrId ? {
        ...attr,
        accepted: true,
        scrapedValue: currentValue
      } : attr
    );
    
    setProductAttributes(updatedAttributes);
    setEditingAttributes(prev => ({ ...prev, [attrId]: false }));

    // Mark unsaved changes
    setHasUnsavedChanges(true);

    // Mark the attribute as used in predefined attributes if it matches
    const attribute = productAttributes.find(attr => attr.id === attrId);
    if (attribute && attribute.key) {
      const attrKey = attribute.key.toLowerCase();
      setPredefinedAttributes(prev => prev.map(attr => {
        if (attr.key.toLowerCase() === attrKey || attr.label.toLowerCase() === attrKey) {
          return { ...attr, used: true };
        }
        return attr;
      }));
    }
  };

  const handleAttributeChange = (attrId, value) => {
    setAttributeValues(prev => ({ ...prev, [attrId]: value }));
  };

  const handleAddAttribute = () => {
    const attributeKey = selectedAttributeType === 'custom'
      ? newAttributeKey.trim().toLowerCase().replace(/\s+/g, '')
      : selectedAttributeType;

    const attributeLabel = selectedAttributeType === 'custom'
      ? newAttributeKey.trim()
      : predefinedAttributes.find(a => a.key === selectedAttributeType)?.label || attributeKey;

    if (attributeKey && newAttributeValue.trim()) {
      const newId = productAttributes.length;
      const newAttr = {
        id: newId,
        key: attributeLabel,
        goldenValue: '',
        scrapedValue: newAttributeValue.trim(),
        accepted: false,
        isExtra: true, // Mark as custom attribute
        section: 'Custom Attributes' // Add section for organization
      };
      
      setProductAttributes([...productAttributes, newAttr]);
      setAttributeValues(prev => ({ ...prev, [newId]: newAttributeValue.trim() }));
      
      // Mark unsaved changes
      setHasUnsavedChanges(true);
      
      // Mark the attribute as used in predefined attributes if it's not custom
      if (selectedAttributeType !== 'custom') {
        setPredefinedAttributes(prev => prev.map(attr => {
          if (attr.key === selectedAttributeType) {
            return { ...attr, used: true };
          }
          return attr;
        }));
      }
      
      setNewAttributeKey('');
      setNewAttributeValue('');
      setSelectedAttributeType('');
      setShowAddAttribute(false);
    }
  };

  const handleProceed = () => {
    const allAccepted = productAttributes.every(attr => attr.accepted) &&
      productFeatures.every(feature => feature.accepted);

    if (allAccepted && scrapedData) {
      // Auto-save before proceeding
      saveToCacheSilently();

      // Construct product data using current attributeValues (latest user input)
      const productData = {
        title: acceptedTitle,
        description: acceptedDescription,
        attributes: productAttributes.map(attr => ({
          key: attr.key,
          value: attr.scrapedValue || attributeValues[attr.id] || '',
          accepted: attr.accepted,
          isCustom: attr.isExtra || false
        })),
        features: productFeatures.map(feature => feature.text)
      };
      console.log('Product Data:', productData);

      // Save the existing/scraped product to localStorage for image comparison page
      // Normalize images from scrapedData before building existingProduct
      const imageCandidates =
        Array.isArray(scrapedData.images) && scrapedData.images.length > 0
          ? scrapedData.images
          : Array.isArray(scrapedData.existingImages) && scrapedData.existingImages.length > 0
            ? scrapedData.existingImages
            : [];

      console.log('🖼️ [DEBUG] imageCandidates before filtering:', imageCandidates);
      console.log('🖼️ [DEBUG] imageCandidates length:', imageCandidates.length);

      // Keep only valid URLs - backend already deduplicates
      const normalizedImages = imageCandidates.filter(
        (img) => img && typeof img === 'string' && img.startsWith('http')
      );

      console.log('🖼️ [DEBUG] normalizedImages after filtering:', normalizedImages);
      console.log('🖼️ [DEBUG] normalizedImages length:', normalizedImages.length);

      // Save the existing/scraped product to localStorage for image comparison page
      const existingProduct = {
        id: scrapedData.asin || 'N/A',
        asin: scrapedData.asin || 'N/A',
        title: acceptedTitle,
        brand: scrapedData.brand,
        amazonUrl: productUrl,

        // ✅ All scraped images
        images: normalizedImages,
        // ✅ Alias so other pages can also read them
        existingImages: normalizedImages,
        // optional "main" image
        mainImage: normalizedImages[0] || null,

        // Features/Bullets
        features: productFeatures.map((feature) => feature.text),

        // Description
        description: acceptedDescription,

        // Detailed sections
        productDetails: scrapedData.productDetails,
        productDetailsArray: scrapedData.productDetailsArray || [],
        manufacturingDetails: scrapedData.manufacturingDetails,
        manufacturingDetailsArray: scrapedData.manufacturingDetailsArray || [],
        additionalInfo: scrapedData.additionalInfo,
        additionalInfoArray: scrapedData.additionalInfoArray || [],
        
        // Home & Kitchen specific fields
        category: scrapedData.category,
        technicalDetails: scrapedData.technicalDetails,
        whatsInBox: scrapedData.whatsInBox,
        safetyInfo: scrapedData.safetyInfo,

        // Store the full accepted attributes including custom ones
        acceptedAttributes: productAttributes.map((attr) => ({
          key: attr.key,
          value: attr.scrapedValue || attributeValues[attr.id] || '',
          accepted: attr.accepted,
          isCustom: attr.isExtra || false,
          section: attr.section || 'Custom Attributes',
        })),

        // Store the full scraped data
        scrapedData,
      };

      console.log('💾 [DEBUG] About to store existingProduct with images:', {
        asin: existingProduct.asin,
        images: existingProduct.images,
        imagesLength: existingProduct.images?.length || 0,
        fullObject: existingProduct
      });
      
      // ⚠️ CRITICAL FIX: Only clear existingProduct, NOT goldStandardProduct
      // We need goldStandardProduct to display in ImageComparisonPage Gold column
      localStorage.removeItem('existingProduct');
      localStorage.removeItem('generatedImages'); // Clear old AI images
      localStorage.removeItem('selectedImages'); // Clear old selections
      console.log('🗑️ Cleared old existingProduct data from localStorage (keeping goldStandardProduct)');
      
      // Add timestamp to force React to recognize this as new data
      existingProduct.loadedAt = new Date().toISOString();
      existingProduct.version = Date.now(); // Cache-busting version
      
      localStorage.setItem('existingProduct', JSON.stringify(existingProduct));
      console.log('✅ Stored NEW existing product in localStorage with version:', existingProduct.version);

      // Pass state to indicate NOT coming from new product page
      navigate('/compare-images', { state: { isNewProduct: false } });
    } else {
      alert("Please accept all attributes and features before proceeding.");
    }
  };

  function buildAIPayload(scrapedData, productAttributes, attributeValues, aiType) {
    const payload = { ...scrapedData };

    productAttributes.forEach((attr) => {
      const val = attributeValues[attr.id];
      if (val && val.trim() !== "") {
        payload[attr.key] = val;
      }
    });

    if (!payload.subcategory && payload["Generic Name"]) {
      payload.subcategory = payload["Generic Name"];
    }

    payload.type = aiType;

    return payload;
  }

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="h-4 w-4 text-gray-300" />);
      }
    }
    return stars;
  };

  // Show loading state while fetching golden product
  if (!goldenProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            Loading golden product data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Page Header - Removed Save Button */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing Comparison & Editing</h1>
          <p className="text-sm text-gray-600">
            Compare your listing against the Gold Standard and enhance it with Listro-powered suggestions
          </p>
        </div>

        {/* Last Saved Time Indicator */}
        {lastSavedTime && (
          <div className="mb-4 text-center">
            <p className="text-xs text-gray-500">
      
            </p>
          </div>
        )}

        {/* Unsaved Changes Indicator */}
        {hasUnsavedChanges && (
          <div className="mb-4 text-center">
            <p className="text-xs text-yellow-600">
          
            </p>
          </div>
        )}

        {/* Main Content Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">

          {/* Product URL Input Section - Only show if no data loaded */}
          {!scrapedData && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Load Listing</h3>
              <div className="max-w-2xl">
                {/* ASIN Dropdown Section */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Listing
                  </label>
                  
                  <div className="relative">
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between border rounded-md px-3 py-2 text-sm ${
                        isAsinSelectionFrozen
                          ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-white border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      onClick={() => !isAsinSelectionFrozen && setAsinDropdownOpen(!asinDropdownOpen)}
                      disabled={isLoadingAsins || asinList.length === 0 || isAsinSelectionFrozen}
                    >
                      <span className={`${selectedAsin ? 'text-gray-900' : 'text-gray-500'}`}>
                        {isAsinSelectionFrozen && selectedAsin ? (
                          `🔒 Locked: ASIN ${selectedAsin} (Edit Existing Listing)`
                        ) : selectedAsin
                          ? `ASIN: ${selectedAsin}`
                          : isLoadingAsins
                            ? 'Loading your selected products...'
                            : asinList.length > 0
                              ? `Select from ${asinList.length} selected product(s)`
                              : 'No products selected in previous step'
                        }
                      </span>
                      {!isAsinSelectionFrozen && (
                        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${asinDropdownOpen ? 'transform rotate-180' : ''}`} />
                      )}
                      {isAsinSelectionFrozen && (
                        <span className="text-xs text-gray-500">🔒</span>
                      )}
                    </button>

                    {asinDropdownOpen && asinList.length > 0 && !isAsinSelectionFrozen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-b">
                            Select a product from your {asinList.length} selected listings
                          </div>
                          {asinList.map((asin, index) => (
                            <button
                              key={index}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-gray-100 last:border-b-0"
                              onClick={() => handleAsinSelect(asin)}
                            >
                              <div className="font-mono">{asin}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                Selected listing {index + 1} of {asinList.length}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {asinList.length > 0 && (
                    <div className="mt-2">
                      {isAsinSelectionFrozen ? (
                        <p className="text-xs text-blue-600">
                          ⚠ ASIN selection is locked because you selected "Edit Existing Listing" in previous step
                        </p>
                      ) : (
                        <p className="text-xs text-green-600">
                          ✓ Showing {asinList.length} product{asinList.length !== 1 ? 's' : ''} you selected in previous step
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* URL Input Section */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Listing URL 
                  </label>
                  {!isEditExistingFlow && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="https://www.amazon.in/dp/..."
                        className={`flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          isAsinSelectionFrozen && selectedAsin
                            ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                            : 'border-gray-300'
                        }`}
                        value={productUrl}
                        onChange={e => handleUrlChange(e.target.value)}
                        disabled={isLoadingUrl || (isAsinSelectionFrozen && selectedAsin)}
                        readOnly={isAsinSelectionFrozen && selectedAsin}
                      />
                      <button
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleLoadUrl}
                        disabled={isLoadingUrl || !productUrl.trim() || (isAsinSelectionFrozen && !selectedAsin)}
                      >
                        {isLoadingUrl ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Loading</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4" />
                            <span>Load URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    {selectedAsin && (
                      <span className={isAsinSelectionFrozen ? "text-blue-600" : "text-green-600"}>
                        {isAsinSelectionFrozen ? '🔒 ' : '✓ '}
                        {isAsinSelectionFrozen 
                          ? `ASIN locked for editing: ${selectedAsin}`
                          : `Using selected ASIN: ${selectedAsin}`
                        }
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Column Headers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 pb-4 border-b border-gray-200">
            {/* Left Column Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                <h2 className="text-xl font-semibold text-gray-900">Gold Standard</h2>
              </div>
              {goldenProduct.amazonUrl && (
                <a
                  href={goldenProduct.amazonUrl.startsWith('http') ? goldenProduct.amazonUrl : `https://${goldenProduct.amazonUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm pr-5"
                >
                  <span className=''>View on Amazon</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Right Column Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Your Listing</h2>
              {productUrl && (
                <a
                  href={productUrl.startsWith('http') ? productUrl : `https://${productUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm pr-5"
                >
                  <span>View on Amazon</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Product Attributes Section - MOVED TO TOP */}
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Golden Listing Attributes</h3>
              <h3 className="text-lg font-semibold text-gray-700">Selected Listing Attributes</h3>
            </div>

            {/* Top image previews (first image only) */}
            {scrapedData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  {(() => {
                    const goldenFirstImage = Array.isArray(goldenProduct?.images) ? goldenProduct.images[0] : null;
                    return goldenFirstImage ? (
                      <div className="w-full aspect-square rounded-md overflow-hidden bg-gray-50 border border-gray-200">
                        <img
                          src={goldenFirstImage}
                          alt="Golden listing"
                          className="w-full h-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <p className="text-gray-500 text-sm text-center">No golden image available</p>
                      </div>
                    );
                  })()}
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  {(() => {
                    const candidates =
                      Array.isArray(scrapedData?.images) && scrapedData.images.length > 0
                        ? scrapedData.images
                        : Array.isArray(scrapedData?.existingImages) && scrapedData.existingImages.length > 0
                          ? scrapedData.existingImages
                          : [];

                    const firstExistingImage = candidates.find(
                      (img) => img && typeof img === 'string' && img.startsWith('http')
                    );

                    return firstExistingImage ? (
                      <div className="w-full aspect-square rounded-md overflow-hidden bg-gray-50 border border-gray-200">
                        <img
                          src={firstExistingImage}
                          alt="Selected listing"
                          className="w-full h-full object-contain"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-square rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center">
                        <p className="text-gray-500 text-sm text-center">No scraped image available</p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {!scrapedData ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Golden Standard Placeholder */}
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-center justify-center">
                  <p className="text-gray-500 text-sm text-center">
                    Load a product URL to view attributes
                  </p>
                </div>

                {/* Right: Your Listing Placeholder */}
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-center justify-center">
                  <p className="text-gray-500 text-sm text-center">
                    Load a product URL to view attributes
                  </p>
                </div>
              </div>
            ) : (
              /* Aligned Attributes View */
              <div className="space-y-3">
                {productAttributes.map((attr, index) => {
                  // Check if this is the start of a new section (Technical Details, Package Contents, etc.)
                  const showSectionHeader = index === 0 || 
                    (attr.section !== productAttributes[index - 1]?.section && attr.isCategorySpecific);
                  
                  return (
                    <React.Fragment key={attr.id}>
                      {/* Section Header for Category-Specific Sections */}
                      {showSectionHeader && attr.isCategorySpecific && (
                        <div className="col-span-full mt-6 mb-2">
                          <h4 className="text-md font-semibold text-gray-800 border-b-2 border-blue-400 pb-2">
                            {attr.section}
                          </h4>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Golden Product Attribute */}
                    <div className={`rounded-lg p-3 ${attr.goldenValue
                      ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300'
                      : 'bg-gray-100 border border-gray-300'
                      }`}>
                      <div className="text-xs font-semibold text-gray-600 mb-2">
                        {attr.key}
                      </div>
                      <p className="text-sm font-medium text-gray-800">
                        {attr.goldenValue || <span className="text-gray-400 italic">Not available</span>}
                      </p>
                    </div>

                    {/* Right: Scraped Product Attribute (Always Editable) */}
                    <div className="bg-white border border-gray-300 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-gray-600">
                          {attr.key}
                          {attr.isExtra && !attr.isCategorySpecific && (
                            <span className="ml-2 text-xs text-blue-600 font-normal">(Extra)</span>
                          )}
                          {attr.isCategorySpecific && (
                            <span className="ml-2 text-xs text-purple-600 font-normal">({attr.section})</span>
                          )}
                        </div>
                        {attr.accepted && (
                          <div className="flex items-center text-green-600">
                            <Check className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      {editingAttributes[attr.id] ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={attributeValues[attr.id] || ''}
                            onChange={e => handleAttributeChange(attr.id, e.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                              onClick={() => handleAcceptAttribute(attr.id)}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Accept</span>
                            </button>
                            <button
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                              onClick={() => handleCancelEditAttribute(attr.id, attr.scrapedValue)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-800">
                            {attributeValues[attr.id] || <span className="text-gray-400 italic">Not available</span>}
                          </p>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
                              onClick={() => handleEditAttribute(attr.id)}
                            >
                              <Edit2 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            {!attr.accepted && (
                              <button
                                className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs"
                                onClick={() => handleAcceptAttribute(attr.id)}
                              >
                                <Check className="h-3 w-3" />
                                <span>Accept</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                    </React.Fragment>
                  );
                })}

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
                          {predefinedAttributes.map(attr => (
                            <option 
                              key={attr.key} 
                              value={attr.key}
                              disabled={attr.used && attr.key !== 'custom'}
                              className={attr.used && attr.key !== 'custom' ? 'text-gray-400 bg-gray-100' : ''}
                            >
                              {attr.label} {attr.used && attr.key !== 'custom' ? '✓ (Already Used)' : ''}
                            </option>
                          ))}
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
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors text-sm ${selectedAttributeType && newAttributeValue.trim() && (selectedAttributeType !== 'custom' || newAttributeKey.trim())
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
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                      onClick={() => setShowAddAttribute(true)}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add New Attribute</span>
                    </button>
                  </div>
                )}
              </div>
            )}
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

                  {/* Right: Editable Feature */}
                  {!scrapedData ? (
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-center justify-center">
                      <p className="text-gray-500 text-sm text-center">
                        Load a product URL to view features
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-300 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        {editingFeatures[feature.id] ? (
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={featureValues[feature.id] || feature.text}
                              onChange={e => handleFeatureChange(feature.id, e.target.value)}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                                onClick={() => handleAcceptFeature(feature.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Accept</span>
                              </button>
                              <button
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                                onClick={() => handleCancelEditFeature(feature.id, feature.text)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-start">
                            <span className="text-blue-600 mr-2 mt-1">•</span>
                            <div className="flex-1">
                              <p className="text-gray-800 text-sm leading-relaxed">
                                {feature.text}
                              </p>
                              <div className="flex gap-2 mt-2">
                                <button
                                  className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
                                  onClick={() => handleEditFeature(feature.id)}
                                >
                                  <Edit2 className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>
                                {!feature.accepted && (
                                  <button
                                    className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs"
                                    onClick={() => handleAcceptFeature(feature.id)}
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>Accept</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            {feature.accepted && (
                              <div className="flex items-center text-green-600 ml-2 flex-shrink-0">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add New Feature Section */}
              {scrapedData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Empty left side for alignment */}
                  <div></div>

                  {/* Right: Add New Feature */}
                  {showAddFeature ? (
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Enter new feature..."
                          className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={newFeature}
                          onChange={e => setNewFeature(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-md transition-colors text-sm ${newFeature.trim()
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            onClick={handleAddFeature}
                            disabled={!newFeature.trim()}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Add Feature</span>
                          </button>
                          <button
                            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
                            onClick={() => {
                              setShowAddFeature(false);
                              setNewFeature('');
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm w-full"
                      onClick={() => setShowAddFeature(true)}
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add New Feature</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* =========================== */}
          {/* PRODUCT SKU-ID SECTION */}
          {/* =========================== */}
          <div className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
              <h3 className="text-lg font-semibold text-gray-700">Golden Listing SKU-ID</h3>
              <h3 className="text-lg font-semibold text-gray-700">Your Listing SKU-ID</h3>
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
              <h3 className="text-lg font-semibold text-gray-700">Title</h3>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Gold Standard Title */}
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4">
                <div className="bg-white/60 rounded-md p-3 border border-yellow-200">
                  <p className="text-gray-800 text-sm leading-relaxed">
                    {goldenProduct.title}
                  </p>
                </div>
              </div>

              {/* Right: Your Product Title (Editable) or Placeholder */}
              {!scrapedData ? (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-center justify-center">
                  <p className="text-gray-500 text-sm text-center">
                    Load a product URL to view title
                  </p>
                </div>
              ) : (
                <div>
                  {isEditingTitle ? (
                    <div className="space-y-3">
                      <textarea
                        ref={titleTextareaRef}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        value={productTitle}
                        onChange={e => setProductTitle(e.target.value)}
                        rows={3}
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
                        {acceptedTitle}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors text-sm"
                          onClick={() => {
                            setProductTitle(originalTitle);
                            setIsEditingTitle(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Original</span>
                        </button>
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
              )}
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
              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4">
                <div className="bg-white/60 rounded-md p-3 border border-yellow-200">
                  <p className="text-gray-800 text-sm leading-relaxed">
                    {getGoldenDescription()}
                  </p>
                </div>
              </div>

              {/* Right: Scraped Description or Placeholder */}
              {!scrapedData ? (
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 flex items-center justify-center">
                  <p className="text-gray-500 text-sm text-center">
                    Load a product URL to view details
                  </p>
                </div>
              ) : (
                <div>
                  {isEditingDescription ? (
                    <div className="space-y-3">
                      <textarea
                        ref={descTextareaRef}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        value={productDescription}
                        onChange={e => setProductDescription(e.target.value)}
                        rows={4}
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
                        {acceptedDescription}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="flex items-center space-x-1 px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors text-sm"
                          onClick={() => {
                            setProductDescription(originalDescription);
                            setIsEditingDescription(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span>View Original</span>
                        </button>
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
              )}
            </div>
          </div>
        </div>

        {/* Action Bar - Removed Save button */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {scrapedData ? (
                <>
                  {productAttributes.every(attr => attr.accepted) && productFeatures.every(feature => feature.accepted) ? (
                    <>
                      <span className="font-medium text-green-600">All attributes and features accepted!</span>
                      <span className="ml-2">Ready to proceed to image comparison.</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Please accept all attributes and features to proceed</span>
                      <span className="ml-2">
                        ({productAttributes.filter(attr => attr.accepted).length} of {productAttributes.length} attributes, {' '}
                        {productFeatures.filter(feature => feature.accepted).length} of {productFeatures.length} features accepted)
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium">Enter a product URL to begin</span>
                  <span className="ml-2">Load a product to see the comparison</span>
                </>
              )}
            </div>
            <button
              className={`flex items-center space-x-2 px-6 py-2 rounded-md transition-colors text-sm font-medium ${scrapedData && productAttributes.every(attr => attr.accepted) && productFeatures.every(feature => feature.accepted)
                ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              onClick={handleProceed}
              disabled={!scrapedData || !productAttributes.every(attr => attr.accepted) || !productFeatures.every(feature => feature.accepted)}
            >
              <span>Proceed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductComparator;

