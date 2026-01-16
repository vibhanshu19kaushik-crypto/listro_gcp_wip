// Page 3: Comparison Setup Page with Dynamic Filters and Product Loading


import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GoldStandardPanel from '../components/GoldStandardPanel';
import { fetchGoldenSheetData, scrapeProductFromUrl, scrapeProductMetadataFromAsin, updateStartTimeInSheet } from '../api/api';
import { Edit3, Plus, ChevronDown, Link, Loader2, AlertCircle, Check, ExternalLink, Download } from 'lucide-react';
import { NODE_API_BASE_URL } from '../api/config';


const ComparisonSetupPage = () => {
 const navigate = useNavigate();
 const { sellerId } = useParams();
 const [isLoading, setIsLoading] = useState(false);
 const [isScrapingMetadata, setIsScrapingMetadata] = useState(false);
 const metadataRequestRef = useRef(0);
 const [loadedProduct, setLoadedProduct] = useState(null);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [products, setProducts] = useState([]);
 const [filteredProducts, setFilteredProducts] = useState([]);
 const [filterColumns, setFilterColumns] = useState([]);
 const [filterOptions, setFilterOptions] = useState({});
 const [filters, setFilters] = useState({});


 // ASIN Selection State - UPDATED
 const [asinList, setAsinList] = useState([]);
 const [selectedAsin, setSelectedAsin] = useState('');
 const [asinDropdownOpen, setAsinDropdownOpen] = useState(false);
 const [isLoadingAsins, setIsLoadingAsins] = useState(false);
 const [asinCompletionStatus, setAsinCompletionStatus] = useState({}); // Track completion status
 const [asinSearchQuery, setAsinSearchQuery] = useState(''); // Track ASIN search input


 // Scraped Metadata State
 const [scrapedMetadata, setScrapedMetadata] = useState({
   category: '',
   gender: '',
   ageGroup: '',
   subcategory: '',
   department: ''
 });


 // Track if metadata was fetched
 const [metadataFetched, setMetadataFetched] = useState(false);
 
 // Track when filters are rebuilt to trigger re-population
 const [filtersRebuiltCounter, setFiltersRebuiltCounter] = useState(0);

 // Action type from localStorage
 const [actionType, setActionType] = useState('');


 // Update sellerId in localStorage when component mounts
 useEffect(() => {
   if (sellerId) {
     localStorage.setItem('sellerId', sellerId);
     window.dispatchEvent(new CustomEvent('sellerIdUpdated', { detail: sellerId }));
   }
 }, [sellerId]);


 // Fetch selected ASINs and action type on component mount
 useEffect(() => {
   fetchSelectedAsins();
   const storedActionType = localStorage.getItem('actionType');
   setActionType(storedActionType || '');
 }, []);


 // Debug useEffect
 useEffect(() => {
   console.log('🔍 Filters updated:', filters);
   console.log('🔍 Scraped metadata:', scrapedMetadata);
 }, [filters, scrapedMetadata]);


 // Function to fetch claimed ASINs from server (live data)
 // In ComparisonSetupPage.jsx - Update fetchSelectedAsins function
const fetchSelectedAsins = async () => {
 try {
   setIsLoadingAsins(true);
  
   // Get user email
   const userData = localStorage.getItem('user');
   if (!userData) {
     console.warn('No user data found');
     setAsinList([]);
     return;
   }
  
   const user = JSON.parse(userData);
   const userEmail = user.email;
  
   if (!userEmail) {
     console.warn('No user email found');
     setAsinList([]);
     return;
   }
  
   console.log(`📧 Fetching claimed ASINs for user: ${userEmail}`);
  
   try {
     const response = await fetch(`${NODE_API_BASE_URL}/api/user-claimed-asins`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ email: userEmail }),
     });
    
     if (!response.ok) {
       throw new Error(`Failed to fetch claimed ASINs: ${response.status}`);
     }
    
     const data = await response.json();
    
     if (data.success && data.claimedAsins && data.claimedAsins.length > 0) {
       // Filter ASINs: Only show "Claimed" and "In Progress" statuses
       const availableAsinData = data.claimedAsins.filter(item =>
         item.status === 'Claimed' || item.status === 'In Progress'
       );
      
       // Process the filtered ASINs
       const asinData = availableAsinData.map(item => ({
         asin: item.asin,
         status: item.status,
         startTime: item.startTime,
         endTime: item.endTime,
         isCompleted: item.status === 'Completed',
         canEdit: item.canEdit
       }));
      
       setAsinList(asinData);
      
       // Set completion status map
       const statusMap = {};
       asinData.forEach(item => {
         statusMap[item.asin] = {
           isCompleted: item.isCompleted,
           canEdit: item.canEdit,
           endTime: item.endTime
         };
       });
       setAsinCompletionStatus(statusMap);
      
       console.log(`✅ Loaded ${asinData.length} available ASINs (excluding Completed):`, asinData);
      
       // Auto-select first available ASIN for edit action
       const actionType = localStorage.getItem('actionType');
       if (asinData.length > 0 && actionType === 'edit') {
         const firstAvailable = asinData.find(item => item.canEdit);
         if (firstAvailable) {
           setSelectedAsin(firstAvailable.asin);
         } else {
           setSelectedAsin('');
         }
       } else if (asinData.length > 0 && actionType === 'new') {
         setSelectedAsin('');
       }
      
     } else {
       console.log('No claimed ASINs found for this user');
       setAsinList([]);
     }
    
   } catch (error) {
     console.error('Error fetching claimed ASINs:', error);
     setAsinList([]);
   }
  
 } catch (error) {
   console.error('Error loading ASINs:', error);
   setAsinList([]);
 } finally {
   setIsLoadingAsins(false);
 }
};


 // Function to handle ASIN selection
 const handleAsinSelect = (asin) => {
   setSelectedAsin(asin);
   setAsinDropdownOpen(false);
   setAsinSearchQuery(''); // Clear search when selection is made
   console.log(`Selected ASIN: ${asin}`);
  
   // Reset metadata display when new ASIN is selected
   setMetadataFetched(false);
   setScrapedMetadata({
     category: '',
     gender: '',
     ageGroup: '',
     subcategory: ''
   });
   setError('');
   setSuccess('');
 };


 // Function to fetch ASIN metadata and populate filters
 const fetchAsinMetadata = async (asin) => {
   if (!asin) {
     setError('Please select an ASIN first');
     return;
   }

   // Prevent concurrent clicks / overlapping requests
   if (isScrapingMetadata) return;
  
  const requestId = ++metadataRequestRef.current;

  setIsScrapingMetadata(true);
  // Clear previous messages for this run
  setError('');
  setSuccess('');
  
   try {
     console.log(`🔄 Fetching metadata for ASIN: ${asin}`);
    
     // STEP 1: Get user email from localStorage
     const userData = localStorage.getItem('user');
     let userEmail = null;
    
     if (userData) {
       try {
         const parsedUser = JSON.parse(userData);
         userEmail = parsedUser.email;
         console.log(`📧 Found user email in localStorage: ${userEmail}`);
       } catch (parseError) {
         console.warn('⚠️ Could not parse user data:', parseError);
       }
     } else {
       console.warn('⚠️ No user data found in localStorage');
     }
    
     // STEP 2: Update Start_Time in Google Sheet if we have email
     if (userEmail) {
       console.log(`📝 Updating Start_Time for ASIN: ${asin}, Email: ${userEmail}`);
      
       try {
         const updateResult = await updateStartTimeInSheet(asin, userEmail);
        
         if (updateResult.success) {
           if (updateResult.updated) {
             console.log('✅ Start_Time updated successfully in Google Sheet:', updateResult);
             setSuccess(prev => prev ?
               `${prev}. Start time recorded.` :
               'Start time recorded in tracking sheet.');
           } else {
             console.log('ℹ️ No matching row found for this user/ASIN combination in tracking sheet');
           }
         } else {
           console.warn('⚠️ Could not update Start_Time, but continuing:', updateResult.error);
         }
       } catch (updateError) {
         console.warn('⚠️ Start_Time update failed, but continuing with metadata fetch:', updateError);
       }
     } else {
       console.warn('⚠️ Skipping Start_Time update: No user email available');
     }
    
     // STEP 3: Fetch metadata from ASIN (retry on transient blocks)
     const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
     const isBlockedError = (e) => {
       const msg = (e?.message || e?.toString?.() || '').toLowerCase();
       return (
         msg.includes('failed to fetch html') ||
         msg.includes('blocked') ||
         msg.includes('captcha') ||
         msg.includes('429') ||
         msg.includes('too many requests') ||
         msg.includes('networkerror')
       );
     };

     const tryScrapeWithRetry = async () => {
       const maxAttempts = 3;
       let lastErr;

       for (let attempt = 1; attempt <= maxAttempts; attempt++) {
         // If a newer request started, stop this one.
         if (metadataRequestRef.current !== requestId) {
           const err = new Error('Request superseded');
           err.__superseded = true;
           throw err;
         }

         try {
           const res = await scrapeProductMetadataFromAsin(asin);
           return res;
         } catch (e) {
           lastErr = e;

           // Don't retry non-transient failures
           if (!isBlockedError(e) || attempt === maxAttempts) {
             throw e;
           }

           // Exponential backoff with jitter (helps with intermittent bot blocks)
           const backoffMs = Math.round(600 * Math.pow(2, attempt - 1) + Math.random() * 300);
           console.warn(
             `⚠️ Metadata fetch attempt ${attempt} failed (likely blocked). Retrying in ${backoffMs}ms...`,
             e
           );
           await sleep(backoffMs);
         }
       }
       throw lastErr;
     };

     const result = await tryScrapeWithRetry();
     console.log('✅ Metadata API result:', result);
    
     const metadata = result.metadata || {};
     console.log('📊 Scraped metadata:', metadata);
    
     // Store scraped metadata
     const newMetadata = {
       category: metadata.category || '',
       gender: metadata.gender || '',
       ageGroup: metadata.age_group || '',
       subcategory: metadata.subcategory || '',
       department: metadata.department || ''
     };
    
  // If another request started after this one, ignore results
  if (metadataRequestRef.current !== requestId) return;

  setScrapedMetadata(newMetadata);
  setMetadataFetched(true);
    
     console.log('✅ Metadata stored for reference:', newMetadata);
    
  // Automatically populate filter fields with scraped metadata.
  // Note: filter options may not be ready yet on first load; a useEffect below
  // will re-apply population once options exist.
  populateFiltersFromMetadata(newMetadata);
    
   } catch (error) {
     // Ignore outcomes from superseded requests
     if (error?.__superseded) return;

     console.error('❌ Error fetching metadata:', error);

     // If backend is intermittently blocked, show a clearer message
     setError(
       `Unable to load product\nFailed to fetch metadata for ASIN ${asin}. You can still proceed with manual filter selection.`
     );
     setMetadataFetched(false);

     setScrapedMetadata({
       category: '',
       gender: '',
       ageGroup: '',
       subcategory: '',
       department: ''
     });
   } finally {
     // Only clear loading state if this is the latest request
     if (metadataRequestRef.current === requestId) {
       setIsScrapingMetadata(false);
     }
   }
 };


 // If metadata was fetched before the golden-sheet filter options were fully built,
 // auto-population can fail on the first click. Re-apply once options are available.
 useEffect(() => {
   if (!selectedAsin || !metadataFetched) return;
   if (!scrapedMetadata?.category && !scrapedMetadata?.gender && !scrapedMetadata?.ageGroup && !scrapedMetadata?.subcategory) return;

   const hasOptions =
     (filterOptions?.Category && filterOptions.Category.length > 1) ||
     (filterOptions?.Gender && filterOptions.Gender.length > 1) ||
     (filterOptions?.['Age Group'] && filterOptions['Age Group'].length > 1);

   if (!hasOptions) return;

   populateFiltersFromMetadata(scrapedMetadata);
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [filterOptions, metadataFetched, selectedAsin]);


 // Rebuild filters when metadata category is detected (to switch between Home & Kitchen and Clothing filters)
 useEffect(() => {
   if (products.length === 0 || !scrapedMetadata.category) return;
   
   const isHomeKitchen = scrapedMetadata.category.toLowerCase().includes('home') && 
                         scrapedMetadata.category.toLowerCase().includes('kitchen');
   
   console.log('🔄 Metadata category detected, reloading appropriate sheet:', scrapedMetadata.category);
   
   // Reload the appropriate sheet data based on category
   const reloadSheetData = async () => {
     try {
       setIsLoading(true);
       
       let sheetData;
       if (isHomeKitchen) {
         console.log('📊 Loading Home & Kitchen sheet data...');
         const response = await fetch(`${NODE_API_BASE_URL}/api/home-kitchen-sheet-data`);
         sheetData = await response.json();
       } else {
         console.log('📊 Loading Clothing (golden) sheet data...');
         sheetData = await fetchGoldenSheetData();
       }
       
       if (!sheetData.success) {
         throw new Error(sheetData.error || 'Failed to load sheet data');
       }
       
       console.log('✅ Sheet data loaded:', {
         category: isHomeKitchen ? 'Home & Kitchen' : 'Clothing',
         totalRows: sheetData.totalRows,
         headers: sheetData.headers
       });
       
       const allProducts = sheetData.data;
       setProducts(allProducts);
       setFilteredProducts(allProducts);
       
       // Rebuild filters with the new data
       buildDynamicFilters(allProducts, sheetData.headers, scrapedMetadata.category);
       
       setIsLoading(false);
     } catch (error) {
       console.error('❌ Error reloading sheet data:', error);
       setError('Failed to load sheet data: ' + error.message);
       setIsLoading(false);
     }
   };
   
   reloadSheetData();
   
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [scrapedMetadata.category]);


 // Re-populate filters after they are rebuilt
 useEffect(() => {
   if (filtersRebuiltCounter === 0) return; // Skip initial render
   if (!metadataFetched || !scrapedMetadata.category) return;
   
   // Check if filter options are ready
   const hasOptions = filterOptions && Object.keys(filterOptions).length > 0;
   if (!hasOptions) {
     console.log('⚠️ Filter options not ready yet, skipping population');
     return;
   }
   
   console.log('🔄 Filters rebuilt, re-populating with metadata...', {
     filterOptions: Object.keys(filterOptions),
     metadata: scrapedMetadata
   });
   
   // Small delay to ensure filterOptions state is updated
   const timer = setTimeout(() => {
     populateFiltersFromMetadata(scrapedMetadata);
   }, 50);
   
   return () => clearTimeout(timer);
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [filtersRebuiltCounter, filterOptions]);


 // Function to populate filter fields from scraped metadata
 const populateFiltersFromMetadata = (metadata) => {
   const newFilters = { ...filters };
  
   // Check if this is Home & Kitchen category
   const isHomeKitchen = metadata.category && 
     metadata.category.toLowerCase().includes('home') && 
     metadata.category.toLowerCase().includes('kitchen');
  
   // Map metadata fields to filter fields based on category type
   const fieldMapping = {
     'Category': metadata.category,
     'Subcategory': metadata.subcategory
   };
   
   // Add Department only for Home & Kitchen
   if (isHomeKitchen) {
     fieldMapping['Department'] = metadata.department;
   } else {
     // Add Gender and Age Group for non-Home & Kitchen categories
     fieldMapping['Gender'] = metadata.gender;
     fieldMapping['Age Group'] = metadata.ageGroup;
   }
  
   let populatedCount = 0;
  
   // Update each filter if metadata value exists and is valid
   Object.entries(fieldMapping).forEach(([filterField, metadataValue]) => {
     if (metadataValue && metadataValue !== 'unknown' && metadataValue.trim() !== '') {
       // Check if the value exists in filter options
       const options = filterOptions[filterField] || [];
       const exactMatch = options.includes(metadataValue);
       const caseInsensitiveMatch = options.find(opt =>
         opt.toLowerCase().trim() === metadataValue.toLowerCase().trim() &&
         !opt.startsWith('Select ')
       );
      
       if (exactMatch) {
         newFilters[filterField] = metadataValue;
         populatedCount++;
         console.log(`✓ Auto-populated ${filterField} with: ${metadataValue}`);
       } else if (caseInsensitiveMatch) {
         newFilters[filterField] = caseInsensitiveMatch;
         populatedCount++;
         console.log(`✓ Auto-populated ${filterField} with case-insensitive match: ${caseInsensitiveMatch}`);
       } else {
         console.log(`⚠ ${filterField} value "${metadataValue}" not found in available options`);
       }
     }
   });
  
   setFilters(newFilters);
  
   // Show success message
   if (populatedCount > 0) {
     setSuccess(`Successfully auto-populated ${populatedCount} filter${populatedCount !== 1 ? 's' : ''} from ASIN metadata`);
     
     // Clear any previous errors since population was successful
     setError('');
    
     // Clear success message after 5 seconds
     setTimeout(() => {
       setSuccess('');
     }, 5000);
   } else {
     // Only set error if we have metadata but couldn't populate anything
     if (metadata.category || metadata.department || metadata.gender || metadata.subcategory) {
       setError('No matching filter options found for the scraped metadata. Please select filters manually.');
     }
   }
 };


 // Fetch products on component mount
 useEffect(() => {
   const loadProducts = async () => {
     setIsLoading(true);
     setError('');
     setSuccess('');
     try {
       console.log('🔄 Fetching golden sheet data from API...');
       const sheetData = await fetchGoldenSheetData();
      
       console.log('✅ Golden sheet data loaded:', {
         totalRows: sheetData.totalRows,
         fromCache: sheetData.fromCache,
         headers: sheetData.headers
       });
      
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
 }, []);


 // Build dynamic filters based on sheet data columns
 const buildDynamicFilters = (data, headers, detectedCategory = null) => {
   if (!data || data.length === 0) return;
  
   // Check if this is Home & Kitchen category
   // Priority: 1) Detected category from parameter, 2) Scraped metadata, 3) Sheet data
   let isHomeKitchen = false;
   
   if (detectedCategory) {
     isHomeKitchen = detectedCategory.toLowerCase().includes('home') && 
                     detectedCategory.toLowerCase().includes('kitchen');
   } else if (scrapedMetadata.category) {
     isHomeKitchen = scrapedMetadata.category.toLowerCase().includes('home') && 
                     scrapedMetadata.category.toLowerCase().includes('kitchen');
   } else {
     isHomeKitchen = data.some(item => 
       item.Category && 
       item.Category.toLowerCase().includes('home') && 
       item.Category.toLowerCase().includes('kitchen')
     );
   }
   
   // Determine which columns to use based on category
   const baseColumns = isHomeKitchen 
     ? ['Category', 'Department']  // For Home & Kitchen: Category and Department
     : ['Category', 'Gender', 'Age Group'];  // For Clothing: Category, Gender, Age Group
  
   console.log('🔧 Building filters for columns:', baseColumns, isHomeKitchen ? '(Home & Kitchen)' : '(Clothing)');
  
   const newFilterOptions = {};
  
   baseColumns.forEach(column => {
     const uniqueValues = [...new Set(data.map(item => item[column]).filter(Boolean))].sort();
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
   
   // Increment counter to trigger re-population if metadata exists
   setFiltersRebuiltCounter(prev => prev + 1);
 };


 // Update subcategory options when base filters change (Category + Department for Home & Kitchen, or Category + Gender + Age Group for Clothing)
 useEffect(() => {
   if (products.length === 0) return;
  
   const { Category, Gender, 'Age Group': AgeGroup, Department } = filters;
   
   // Check if this is Home & Kitchen category
   const isHomeKitchen = Category && 
     Category.toLowerCase().includes('home') && 
     Category.toLowerCase().includes('kitchen');
  
   let allBaseFiltersSelected = false;
   let filteredByBase = [];
   
   if (isHomeKitchen) {
     // For Home & Kitchen: Check Category and Department
     if (Category && !Category.startsWith('Select ') &&
         Department && !Department.startsWith('Select ')) {
       allBaseFiltersSelected = true;
       
       // Filter products based on Category and Department
       filteredByBase = products.filter(product =>
         product.Category === Category &&
         product.Department === Department
       );
       
       console.log('📊 Updating subcategory options for Home & Kitchen:', {
         Category,
         Department,
         totalProducts: products.length,
         filteredCount: filteredByBase.length,
         sampleProducts: filteredByBase.slice(0, 3).map(p => ({ 
           Category: p.Category, 
           Department: p.Department, 
           Subcategory: p.Subcategory 
         }))
       });
     }
   } else {
     // For Clothing: Check Category, Gender, and Age Group
     if (Category && !Category.startsWith('Select ') &&
         Gender && !Gender.startsWith('Select ') &&
         AgeGroup && !AgeGroup.startsWith('Select ')) {
       allBaseFiltersSelected = true;
       
       // Filter products based on Category, Gender, and Age Group
       filteredByBase = products.filter(product =>
         product.Category === Category &&
         product.Gender === Gender &&
         product['Age Group'] === AgeGroup
       );
       
       console.log('📊 Updating subcategory options for Clothing:', {
         Category,
         Gender,
         AgeGroup,
         filteredCount: filteredByBase.length
       });
     }
   }
   
   // If not all base filters are selected, reset subcategory
   if (!allBaseFiltersSelected) {
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
  
   // Get unique subcategories from filtered products
   const uniqueSubcategories = [...new Set(filteredByBase.map(item => item.Subcategory).filter(Boolean))].sort();
  
   console.log('📋 Available subcategories:', uniqueSubcategories);
   console.log('🎯 Looking for subcategory from metadata:', scrapedMetadata.subcategory);
  
   // Update subcategory options
   setFilterOptions(prev => ({
     ...prev,
     'Subcategory': ['Select Subcategory', ...uniqueSubcategories]
   }));
  
   // If we have scraped metadata with subcategory and it matches, auto-populate it
   if (scrapedMetadata.subcategory &&
       scrapedMetadata.subcategory !== 'unknown' &&
       uniqueSubcategories.includes(scrapedMetadata.subcategory)) {
     setFilters(prev => ({
       ...prev,
       'Subcategory': scrapedMetadata.subcategory
     }));
     console.log(`✅ Auto-populated Subcategory from metadata: ${scrapedMetadata.subcategory}`);
   } else {
     // Try case-insensitive match
     const caseInsensitiveMatch = uniqueSubcategories.find(sub =>
       sub.toLowerCase().trim() === scrapedMetadata.subcategory?.toLowerCase().trim()
     );
     
     if (caseInsensitiveMatch) {
       setFilters(prev => ({
         ...prev,
         'Subcategory': caseInsensitiveMatch
       }));
       console.log(`✅ Auto-populated Subcategory (case-insensitive): ${caseInsensitiveMatch}`);
     } else {
       // Reset subcategory filter value
       setFilters(prev => ({
         ...prev,
         'Subcategory': 'Select Subcategory'
       }));
       console.log(`⚠️ Subcategory "${scrapedMetadata.subcategory}" not found in available options:`, uniqueSubcategories);
     }
   }
  
 }, [filters.Category, filters.Department, filters.Gender, filters['Age Group'], products, scrapedMetadata.subcategory]);


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
   console.log('=== DEBUG BEFORE LOAD URL ===');
   console.log('Filters:', filters);
   console.log('Filtered products count:', filteredProducts.length);
   console.log('All filters selected?', areAllFiltersSelected());
  
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
   setSuccess('');


   try {
     // Determine which sheet to fetch based on current category
     const isHomeKitchen = filters.Category && 
       filters.Category.toLowerCase().includes('home') && 
       filters.Category.toLowerCase().includes('kitchen');
     
     // Re-fetch appropriate sheet data to get the latest URLs
     console.log(`🔄 Re-fetching ${isHomeKitchen ? 'Home & Kitchen' : 'Clothing (golden)'} sheet data to get latest URLs...`);
     
     let sheetData;
     if (isHomeKitchen) {
       const response = await fetch(`${NODE_API_BASE_URL}/api/home-kitchen-sheet-data`);
       sheetData = await response.json();
     } else {
       sheetData = await fetchGoldenSheetData();
     }
     
     console.log('✅ Fresh sheet data loaded:', {
       category: isHomeKitchen ? 'Home & Kitchen' : 'Clothing',
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
     }


     // Create a product object combining scraped data with sheet data
     const goldStandard = {
       // Basic Info
       id: scrapedProduct.asin || 'N/A',
       asin: scrapedProduct.asin || 'N/A',
       title: scrapedProduct.title || `${selectedProduct.Category} - ${selectedProduct.Subcategory}`,
       brand: scrapedProduct.brand,
       amazonUrl: productUrl,
       url: productUrl, // Add url field for consistency
      
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
      
       // NEW: Product Overview section (comes after images, before Product Information)
       productOverviewArray: scrapedProduct.productOverviewArray || [],
      
       // NEW: Product Information with subsections (Technical Details, Additional Information, etc.)
       productInformationArrays: scrapedProduct.productInformationArrays || {},
      
       // NEW: More Product Details (from detailBulletsWithExceptions)
       moreProductDetailsArray: scrapedProduct.moreProductDetailsArray || [],
      
       // Category-specific fields (Home & Kitchen)
       technicalDetails: scrapedProduct.technicalDetails || null,
       whatsInBox: scrapedProduct.whatsInBox || 'Not specified',
       safetyInfo: scrapedProduct.safetyInfo || 'Not specified',
      
       // Detailed sections (keeping for backward compatibility)
       productDetails: scrapedProduct.productDetails,
       productDetailsArray: scrapedProduct.productDetailsArray || [],
      
       manufacturingDetails: scrapedProduct.manufacturingDetails,
       manufacturingDetailsArray: scrapedProduct.manufacturingDetailsArray || [],
      
       additionalInfo: scrapedProduct.additionalInfo,
       additionalInfoArray: scrapedProduct.additionalInfoArray || [],
      
       productDetailsListArray: scrapedProduct.productDetailsListArray || [],
      
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
     console.log('💾 [DEBUG] Storing goldStandardProduct with NEW fields:', {
       asin: goldStandard.asin,
       title: goldStandard.title?.substring(0, 50),
       images: goldStandard.images?.length || 0,
       productOverviewArray: goldStandard.productOverviewArray?.length || 0,
       productInformationArrays: Object.keys(goldStandard.productInformationArrays || {}).length,
       technicalDetails: goldStandard.technicalDetails ? Object.keys(goldStandard.technicalDetails).length : 0,
       additionalInfoArray: goldStandard.additionalInfoArray?.length || 0,
       whatsInBox: goldStandard.whatsInBox,
       safetyInfo: goldStandard.safetyInfo
     });
     
     // ⚠️ CRITICAL: Clear ALL old product data when loading NEW Gold Standard
     // This ensures we start fresh with new ASIN and no old images persist
     localStorage.removeItem('goldStandardProduct');
     localStorage.removeItem('existingProduct');
     localStorage.removeItem('generatedImages'); // Clear AI-generated images cache
     localStorage.removeItem('selectedImages'); // Clear selection state
     console.log('🗑️ Cleared ALL old product data from localStorage (fresh Gold Standard load)');
     
     // Add timestamp to force React to recognize this as new data
     goldStandard.loadedAt = new Date().toISOString();
     goldStandard.version = Date.now(); // Cache-busting version
     
     localStorage.setItem('goldStandardProduct', JSON.stringify(goldStandard));
     console.log('💾 Stored NEW gold standard product in localStorage with version:', goldStandard.version);


     // Show success message
     setSuccess('Product loaded successfully from Golden Sheet!');


   } catch (err) {
     console.error('❌ Error loading product:', err);
    
     const detailedError = `Failed to load product: ${err.message}.
                           Filters: ${JSON.stringify(filters)}.
                           Filtered products count: ${filteredProducts.length}`;
     setError(detailedError);
    
     if (filteredProducts.length > 0) {
       const selectedProduct = filteredProducts[0];
       const productUrl = selectedProduct.URL || selectedProduct.url;
      
       const basicProduct = {
         id: 'N/A',
         asin: 'N/A',
         title: `${selectedProduct.Category} - ${selectedProduct.Subcategory}`,
         brand: null,
         amazonUrl: productUrl || '#',
         url: productUrl || '#',
         category: selectedProduct.Category,
         gender: selectedProduct.Gender,
         ageGroup: selectedProduct['Age Group'],
         subcategory: selectedProduct.Subcategory,
         images: [],
         features: [],
         description: null,
         // NEW: Product Overview and Product Information fields
         productOverviewArray: [],
         productInformationArrays: {},
         moreProductDetailsArray: [],
         technicalDetails: null,
         whatsInBox: 'Not specified',
         safetyInfo: 'Not specified',
         // Legacy fields
         productDetails: null,
         productDetailsArray: [],
         manufacturingDetails: null,
         manufacturingDetailsArray: [],
         additionalInfo: null,
         additionalInfoArray: [],
         productDetailsListArray: [],
         scrapedData: null
       };
      
       console.log('📦 Using basic product layout (scraping failed):', basicProduct);
       setLoadedProduct(basicProduct);


       const selectedFilters = {};
       filterColumns.forEach(column => {
         const filterValue = filters[column];
         if (filterValue && !filterValue.startsWith('Select ')) {
           selectedFilters[column] = filterValue;
         }
       });
       localStorage.setItem('productFilters', JSON.stringify(selectedFilters));
       console.log('💾 Stored filters in localStorage:', selectedFilters);

       // Clear old ASIN data before storing new Gold Standard (basic product fallback)
       localStorage.removeItem('goldStandardProduct');
       localStorage.removeItem('existingProduct');
       console.log('🗑️ Cleared old product data from localStorage (basic product)');

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
         <h1 className="text-2xl font-bold text-gray-900 text-center">Comparison Setup Page</h1>
         <p className="text-gray-600 mt-1">
           {/* Filtered: <span className="font-medium">{filteredProducts.length}</span> */}
           {isLoading && <span className="ml-2 text-blue-600">Loading...</span>}
         </p>
       </div>


       {/* ASIN Selection Section */}
       <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
         <h3 className="text-sm font-semibold text-gray-700 mb-3">Selected Claimed Listings from Previous Step</h3>
        
         <div className="space-y-4">
           {/* ASIN Dropdown */}
           <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Select a ASIN to View Its Metadata
             </label>
            
             <div className="flex gap-3">
               <div className="relative flex-1">
                 <button
                   type="button"
                   className="w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                   onClick={() => setAsinDropdownOpen(!asinDropdownOpen)}
                   disabled={isLoadingAsins || asinList.length === 0}
                 >
                   <span className={`${selectedAsin ? 'text-gray-900' : 'text-gray-500'} truncate`}>
                     {selectedAsin
                       ? `ASIN: ${selectedAsin}${asinCompletionStatus[selectedAsin]?.isCompleted ? ' (Completed ✓)' : ''}`
                       : isLoadingAsins
                         ? 'Loading your claimed listings...'
                         : asinList.length > 0
                           ? `Select from ${asinList.length} claimed listing(s)`
                           : 'No claimed listings found'
                     }
                   </span>
                   <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${asinDropdownOpen ? 'transform rotate-180' : ''}`} />
                 </button>


                 {/* UPDATED ASIN DROPDOWN MENU */}
                 {asinDropdownOpen && asinList.length > 0 && (
                   <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-72 overflow-y-auto">
                     <div className="py-1">
                       <div className="px-3 py-3 bg-gray-50 border-b sticky top-0">
                         <input
                           type="text"
                           placeholder="Search ASIN..."
                           value={asinSearchQuery}
                           onChange={(e) => setAsinSearchQuery(e.target.value)}
                           className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                           onClick={(e) => e.stopPropagation()}
                         />
                         <div className="text-xs text-gray-500 mt-2">
                           Showing {asinList.filter(a => a.asin.toLowerCase().includes(asinSearchQuery.toLowerCase())).length} of {asinList.length} listings
                         </div>
                       </div>
                       {asinList.filter(a => a.asin.toLowerCase().includes(asinSearchQuery.toLowerCase())).map((asinData, index) => {
                         const isCompleted = asinData.isCompleted || false;
                         const canEdit = asinData.canEdit || false;
                        
                         return (
                           <button
                             key={index}
                             type="button"
                             className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-gray-100 last:border-b-0 ${
                               !canEdit ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''
                             }`}
                             onClick={() => canEdit && handleAsinSelect(asinData.asin)}
                             disabled={!canEdit}
                             title={isCompleted ? `Completed on ${asinData.endTime || 'unknown date'}` : canEdit ? 'Click to select' : 'Already completed'}
                           >
                             <div className="font-mono">{asinData.asin}</div>
                             <div className="text-xs text-gray-500 mt-0.5 flex justify-between">
                               <span>Selected listing {index + 1} of {asinList.length}</span>
                               {isCompleted ? (
                                 <span className="text-red-500 font-medium">✓ Completed</span>
                               ) : canEdit ? (
                                 <span className="text-green-500 font-medium">✓ Available</span>
                               ) : (
                                 <span className="text-gray-400">Unavailable</span>
                               )}
                             </div>
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}
               </div>
              
               <button
                 onClick={() => fetchAsinMetadata(selectedAsin)}
                 disabled={!selectedAsin || isScrapingMetadata || (asinCompletionStatus[selectedAsin]?.isCompleted)}
                 className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium whitespace-nowrap"
               >
                 {isScrapingMetadata ? (
                   <>
                     <Loader2 className="h-4 w-4 animate-spin" />
                     <span>Loading...</span>
                   </>
                 ) : (
                   <>
                     <Download className="h-4 w-4" />
                     <span>Load Metadata</span>
                   </>
                 )}
               </button>
             </div>
            
             {/* Status Messages */}
             <div className="mt-2 space-y-1">
               {asinList.length > 0 && !selectedAsin && (
                 <p className="text-xs text-amber-600 flex items-center">
                   <AlertCircle className="h-3 w-3 mr-1" />
                   Select an available ASIN and click "Load Metadata" to auto-populate filters
                 </p>
               )}
              
               {selectedAsin && !metadataFetched && (
                 <p className="text-xs text-blue-600 flex items-center">
                   <AlertCircle className="h-3 w-3 mr-1" />
                   Click "Load Metadata" to fetch and auto-populate filter values
                 </p>
               )}
              
               {selectedAsin && asinCompletionStatus[selectedAsin]?.isCompleted && (
                 <p className="text-xs text-red-600 flex items-center">
                   <AlertCircle className="h-3 w-3 mr-1" />
                   This ASIN has been completed and cannot be edited
                 </p>
               )}
              
               {asinList.length > 0 && (
                 <p className="text-xs text-green-600 flex items-center">
                   <Check className="h-3 w-3 mr-1" />
                   Showing {asinList.length} claimed listing{asinList.length !== 1 ? 's' : ''}
                   {asinList.filter(a => a.canEdit).length > 0 &&
                     ` (${asinList.filter(a => a.canEdit).length} available for editing)`
                   }
                 </p>
               )}
             </div>
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
              
               <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                 {/* Check if this is Home & Kitchen category */}
                 {(() => {
                   const isHomeKitchen = scrapedMetadata.category && 
                     scrapedMetadata.category.toLowerCase().includes('home') && 
                     scrapedMetadata.category.toLowerCase().includes('kitchen');
                   
                   return (
                     <>
                       {/* Always show Category */}
                       {scrapedMetadata.category && scrapedMetadata.category !== 'unknown' && (
                         <div className={`bg-white p-2 rounded border text-xs ${filters.Category === scrapedMetadata.category ? 'border-green-500 border-2' : ''}`}>
                           <p className="text-gray-500">Category</p>
                           <div className="flex items-center justify-between">
                             <p className="font-medium truncate">{scrapedMetadata.category}</p>
                             {filters.Category === scrapedMetadata.category && (
                               <Check className="h-3 w-3 text-green-500 flex-shrink-0 ml-1" />
                             )}
                           </div>
                         </div>
                       )}
                       
                       {/* Show Department for Home & Kitchen */}
                       {isHomeKitchen && scrapedMetadata.department && scrapedMetadata.department !== 'unknown' && (
                         <div className={`bg-white p-2 rounded border text-xs ${filters.Department === scrapedMetadata.department ? 'border-green-500 border-2' : ''}`}>
                           <p className="text-gray-500">Department</p>
                           <div className="flex items-center justify-between">
                             <p className="font-medium truncate">{scrapedMetadata.department}</p>
                             {filters.Department === scrapedMetadata.department && (
                               <Check className="h-3 w-3 text-green-500 flex-shrink-0 ml-1" />
                             )}
                           </div>
                         </div>
                       )}
                       
                       {/* Show Gender only for non-Home & Kitchen categories */}
                       {!isHomeKitchen && scrapedMetadata.gender && scrapedMetadata.gender !== 'unknown' && (
                         <div className={`bg-white p-2 rounded border text-xs ${filters.Gender === scrapedMetadata.gender ? 'border-green-500 border-2' : ''}`}>
                           <p className="text-gray-500">Gender</p>
                           <div className="flex items-center justify-between">
                             <p className="font-medium truncate">{scrapedMetadata.gender}</p>
                             {filters.Gender === scrapedMetadata.gender && (
                               <Check className="h-3 w-3 text-green-500 flex-shrink-0 ml-1" />
                             )}
                           </div>
                         </div>
                       )}
                       
                       {/* Show Age Group only for non-Home & Kitchen categories */}
                       {!isHomeKitchen && scrapedMetadata.ageGroup && scrapedMetadata.ageGroup !== 'unknown' && (
                         <div className={`bg-white p-2 rounded border text-xs ${filters['Age Group'] === scrapedMetadata.ageGroup ? 'border-green-500 border-2' : ''}`}>
                           <p className="text-gray-500">Age Group</p>
                           <div className="flex items-center justify-between">
                             <p className="font-medium truncate">{scrapedMetadata.ageGroup}</p>
                             {filters['Age Group'] === scrapedMetadata.ageGroup && (
                               <Check className="h-3 w-3 text-green-500 flex-shrink-0 ml-1" />
                             )}
                           </div>
                         </div>
                       )}
                       
                       {/* Always show Subcategory */}
                       {scrapedMetadata.subcategory && scrapedMetadata.subcategory !== 'unknown' && (
                         <div className={`bg-white p-2 rounded border text-xs ${filters.Subcategory === scrapedMetadata.subcategory ? 'border-green-500 border-2' : ''}`}>
                           <p className="text-gray-500">Subcategory</p>
                           <div className="flex items-center justify-between">
                             <p className="font-medium truncate">{scrapedMetadata.subcategory}</p>
                             {filters.Subcategory === scrapedMetadata.subcategory && (
                               <Check className="h-3 w-3 text-green-500 flex-shrink-0 ml-1" />
                             )}
                           </div>
                         </div>
                       )}
                     </>
                   );
                 })()}
               </div>
              
               <div className="mt-2 text-xs text-blue-600">
                 <p>✓ Metadata loaded. Filter fields have been auto-populated where matches were found.</p>
                 <p className="mt-1 text-gray-600">
                   Green borders indicate successfully auto-populated fields. You can still manually adjust filters if needed.
                 </p>
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
             // Map scraped metadata to the appropriate column
             let scrapedValue = '';
             if (column === 'Category') scrapedValue = scrapedMetadata.category;
             else if (column === 'Department') scrapedValue = scrapedMetadata.department;
             else if (column === 'Gender') scrapedValue = scrapedMetadata.gender;
             else if (column === 'Age Group') scrapedValue = scrapedMetadata.ageGroup;
             else if (column === 'Subcategory') scrapedValue = scrapedMetadata.subcategory;
            
             const hasScrapedValue = scrapedValue && scrapedValue !== 'unknown' && scrapedValue.trim() !== '';
             const isAutoPopulated = hasScrapedValue && filters[column] === scrapedValue;
             
             // Check if this is Home & Kitchen category
             const isHomeKitchen = filters.Category && 
               filters.Category.toLowerCase().includes('home') && 
               filters.Category.toLowerCase().includes('kitchen');
             
             // Determine if subcategory should be disabled based on category type
             let isSubcategoryDisabled = false;
             if (column === 'Subcategory') {
               if (isHomeKitchen) {
                 // For Home & Kitchen: Requires Category and Department
                 isSubcategoryDisabled = 
                   filters.Category?.startsWith('Select ') ||
                   filters.Department?.startsWith('Select ');
               } else {
                 // For Clothing: Requires Category, Gender, and Age Group
                 isSubcategoryDisabled = 
                   filters.Category?.startsWith('Select ') ||
                   filters.Gender?.startsWith('Select ') ||
                   filters['Age Group']?.startsWith('Select ');
               }
             }
            
             return (
               <div key={column} className="relative">
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   {column}
                   {isAutoPopulated && (
                     <span className="ml-1 text-xs text-green-600">
                       (Auto-populated from ASIN)
                     </span>
                   )}
                   {hasScrapedValue && !isAutoPopulated && (
                     <span className="ml-1 text-xs text-amber-600">
                       (ASIN has: {scrapedValue})
                     </span>
                   )}
                 </label>
                 <div className="relative">
                   <select
                     className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer text-sm bg-white ${
                       isAutoPopulated ? 'border-green-500 border-2' : 'border-gray-300'
                     }`}
                     value={filters[column] || `Select ${column}`}
                     onChange={(e) => handleFilterChange(column, e.target.value)}
                     disabled={isSubcategoryDisabled}
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
                     {(() => {
                       if (isHomeKitchen) {
                         // For Home & Kitchen
                         if (!filters.Category?.startsWith('Select ') && 
                             !filters.Department?.startsWith('Select ')) {
                           return <span>✓ Select from available options</span>;
                         }
                         return <span>⚠ Select Category and Department first</span>;
                       } else {
                         // For Clothing
                         if (!filters.Category?.startsWith('Select ') &&
                             !filters.Gender?.startsWith('Select ') &&
                             !filters['Age Group']?.startsWith('Select ')) {
                           return <span>✓ Select from available options</span>;
                         }
                         return <span>⚠ Select Category, Gender, and Age Group first</span>;
                       }
                     })()}
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


       {/* Load URL Button and Messages */}
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


           {/* Error Message Display */}
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


           {/* Success Message Display */}
           {success && (
             <div className="flex flex-col space-y-2 text-green-600 bg-green-50 p-3 rounded-md">
               <div className="flex items-center space-x-2">
                 <Check className="h-4 w-4 flex-shrink-0" />
                 <span className="text-sm font-medium">Success</span>
               </div>
               <div className="text-xs text-green-700 pl-6">
                 {success}
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
                   disabled={!loadedProduct || actionType !== 'edit' || (selectedAsin && asinCompletionStatus[selectedAsin]?.isCompleted)}
                   className={`flex items-center space-x-2 px-6 py-2 rounded-md transition-colors font-medium ${
                     loadedProduct && actionType === 'edit' && !(selectedAsin && asinCompletionStatus[selectedAsin]?.isCompleted)
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


