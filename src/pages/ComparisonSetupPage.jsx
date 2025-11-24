import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GoldStandardPanel from '../components/GoldStandardPanel';
import { fetchGoldenSheetData, scrapeProductFromUrl } from '../api/api';
import { Edit3, Plus, ChevronDown, Link, Loader2, AlertCircle } from 'lucide-react';
import { useFormState } from '../context/FormStateContext';

const ComparisonSetupPage = () => {
  const navigate = useNavigate();
  const { sellerId } = useParams();
  const { formData, updateFormData } = useFormState();
  const [isLoading, setIsLoading] = useState(false);
  const [loadedProduct, setLoadedProduct] = useState(formData.loadedProduct || null);
  const [error, setError] = useState('');
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [filterColumns, setFilterColumns] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [filters, setFilters] = useState(formData.filters || {});

  // Update global state when local state changes
  useEffect(() => {
    updateFormData({
      loadedProduct,
      filters
    });
  }, [loadedProduct, filters, updateFormData]);

  // Update sellerId in localStorage when component mounts
  useEffect(() => {
    if (sellerId) {
      localStorage.setItem('sellerId', sellerId);
      window.dispatchEvent(new CustomEvent('sellerIdUpdated', { detail: sellerId }));
    }
  }, [sellerId]);

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
        
        const allProducts = sheetData.data;
        
        console.log('📊 Total products loaded:', allProducts.length);
        setProducts(allProducts);
        setFilteredProducts(allProducts);
        
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
  const buildDynamicFilters = (data, headers) => {
    if (!data || data.length === 0) return;
    
    const columnsToFilter = headers ? headers.filter(h => h !== 'URL') : ['Category', 'Gender', 'Age Group', 'Subcategory'];
    
    console.log('Building filters for columns:', columnsToFilter);
    
    const newFilterOptions = {};
    const initialFilters = { ...filters }; // Start with existing filters
    
    columnsToFilter.forEach(column => {
      const uniqueValues = [...new Set(data.map(item => item[column]).filter(Boolean))].sort();
      
      newFilterOptions[column] = [`Select ${column}`, ...uniqueValues];
      
      // Only set initial filter if not already set
      if (!initialFilters[column]) {
        initialFilters[column] = `Select ${column}`;
      }
    });
    
    console.log('Filter options:', newFilterOptions);
    
    setFilterColumns(columnsToFilter);
    setFilterOptions(newFilterOptions);
    setFilters(initialFilters);
  };

  // Apply filters whenever filter state changes
  useEffect(() => {
    if (products.length === 0) return;
    
    let filtered = [...products];
    
    console.log('Applying filters:', filters);
    
    filterColumns.forEach(column => {
      const filterValue = filters[column];
      if (filterValue && !filterValue.startsWith('Select ')) {
        filtered = filtered.filter(product => product[column] === filterValue);
      }
    });
    
    console.log('Filtered products count:', filtered.length);
    setFilteredProducts(filtered);
  }, [filters, products, filterColumns]);

  const areAllFiltersSelected = () => {
    return filterColumns.every(column => {
      const filterValue = filters[column];
      return filterValue && !filterValue.startsWith('Select ');
    });
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleLoadUrl = async () => {
    setIsLoading(true);
    setError('');

    try {
      console.log('🔄 Re-fetching golden sheet data to get latest URLs...');
      const sheetData = await fetchGoldenSheetData();
      console.log('✅ Fresh golden sheet data loaded:', {
        totalRows: sheetData.totalRows,
        fromCache: sheetData.fromCache,
        headers: sheetData.headers
      });

      const freshProducts = sheetData.data;
      setProducts(freshProducts);

      let freshFilteredProducts = [...freshProducts];
      filterColumns.forEach(column => {
        const filterValue = filters[column];
        if (filterValue && !filterValue.startsWith('Select ')) {
          freshFilteredProducts = freshFilteredProducts.filter(product => product[column] === filterValue);
        }
      });

      console.log('📊 Fresh filtered products count:', freshFilteredProducts.length);
      setFilteredProducts(freshFilteredProducts);

      if (freshFilteredProducts.length === 0) {
        setError('No products match the selected filters. Please adjust your filters.');
        setIsLoading(false);
        return;
      }

      const selectedProduct = freshFilteredProducts[0];
      const productUrl = selectedProduct.URL || selectedProduct.url;
      
      if (!productUrl) {
        setError('No URL found for the selected product.');
        setIsLoading(false);
        return;
      }

      console.log('=== LOAD URL CLICKED ===');
      console.log('Selected Product from Sheet:', selectedProduct);
      console.log('Product URL:', productUrl);
      console.log('Total Filtered Products:', freshFilteredProducts.length);
      console.log('Applied Filters:', filters);
      console.log('========================');

      let scrapedProduct = {};
      
      try {
        console.log('🔄 Starting web scraping for URL:', productUrl);
        scrapedProduct = await scrapeProductFromUrl(productUrl);
        console.log('✅ Scraped product data received:', scrapedProduct);
      } catch (scrapeErr) {
        console.warn('⚠️ Scraping failed, using basic product data:', scrapeErr.message);
      }

      const goldStandard = {
        id: scrapedProduct.asin || 'N/A',
        asin: scrapedProduct.asin || 'N/A',
        title: scrapedProduct.title || `${selectedProduct.Category} - ${selectedProduct.Subcategory}`,
        brand: scrapedProduct.brand,
        amazonUrl: productUrl,
        category: selectedProduct.Category,
        gender: selectedProduct.Gender,
        ageGroup: selectedProduct['Age Group'],
        subcategory: selectedProduct.Subcategory,
        images: scrapedProduct.images || [],
        features: scrapedProduct.features || [],
        description: scrapedProduct.description,
        productDetails: scrapedProduct.productDetails,
        productDetailsArray: scrapedProduct.productDetailsArray || [],
        manufacturingDetails: scrapedProduct.manufacturingDetails,
        manufacturingDetailsArray: scrapedProduct.manufacturingDetailsArray || [],
        additionalInfo: scrapedProduct.additionalInfo,
        additionalInfoArray: scrapedProduct.additionalInfoArray || [],
        scrapedData: scrapedProduct
      };

      console.log('📦 Final gold standard product:', goldStandard);
      setLoadedProduct(goldStandard);

      const selectedFilters = {};
      filterColumns.forEach(column => {
        const filterValue = filters[column];
        if (filterValue && !filterValue.startsWith('Select ')) {
          selectedFilters[column] = filterValue;
        }
      });
      localStorage.setItem('productFilters', JSON.stringify(selectedFilters));
      console.log('💾 Stored filters in localStorage:', selectedFilters);

      localStorage.setItem('goldStandardProduct', JSON.stringify(goldStandard));
      console.log('💾 Stored gold standard product in localStorage');

    } catch (err) {
      console.error('❌ Error loading product:', err);
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

        const selectedFilters = {};
        filterColumns.forEach(column => {
          const filterValue = filters[column];
          if (filterValue && !filterValue.startsWith('Select ')) {
            selectedFilters[column] = filterValue;
          }
        });
        localStorage.setItem('productFilters', JSON.stringify(selectedFilters));
        console.log('💾 Stored filters in localStorage:', selectedFilters);

        localStorage.setItem('goldStandardProduct', JSON.stringify(basicProduct));
        console.log('💾 Stored basic product data in localStorage');
      } else {
        setError(err.message || 'Failed to load product data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditExisting = () => {
    navigate('/edit-product/B08N5V3T8W');
  };

  const handleCreateNew = () => {
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

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter Listings</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {filterColumns.map((column) => (
              <div key={column} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {column}
                </label>
                <div className="relative">
                  <select
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer text-sm"
                    value={filters[column] || `Select ${column}`}
                    onChange={(e) => handleFilterChange(column, e.target.value)}
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
              </div>
            ))}
          </div>
          {filterColumns.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">Loading filters...</p>
          )}
        </div>

        {/* Load URL Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
          <div className="space-y-4">

            <div className="flex items-center justify-center gap-4">
              <div className="text-sm text-gray-600">
                {!areAllFiltersSelected() ? (
                  <span className="text-amber-600">⚠ Please select all filters</span>
                ) : filteredProducts.length > 0 ? (
                  <span className="text-green-600">✓ {filteredProducts.length} listing(s) available (will re-fetch latest data)</span>
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
                    <span>Load Url</span>
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content - Gold Standard Panel */}
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

            {/* Action Panel */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={handleEditExisting}
                    disabled={!loadedProduct}
                    className={`px-6 py-2 rounded-md transition-colors font-medium flex items-center space-x-2 ${loadedProduct
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                  >
                    <Edit3 className="h-4 w-4" />
                    <span>Edit Existing Listing</span>
                  </button>

                  <button
                    onClick={handleCreateNew}
                    disabled={!loadedProduct}
                    className={`px-6 py-2 rounded-md transition-colors font-medium flex items-center space-x-2 ${loadedProduct
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