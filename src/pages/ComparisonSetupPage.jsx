// Page 3: Comparison Setup Page with Dynamic Filters and Product Loading

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GoldStandardPanel from '../components/GoldStandardPanel';
import { fetchGoldenSheetData, scrapeProductFromUrl, scrapeProductMetadataFromAsin } from '../api/api';
import { Edit3, Plus, ChevronDown, Link, Loader2, AlertCircle, Check, ExternalLink } from 'lucide-react';

const ComparisonSetupPage = () => {
  const navigate = useNavigate();
  const { sellerId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isScrapingMetadata, setIsScrapingMetadata] = useState(false);
  const [loadedProduct, setLoadedProduct] = useState(null);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filterColumns, setFilterColumns] = useState([]); // Dynamic columns from sheet
  const [filterOptions, setFilterOptions] = useState({}); // Options for each column
  const [filters, setFilters] = useState({}); // User-selected filter values

  // ASIN Selection State
  const [asinList, setAsinList] = useState([]);
  const [selectedAsin, setSelectedAsin] = useState('');
  const [asinDropdownOpen, setAsinDropdownOpen] = useState(false);
  const [isLoadingAsins, setIsLoadingAsins] = useState(false);

  // Scraped Metadata State
  const [scrapedMetadata, setScrapedMetadata] = useState({
    category: '',
    gender: '',
    ageGroup: '',
    subcategory: ''
  });

  // Track if metadata was fetched
  const [metadataFetched, setMetadataFetched] = useState(false);

  // Action type from localStorage
  const [actionType, setActionType] = useState('');

  // Update sellerId in localStorage when component mounts
  useEffect(() => {
    if (sellerId) {
      localStorage.setItem('sellerId', sellerId);
      // Trigger a custom event to notify Navbar
      window.dispatchEvent(new CustomEvent('sellerIdUpdated', { detail: sellerId }));
    }
  }, [sellerId]);

  // Fetch selected ASINs and action type on component mount
  useEffect(() => {
    fetchSelectedAsins();
    // Get action type from localStorage
    const storedActionType = localStorage.getItem('actionType');
    setActionType(storedActionType || '');
  }, []);

  // Fetch metadata when ASIN is selected
  useEffect(() => {
    if (selectedAsin) {
      fetchAsinMetadata(selectedAsin);
    }
  }, [selectedAsin]);
  
  // Debug useEffect
  useEffect(() => {
    console.log('🔍 Filters updated:', filters);
    console.log('🔍 Scraped metadata:', scrapedMetadata);
  }, [filters, scrapedMetadata]);

  // Function to fetch selected ASINs from localStorage
  const fetchSelectedAsins = async () => {
    try {
      setIsLoadingAsins(true);
      
      // Get selected ASINs from localStorage (stored by DataSelectionPage)
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
            
            console.log(`Loaded ${uniqueAsins.length} selected ASINs:`, uniqueAsins);
            
            // Auto-select first ASIN only for edit action
            const actionType = localStorage.getItem('actionType');
            if (uniqueAsins.length > 0 && actionType === 'edit') {
              setSelectedAsin(uniqueAsins[0]);
            } else if (uniqueAsins.length > 0 && actionType === 'new') {
              // For new listing, don't auto-select any ASIN
              setSelectedAsin('');
            }
            
            return;
          }
        } catch (parseError) {
          console.error('Error parsing stored ASINs:', parseError);
        }
      }
      
      // If no selected ASINs found
      console.log('No selected ASINs found in localStorage');
      setAsinList([]);
      
    } catch (error) {
      console.error('Error loading ASINs:', error);
      setAsinList([]);
    } finally {
      setIsLoadingAsins(false);
    }
  };

  // Function to fetch ASIN metadata
  const fetchAsinMetadata = async (asin) => {
    if (!asin) return;
    
    setIsScrapingMetadata(true);
    setError('');
    
    try {
      console.log(`🔄 Fetching metadata for ASIN: ${asin}`);
      
      const result = await scrapeProductMetadataFromAsin(asin);
      console.log('✅ Metadata API result:', result);
      
      const metadata = result.metadata || {};
      console.log('📊 Scraped metadata:', metadata);
      
      // Store scraped metadata
      const newMetadata = {
        category: metadata.category || '',
        gender: metadata.gender || '',
        ageGroup: metadata.age_group || '',
        subcategory: metadata.subcategory || ''
      };
      
      setScrapedMetadata(newMetadata);
      setMetadataFetched(true);
      
      console.log('✅ Metadata stored for reference:', newMetadata);
      
    } catch (error) {
      console.error('❌ Error fetching metadata:', error);
      setError(`Failed to fetch metadata for ASIN ${asin}. You can still proceed with manual filter selection.`);
      setMetadataFetched(false);
      
      // Clear metadata on error
      setScrapedMetadata({
        category: '',
        gender: '',
        ageGroup: '',
        subcategory: ''
      });
    } finally {
      setIsScrapingMetadata(false);
    }
  };

  // Function to handle ASIN selection
  const handleAsinSelect = (asin) => {
    setSelectedAsin(asin);
    setAsinDropdownOpen(false);
    console.log(`Selected ASIN: ${asin}`);
  };

  // Fetch products on component mount
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      setError('');
      try {
        console.log('🔄 Fetching golden sheet data from API...');
        const sheetData = await fetchGoldenSheetData();
        
        console.log('✅ Golden sheet data loaded:', {
          totalRows: sheetData.totalRows,
          fromCache: sheetData.fromCache,
          headers: sheetData.headers
        });
        
        // Note: sellerId from URL params is NOT used for filtering
        // All products from the golden sheet are loaded
        // Filtering is done ONLY through the dynamic filter dropdowns
        const allProducts = sheetData.data;
        
        console.log('📊 Total products loaded:', allProducts.length);
        setProducts(allProducts);
        setFilteredProducts(allProducts);
        
        // Build dynamic filter options from actual sheet columns
        buildDynamicFilters(allProducts, sheetData.headers);
        
      } catch (err) {
        console.error('❌ Error loading golden sheet data:', err);
        setError('Failed to load products: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProducts();
  }, []); // Removed sellerId dependency - we load all products regardless

  // Build dynamic filters based on sheet data columns
  const buildDynamicFilters = (data, headers) => {
    if (!data || data.length === 0) return;
    
    // Define columns for filtering (excluding URL and Subcategory initially)
    const baseColumns = ['Category', 'Gender', 'Age Group'];
    
    console.log('Building base filters for columns:', baseColumns);
    
    const newFilterOptions = {};
    
    baseColumns.forEach(column => {
      // Get unique values for this column
      const uniqueValues = [...new Set(data.map(item => item[column]).filter(Boolean))].sort();
      
      // Add "Select" option at the beginning
      newFilterOptions[column] = [`Select ${column}`, ...uniqueValues];
    });
    
    // Initialize Subcategory with empty options
    newFilterOptions['Subcategory'] = ['Select Subcategory'];
    
    console.log('Filter options:', newFilterOptions);
    
    setFilterColumns([...baseColumns, 'Subcategory']);
    setFilterOptions(newFilterOptions);
    
    // Initialize filters with "Select" options
    const initialFilters = {};
    baseColumns.forEach(column => {
      initialFilters[column] = `Select ${column}`;
    });
    initialFilters['Subcategory'] = 'Select Subcategory';
    
    setFilters(initialFilters);
    console.log('Initialized filters:', initialFilters);
  };

  // Update subcategory options when Category, Gender, or Age Group changes
  useEffect(() => {
    if (products.length === 0) return;
    
    const { Category, Gender, 'Age Group': AgeGroup } = filters;
    
    // Check if all three base filters are selected
    if (!Category || Category.startsWith('Select ') ||
        !Gender || Gender.startsWith('Select ') ||
        !AgeGroup || AgeGroup.startsWith('Select ')) {
      // Reset subcategory options to empty
      setFilterOptions(prev => ({
        ...prev,
        'Subcategory': ['Select Subcategory']
      }));
      setFilters(prev => ({
        ...prev,
        'Subcategory': 'Select Subcategory'
      }));
      return;
    }
    
    // Filter products based on selected Category, Gender, and Age Group
    const filteredByBase = products.filter(product => 
      product.Category === Category &&
      product.Gender === Gender &&
      product['Age Group'] === AgeGroup
    );
    
    // Get unique subcategories from filtered products
    const uniqueSubcategories = [...new Set(filteredByBase.map(item => item.Subcategory).filter(Boolean))].sort();
    
    console.log('📊 Updating subcategory options:', {
      Category,
      Gender,
      AgeGroup,
      filteredCount: filteredByBase.length,
      subcategories: uniqueSubcategories
    });
    
    // Update subcategory options
    setFilterOptions(prev => ({
      ...prev,
      'Subcategory': ['Select Subcategory', ...uniqueSubcategories]
    }));
    
    // Reset subcategory filter value
    setFilters(prev => ({
      ...prev,
      'Subcategory': 'Select Subcategory'
    }));
    
  }, [filters.Category, filters.Gender, filters['Age Group'], products]);

  // Apply filters whenever filter state changes
  useEffect(() => {
    if (products.length === 0) return;
    
    let filtered = [...products];
    
    console.log('Applying filters:', filters);
    console.log('Total products to filter:', products.length);
    
    // Apply each filter dynamically (skip "Select" options)
    filterColumns.forEach(column => {
      const filterValue = filters[column];
      if (filterValue && !filterValue.startsWith('Select ') && filterValue !== 'Select Subcategory') {
        const beforeCount = filtered.length;
        filtered = filtered.filter(product => {
          const productValue = product[column];
          const match = productValue === filterValue;
          if (!match && productValue && filterValue) {
            console.log(`Mismatch in ${column}: Product="${productValue}" Filter="${filterValue}"`);
          }
          return match;
        });
        console.log(`Filter ${column}="${filterValue}": ${beforeCount} -> ${filtered.length} products`);
      }
    });
    
    console.log('Final filtered products count:', filtered.length);
    
    // If no exact matches, try case-insensitive matching
    if (filtered.length === 0 && areAllFiltersSelected()) {
      console.log('No exact matches, trying case-insensitive matching...');
      filtered = products.filter(product => {
        return filterColumns.every(column => {
          const filterValue = filters[column];
          const productValue = product[column];
          
          if (!filterValue || filterValue.startsWith('Select ') || filterValue === 'Select Subcategory') {
            return true;
          }
          
          if (!productValue) return false;
          
          return productValue.toString().toLowerCase().trim() === filterValue.toString().toLowerCase().trim();
        });
      });
      console.log('After case-insensitive matching:', filtered.length, 'products');
    }
    
    setFilteredProducts(filtered);
  }, [filters, products, filterColumns]);

  // Check if all filters have been selected (not "Select...")
  const areAllFiltersSelected = () => {
    const result = filterColumns.every(column => {
      const filterValue = filters[column];
      const hasValidValue = filterValue && 
                           !filterValue.startsWith('Select ') && 
                           filterValue !== 'Select Subcategory' &&
                           filterValue.trim() !== '';
      
      console.log(`Filter check - ${column}: "${filterValue}" = ${hasValidValue}`);
      return hasValidValue;
    });
    
    console.log('All filters selected?', result);
    return result;
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleLoadUrl = async () => {
    // Debug current state
    console.log('=== DEBUG BEFORE LOAD URL ===');
    console.log('Filters:', filters);
    console.log('Filtered products count:', filteredProducts.length);
    console.log('All filters selected?', areAllFiltersSelected());
    
    // Log sample products to see what's in the sheet
    if (products.length > 0) {
      console.log('Sample products from sheet:');
      products.slice(0, 3).forEach((p, i) => {
        console.log(`Product ${i}:`, {
          Category: p.Category,
          Gender: p.Gender,
          'Age Group': p['Age Group'],
          Subcategory: p.Subcategory,
          URL: p.URL || p.url
        });
      });
    }
    
    setIsLoading(true);
    setError('');

    try {
      // Re-fetch golden sheet data to get the latest URLs
      console.log('🔄 Re-fetching golden sheet data to get latest URLs...');
      const sheetData = await fetchGoldenSheetData();
      console.log('✅ Fresh golden sheet data loaded:', {
        totalRows: sheetData.totalRows,
        fromCache: sheetData.fromCache,
        headers: sheetData.headers
      });

      // Update products state with fresh data
      const freshProducts = sheetData.data;
      setProducts(freshProducts);

      // Apply filters to fresh data
      let freshFilteredProducts = [...freshProducts];
      
      console.log('🎯 Applying filters to fresh data:', filters);
      
      // Apply each filter with case-insensitive matching
      filterColumns.forEach(column => {
        const filterValue = filters[column];
        if (filterValue && !filterValue.startsWith('Select ') && filterValue !== 'Select Subcategory') {
          const beforeCount = freshFilteredProducts.length;
          freshFilteredProducts = freshFilteredProducts.filter(product => {
            const productValue = product[column];
            if (!productValue) return false;
            
            // Try case-insensitive matching
            return productValue.toString().toLowerCase().trim() === filterValue.toString().toLowerCase().trim();
          });
          console.log(`Filter ${column}="${filterValue}": ${beforeCount} -> ${freshFilteredProducts.length} products`);
        }
      });

      console.log('📊 Fresh filtered products count:', freshFilteredProducts.length);
      setFilteredProducts(freshFilteredProducts);

      // Check if we have any filtered products
      if (freshFilteredProducts.length === 0) {
        setError(`No products match the selected filters. 
                  Filters: ${JSON.stringify(filters, null, 2)}. 
                  Total products in sheet: ${freshProducts.length}. 
                  Please check if your filter values match the Golden Sheet data.`);
        setIsLoading(false);
        return;
      }

      // Get the first product from filtered results
      const selectedProduct = freshFilteredProducts[0];
      
      // Get the URL from the selected product
      const productUrl = selectedProduct.URL || selectedProduct.url;
      
      if (!productUrl) {
        setError('No URL found for the selected product.');
        setIsLoading(false);
        return;
      }

      console.log('=== LOAD URL CLICKED ===');
      console.log('Selected Product from Sheet:', selectedProduct);
      console.log('Product URL from Golden Sheet:', productUrl);
      console.log('Selected ASIN:', selectedAsin || 'None');
      console.log('Total Filtered Products:', freshFilteredProducts.length);
      console.log('Applied Filters:', filters);
      console.log('========================');

      let scrapedProduct = {};
      
      try {
        // Scrape product data from the Golden Sheet URL
        console.log('🔄 Starting web scraping for Golden Sheet URL:', productUrl);
        scrapedProduct = await scrapeProductFromUrl(productUrl);
        console.log('✅ Scraped product data received:', scrapedProduct);
      } catch (scrapeErr) {
        console.warn('⚠️ Scraping failed, using basic product data:', scrapeErr.message);
        // Continue with empty scrapedProduct object - will use fallback values below
      }

      // Create a product object combining scraped data with sheet data
      const goldStandard = {
        // Basic Info
        id: scrapedProduct.asin || 'N/A',
        asin: scrapedProduct.asin || 'N/A',
        title: scrapedProduct.title || `${selectedProduct.Category} - ${selectedProduct.Subcategory}`,
        brand: scrapedProduct.brand,
        amazonUrl: productUrl,
        
        // Sheet metadata
        category: selectedProduct.Category,
        gender: selectedProduct.Gender,
        ageGroup: selectedProduct['Age Group'],
        subcategory: selectedProduct.Subcategory,
        
        // Images from scraped data
        images: scrapedProduct.images || [],
        
        // Features/Bullets
        features: scrapedProduct.features || [],
        
        // Description
        description: scrapedProduct.description,
        
        // Detailed sections
        productDetails: scrapedProduct.productDetails,
        productDetailsArray: scrapedProduct.productDetailsArray || [],
        
        manufacturingDetails: scrapedProduct.manufacturingDetails,
        manufacturingDetailsArray: scrapedProduct.manufacturingDetailsArray || [],
        
        additionalInfo: scrapedProduct.additionalInfo,
        additionalInfoArray: scrapedProduct.additionalInfoArray || [],
        
        // Store the full scraped data
        scrapedData: scrapedProduct
      };

      console.log('📦 Final gold standard product:', goldStandard);
      setLoadedProduct(goldStandard);

      // Store filter values in localStorage for use in image generation
      const selectedFilters = {};
      filterColumns.forEach(column => {
        const filterValue = filters[column];
        if (filterValue && !filterValue.startsWith('Select ')) {
          selectedFilters[column] = filterValue;
        }
      });
      localStorage.setItem('productFilters', JSON.stringify(selectedFilters));
      console.log('💾 Stored filters in localStorage:', selectedFilters);

      // Store the complete gold standard product data in localStorage
      localStorage.setItem('goldStandardProduct', JSON.stringify(goldStandard));
      console.log('💾 Stored gold standard product in localStorage');

    } catch (err) {
      console.error('❌ Error loading product:', err);
      
      // Show detailed error for debugging
      const detailedError = `Failed to load product: ${err.message}. 
                            Filters: ${JSON.stringify(filters)}. 
                            Filtered products count: ${filteredProducts.length}`;
      setError(detailedError);
      
      // Even on error, show a basic product layout if we have filtered products
      if (filteredProducts.length > 0) {
        const selectedProduct = filteredProducts[0];
        const productUrl = selectedProduct.URL || selectedProduct.url;
        
        const basicProduct = {
          id: 'N/A',
          asin: 'N/A',
          title: `${selectedProduct.Category} - ${selectedProduct.Subcategory}`,
          brand: null,
          amazonUrl: productUrl || '#',
          category: selectedProduct.Category,
          gender: selectedProduct.Gender,
          ageGroup: selectedProduct['Age Group'],
          subcategory: selectedProduct.Subcategory,
          images: [],
          features: [],
          description: null,
          productDetails: null,
          productDetailsArray: [],
          manufacturingDetails: null,
          manufacturingDetailsArray: [],
          additionalInfo: null,
          additionalInfoArray: [],
          scrapedData: null
        };
        
        console.log('📦 Using basic product layout (scraping failed):', basicProduct);
        setLoadedProduct(basicProduct);

        // Store filter values in localStorage even when scraping fails
        const selectedFilters = {};
        filterColumns.forEach(column => {
          const filterValue = filters[column];
          if (filterValue && !filterValue.startsWith('Select ')) {
            selectedFilters[column] = filterValue;
          }
        });
        localStorage.setItem('productFilters', JSON.stringify(selectedFilters));
        console.log('💾 Stored filters in localStorage:', selectedFilters);

        // Store the basic product data in localStorage even when scraping fails
        localStorage.setItem('goldStandardProduct', JSON.stringify(basicProduct));
        console.log('💾 Stored basic product data in localStorage');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditExisting = () => {
  // Store the selected ASIN from Comparison Setup page
  if (selectedAsin) {
    localStorage.setItem('comparisonPageSelectedAsin', selectedAsin);
  }
  navigate('/edit-product/B08N5V3T8W');
};

const handleCreateNew = () => {
  // Clear any specific ASIN selection
  localStorage.removeItem('comparisonPageSelectedAsin');
  navigate('/new-product');
};

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Comparison Setup</h1>
          <p className="text-gray-600 mt-1">
            Filtered: <span className="font-medium">{filteredProducts.length}</span>
            {isLoading && <span className="ml-2 text-blue-600">Loading...</span>}
          </p>
        </div>

        {/* ASIN Selection Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Selected Products from Previous Step</h3>
          
          <div className="space-y-3">
            {/* ASIN Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a Product to View Its Metadata (For Reference)
              </label>
              
              <div className="relative">
                <button
                  type="button"
                  className="w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onClick={() => setAsinDropdownOpen(!asinDropdownOpen)}
                  disabled={isLoadingAsins || asinList.length === 0}
                >
                  <span className={`${selectedAsin ? 'text-gray-900' : 'text-gray-500'}`}>
                    {selectedAsin
                      ? `Selected Product: ASIN ${selectedAsin}`
                      : isLoadingAsins
                        ? 'Loading your selected products...'
                        : asinList.length > 0
                          ? `Select from ${asinList.length} product(s) to view metadata`
                          : 'No products selected in previous step'
                    }
                  </span>
                  <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${asinDropdownOpen ? 'transform rotate-180' : ''}`} />
                </button>

                {asinDropdownOpen && asinList.length > 0 && (
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
              
              {/* Status Messages */}
              {asinList.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs text-green-600 flex items-center">
                    <Check className="h-3 w-3 mr-1" />
                    Showing {asinList.length} product{asinList.length !== 1 ? 's' : ''} from previous step
                  </p>
                </div>
              )}
            </div>

            {/* Scraped Metadata Display - Compact Version */}
            {selectedAsin && metadataFetched && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-900">Metadata from Selected ASIN</h4>
                  <a
                    href={`https://www.amazon.in/dp/${selectedAsin}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-xs"
                  >
                    <span>View on Amazon</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {scrapedMetadata.category && scrapedMetadata.category !== 'unknown' && (
                    <div className="bg-white p-2 rounded border text-xs">
                      <p className="text-gray-500">Category</p>
                      <p className="font-medium truncate">{scrapedMetadata.category}</p>
                    </div>
                  )}
                  
                  {scrapedMetadata.gender && scrapedMetadata.gender !== 'unknown' && (
                    <div className="bg-white p-2 rounded border text-xs">
                      <p className="text-gray-500">Gender</p>
                      <p className="font-medium truncate">{scrapedMetadata.gender}</p>
                    </div>
                  )}
                  
                  {scrapedMetadata.ageGroup && scrapedMetadata.ageGroup !== 'unknown' && (
                    <div className="bg-white p-2 rounded border text-xs">
                      <p className="text-gray-500">Age Group</p>
                      <p className="font-medium truncate">{scrapedMetadata.ageGroup}</p>
                    </div>
                  )}
                  
                  {scrapedMetadata.subcategory && scrapedMetadata.subcategory !== 'unknown' && (
                    <div className="bg-white p-2 rounded border text-xs">
                      <p className="text-gray-500">Subcategory</p>
                      <p className="font-medium truncate">{scrapedMetadata.subcategory}</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-2 text-xs text-blue-600">
                  <p>Use these values as reference when selecting filters below</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter Listings from Golden Sheet</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filterColumns.map((column) => {
              // Get corresponding scraped metadata value
              let scrapedValue = '';
              if (column === 'Category') scrapedValue = scrapedMetadata.category;
              else if (column === 'Gender') scrapedValue = scrapedMetadata.gender;
              else if (column === 'Age Group') scrapedValue = scrapedMetadata.ageGroup;
              else if (column === 'Subcategory') scrapedValue = scrapedMetadata.subcategory;
              
              return (
                <div key={column} className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {column}
                    {scrapedValue && scrapedValue !== 'unknown' && scrapedValue !== '' && (
                      <span className="ml-1 text-xs text-blue-600">
                        (ASIN has: {scrapedValue})
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer text-sm bg-white"
                      value={filters[column] || `Select ${column}`}
                      onChange={(e) => handleFilterChange(column, e.target.value)}
                      disabled={column === 'Subcategory' && (
                        filters.Category?.startsWith('Select ') ||
                        filters.Gender?.startsWith('Select ') ||
                        filters['Age Group']?.startsWith('Select ')
                      )}
                    >
                      {(filterOptions[column] || []).map((option) => (
                        <option 
                          key={option} 
                          value={option}
                          disabled={option.startsWith('Select ')}
                        >
                          {option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  {column === 'Subcategory' && (
                    <div className="mt-1 text-xs text-gray-500">
                      {!filters.Category?.startsWith('Select ') &&
                       !filters.Gender?.startsWith('Select ') &&
                       !filters['Age Group']?.startsWith('Select ') ? (
                        <span>✓ Select from available options</span>
                      ) : (
                        <span>⚠ Select Category, Gender, and Age Group first</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {filterColumns.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Loading filters...</p>
          )}
          
          {/* Filter Status */}
          <div className="mt-4 text-xs">
            {areAllFiltersSelected() ? (
              <div className="space-y-1">
                <div className="flex items-center text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  All filters selected.
                </div>
                {filteredProducts.length > 0 ? (
                  <div className="text-green-600 ml-4">
                    ✓ Found {filteredProducts.length} matching product{filteredProducts.length !== 1 ? 's' : ''} in Golden Sheet
                  </div>
                ) : (
                  <div className="text-amber-600 ml-4 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    No exact matches found. Try adjusting filters or check Golden Sheet data.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center text-amber-600">
                  <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                  <span>Please select all filters to find matching products.</span>
                </div>
                {filterColumns.map(column => {
                  const filterValue = filters[column];
                  const hasValue = filterValue && !filterValue.startsWith('Select ') && filterValue !== 'Select Subcategory';
                  return !hasValue && (
                    <div key={column} className="ml-4 text-xs text-gray-500">
                      • {column}: Not selected
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Load URL Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="text-sm text-gray-600">
                {!areAllFiltersSelected() ? (
                  <span className="text-amber-600">⚠ Please select all filters to load a product</span>
                ) : filteredProducts.length > 0 ? (
                  <span className="text-green-600">
                    ✓ Ready to load! {filteredProducts.length} product(s) match your filters.
                  </span>
                ) : (
                  <span className="text-red-600">⚠ No listings match current filters</span>
                )}
              </div>

              <button
                onClick={handleLoadUrl}
                disabled={isLoading || !areAllFiltersSelected()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading Fresh Data...</span>
                  </>
                ) : (
                  <>
                    <Link className="h-4 w-4" />
                    <span>Load Url from Golden Sheet</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="flex flex-col space-y-2 text-red-600 bg-red-50 p-3 rounded-md">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium">Unable to load product</span>
                </div>
                <div className="text-xs text-red-500 pl-6">
                  {error}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Gold Standard Panel (Full Width) - Only show when product is loaded */}
        {loadedProduct && (
          <>
            <div className="space-y-6 mb-8">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Gold Standard</h2>
                <p className="text-gray-600 text-sm">
                  Reference listing that serves as the benchmark for optimization
                </p>
                {loadedProduct.scrapedData && (
                  <div className="mt-2 inline-flex items-center space-x-2 bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Live data scraped from Amazon</span>
                  </div>
                )}
              </div>
              <div className="h-[600px] ring-4 ring-yellow-400 ring-opacity-50 rounded-lg">
                <div className="h-full bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-2">
                  <div className="h-full bg-white rounded-md shadow-lg">
                    <GoldStandardPanel product={loadedProduct} />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Panel (Below Gold Standard) */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-end space-x-4">
                  {/* Edit Existing Listing Button - Active only when actionType is 'edit' */}
                  <button
                    onClick={handleEditExisting}
                    disabled={!loadedProduct || actionType !== 'edit'}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-md transition-colors font-medium ${
                      loadedProduct && actionType === 'edit'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Edit Existing Listing</span>
                  </button>

                  {/* Create New Listing Button - Active only when actionType is 'new' */}
                  <button
                    onClick={handleCreateNew}
                    disabled={!loadedProduct || actionType !== 'new'}
                    className={`flex items-center space-x-2 px-6 py-2 rounded-md transition-colors font-medium ${
                      loadedProduct && actionType === 'new'
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create New Product Listing</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ComparisonSetupPage;