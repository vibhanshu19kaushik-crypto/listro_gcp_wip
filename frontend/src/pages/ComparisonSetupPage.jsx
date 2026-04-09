import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Save, Edit3, Plus, Loader2, AlertCircle, Check } from 'lucide-react';

// --- Custom Hooks ---
import { useClaimedAsins } from '../hooks/useClaimedAsins';
import { useSheetData } from '../hooks/useSheetData';
import { useMetadataScraper } from '../hooks/useMetadataScraper';
import { useComparisonFilters } from '../hooks/useComparisonFilters';

// --- Components ---
import AsinSelector from '../components/ComparisonSetup/AsinSelector';
import FilterGrid from '../components/ComparisonSetup/FilterGrid';
import GoldStandardPanel from '../components/GoldStandardPanel';

// --- Utilities & API ---
import { getCategoryLabel } from '../utils/categoryUtils';
import { api } from '../api/apiService';
import { transformScrapedProduct } from '../utils/scraperUtils';

const ComparisonSetupPage = () => {
  const navigate = useNavigate();
  const { sellerId } = useParams();
  const [success, setSuccess] = useState('');
  const [loadedProduct, setLoadedProduct] = useState(null);

  // 1. Initial Logic
  useEffect(() => {
    if (sellerId) {
      localStorage.setItem('sellerId', sellerId);
      window.dispatchEvent(new CustomEvent('sellerIdUpdated', { detail: sellerId }));
    }
  }, [sellerId]);

  // 2. Hooks Setup
  const asinState = useClaimedAsins();
  const sheetState = useSheetData();
  const filterState = useComparisonFilters(sheetState.products);
  const metadataState = useMetadataScraper((newMetadata) => {
    const count = filterState.populateFromMetadata(newMetadata);
    if (count > 0) setSuccess(`Auto-populated ${count} filters from ASIN metadata`);
  });

  // 3. Initial Data Load
  useEffect(() => {
    sheetState.fetchAllSheets().then(({ data }) => {
      filterState.buildDynamicFilters(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Handlers
  const handleLoadUrl = async () => {
    sheetState.setIsLoading(true);
    sheetState.setError('');
    setSuccess('');

    try {
      const cat = filterState.filters.Category;
      const sheetData = await sheetState.fetchSheetByCategory(cat);
      
      const filtered = sheetData.data.filter(p => {
        return filterState.filterColumns.every(col => {
          const fVal = filterState.filters[col];
          if (!fVal || fVal.startsWith('Select ')) return true;
          return (p[col] || '').toString().toLowerCase().trim() === fVal.toString().toLowerCase().trim();
        });
      });

      if (filtered.length === 0) throw new Error('No products match selected filters');

      const selectedProduct = filtered[0];
      const productUrl = selectedProduct.URL || selectedProduct.url;
      if (!productUrl) throw new Error('No URL found');

      let scraped = {};
      try {
        const response = await api.scraper.product(productUrl);
        scraped = transformScrapedProduct(response);
      } catch (e) {
        console.warn('Scraping failed, using basic data', e);
      }

      const goldStandard = {
        asin: scraped.asin || 'N/A',
        title: scraped.title || `${selectedProduct.Category} - ${selectedProduct.Subcategory}`,
        url: productUrl,
        category: selectedProduct.Category,
        subcategory: selectedProduct.Subcategory,
        images: scraped.images || [],
        features: scraped.features || [],
        description: scraped.description || '',
        productOverviewArray: scraped.productOverviewArray || [],
        productInformationArrays: scraped.productInformationArrays || {},
        moreProductDetailsArray: scraped.moreProductDetailsArray || [],
        loadedAt: new Date().toISOString(),
        version: Date.now()
      };

      setLoadedProduct(goldStandard);
      localStorage.setItem('productFilters', JSON.stringify(filterState.filters));
      localStorage.removeItem('goldStandardProduct');
      localStorage.removeItem('existingProduct');
      localStorage.removeItem('generatedImages');
      localStorage.removeItem('selectedImages');
      localStorage.setItem('goldStandardProduct', JSON.stringify(goldStandard));
      setSuccess('Product loaded successfully!');

    } catch (err) {
      sheetState.setError(err.message);
    } finally {
      sheetState.setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeInUp">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Comparison Setup (Modular)</h1>
          {sheetState.isLoading && <div className="text-blue-600 flex items-center justify-center gap-1 mt-1"><Loader2 size={16} className="animate-spin" /> Loading...</div>}
        </div>

        <AsinSelector 
          {...asinState} 
          isScrapingMetadata={metadataState.isScrapingMetadata}
          onAsinSelect={asinState.setSelectedAsin}
          onLoadMetadata={metadataState.fetchAsinMetadata}
        />

        {sheetState.error && <div className="bg-red-50 border border-red-200 p-4 rounded-md mb-6 text-red-700 text-sm flex gap-2"><AlertCircle size={18}/> {sheetState.error}</div>}
        {success && <div className="bg-green-50 border border-green-200 p-4 rounded-md mb-6 text-green-700 text-sm flex gap-2"><Check size={18}/> {success}</div>}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Search & Filter Gold Standard Product</h3>
          <FilterGrid 
            filterColumns={filterState.filterColumns}
            filterOptions={filterState.filterOptions}
            filters={filterState.filters}
            onFilterChange={filterState.handleFilterChange || ((c, v) => filterState.setFilters(prev => ({...prev, [c]: v})))}
          />
          
          <button
            onClick={handleLoadUrl}
            disabled={sheetState.isLoading}
            className="w-full bg-blue-600 text-white rounded-md py-2.5 font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {sheetState.isLoading ? 'Processing...' : 'Load Gold Standard Product'}
          </button>
        </div>

        {loadedProduct && (
          <div className="space-y-6">
             <GoldStandardPanel product={loadedProduct} />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    if (!asinState.selectedAsin) {
                      alert("Please select an ASIN from the dropdown first.");
                      return;
                    }
                    navigate(`/edit-product/${asinState.selectedAsin}`);
                  }}
                  disabled={!asinState.selectedAsin}
                  className={`flex items-center justify-center gap-2 border p-4 rounded-lg font-bold transition-all ${
                    asinState.selectedAsin 
                    ? "bg-white border-blue-600 text-blue-600 hover:bg-blue-50" 
                    : "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <Edit3 size={20}/> Edit Existing Listing
                </button>
                <button 
                  onClick={() => navigate('/new-product')}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white p-4 rounded-lg font-bold hover:bg-blue-700"
                >
                  <Plus size={20}/> Create New Listing
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonSetupPage;
