import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Star, ExternalLink, ChevronDown, Check, Edit2, Plus, Loader2, 
  Wand2, Eye, Hash, Info, X, AlertCircle
} from 'lucide-react';

// --- Extracted Utilities & Hooks ---
import { getAlignedAttributesFromData } from '../utils/attributeAligner';
import { useProductComparatorState } from '../hooks/useProductComparatorState';
import { useProductScraper } from '../hooks/useProductScraper';
import { useAutoSave } from '../hooks/useAutoSave';

// --- API Config ---
import { PYTHON_API_BASE_URL } from '../api/config';

const ProductComparatorPage = () => {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [goldenProduct, setGoldenProduct] = useState(null);
  const [scrapedData, setScrapedData] = useState(null);

  const titleTextareaRef = useRef(null);
  const descTextareaRef = useRef(null);

  // 1. Data Scraping Hook
  const {
    productUrl, setProductUrl,
    isLoadingUrl,
    handleLoadUrl
  } = useProductScraper((data) => {
    setScrapedData(data);
  });

  // 2. Main State Management Hook
  const state = useProductComparatorState(scrapedData);
  const {
    productTitle, setProductTitle, acceptedTitle, setAcceptedTitle, isEditingTitle, setIsEditingTitle, isGeneratingTitle, 
    originalTitle,
    productDescription, setProductDescription, acceptedDescription, setAcceptedDescription, isEditingDescription, setIsEditingDescription, isGeneratingDescription,
    originalDescription,
    productFeatures, setProductFeatures, featureValues, setFeatureValues, editingFeatures, setEditingFeatures,
    productAttributes, setProductAttributes, attributeValues, setAttributeValues, editingAttributes, setEditingAttributes,
    productSkuId, setProductSkuId, acceptedSkuId, setAcceptedSkuId, isEditingSkuId, setIsEditingSkuId, isGeneratingSkuId,
    hasUnsavedChanges, setHasUnsavedChanges,
    
    // Handlers
    handleAcceptTitle, handleCancelTitle,
    handleFeatureChange, handleAcceptFeature, handleEditFeature, handleDeleteFeature,
    handleAttributeChange, handleAcceptAttribute, handleEditAttribute,
    handleAcceptSkuId, handleAcceptAll,
    handleAIGenerateTitle, handleAIGenerateDescription, handleAIGenerateSkuId
  } = state;

  // 3. Auto-save Hook
  const { lastSavedTime } = useAutoSave(scrapedData, state, hasUnsavedChanges, setHasUnsavedChanges);

  // --- Initialization ---
  useEffect(() => {
    const storedGolden = localStorage.getItem('goldStandardProduct');
    if (storedGolden) {
      setGoldenProduct(JSON.parse(storedGolden));
    }
  }, []);

  useEffect(() => {
    if (goldenProduct && scrapedData) {
      const aligned = getAlignedAttributesFromData(goldenProduct, scrapedData);
      setProductAttributes(aligned);
      
      if (!productTitle) setProductTitle(scrapedData.title || '');
      if (!productDescription) setProductDescription(scrapedData.description || '');
      
      const features = (scrapedData.features || []).map((f, i) => ({
        id: i,
        text: f,
        accepted: false
      }));
      setProductFeatures(features);
    }
  }, [goldenProduct, scrapedData]);

  // Adjust textarea heights
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

  const handleProceed = () => {
    if (productAttributes.every(a => a.accepted) && productFeatures.every(f => f.accepted)) {
      // 1. Prepare normalized images (existingImages)
      const normalizedImages = (scrapedData.images || []).filter(img => img && img.startsWith('http'));

      // 2. Build existingProduct object for parity
      const existingProduct = {
        asin: scrapedData.asin || 'N/A',
        title: acceptedTitle || productTitle,
        brand: scrapedData.brand,
        amazonUrl: productUrl,

        // Scraped images
        images: normalizedImages,
        existingImages: normalizedImages,
        mainImage: normalizedImages[0] || null,

        // Features/Bullets
        features: productFeatures.map((feature) => feature.text),

        // Description
        description: acceptedDescription || productDescription,

        // Detailed sections
        productDetails: scrapedData.productDetails,
        productDetailsArray: scrapedData.productDetailsArray || [],
        manufacturingDetails: scrapedData.manufacturingDetails,
        manufacturingDetailsArray: scrapedData.manufacturingDetailsArray || [],
        additionalInfo: scrapedData.additionalInfo,
        additionalInfoArray: scrapedData.additionalInfoArray || [],
        
        // Category specific fields
        category: scrapedData.category,
        technicalDetails: scrapedData.technicalDetails,
        whatsInBox: scrapedData.whatsInBox,
        safetyInfo: scrapedData.safetyInfo,

        // Accepted attributes (crucial for FinalPage)
        acceptedAttributes: productAttributes.map((attr) => ({
          key: attr.key,
          value: attributeValues[attr.id] || attr.scrapedValue || '',
          accepted: attr.accepted,
          isCustom: attr.isExtra || false,
          section: attr.section || 'Custom Attributes',
        })),

        // Metadata
        scrapedData,
        loadedAt: new Date().toISOString(),
        version: Date.now()
      };

      // 3. Update localStorage
      localStorage.removeItem('existingProduct');
      localStorage.removeItem('generatedImages'); 
      localStorage.removeItem('selectedImages'); 
      localStorage.setItem('existingProduct', JSON.stringify(existingProduct));
      
      console.log('✅ Stored optimized existingProduct in localStorage');
      navigate('/compare-images', { state: { isNewProduct: false } });
    } else {
      alert("Please accept all attributes and features before proceeding.");
    }
  };

  const getGoldenDescription = () => {
    if (!goldenProduct) return '';
    return goldenProduct.description ||
      (goldenProduct.features && goldenProduct.features.length > 0 ? goldenProduct.features.join(' • ') : '') ||
      'No description available';
  };

  if (!goldenProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading golden product data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Listing Comparison & Editing</h1>
          <p className="text-sm text-gray-600">Compare against Gold Standard and optimize with AI</p>
          {lastSavedTime && <p className="text-xs text-gray-400 mt-2">Last saved at {lastSavedTime.toLocaleTimeString()}</p>}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Header Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 pb-4 border-b">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              <h2 className="text-lg font-bold text-gray-800">Gold Standard (Amazon)</h2>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">REFERENCE</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="h-5 w-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px]">L</div>
                <h2 className="text-lg font-bold text-gray-800">Your Optimization</h2>
              </div>
              {!scrapedData && (
                 <div className="flex gap-2">
                   <input 
                     className="border rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                     placeholder="Paste Amazon URL..." 
                     value={productUrl}
                     onChange={e => setProductUrl(e.target.value)}
                   />
                   <button 
                     onClick={handleLoadUrl}
                     disabled={isLoadingUrl}
                     className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                   >
                     {isLoadingUrl ? 'Scraping...' : 'Load'}
                   </button>
                 </div>
              )}
            </div>
          </div>

          {!scrapedData ? (
             <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-xl">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600">No Product Loaded</h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto mt-2">Paste an Amazon URL above to begin comparison and AI optimization.</p>
             </div>
          ) : (
            <div className="space-y-12">
              
              {/* Image Comparison Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center border aspect-square lg:aspect-video overflow-hidden">
                  {goldenProduct.images?.[0] ? <img src={goldenProduct.images[0]} alt="Golden" className="max-h-full object-contain" /> : <p className="text-gray-400">No Image</p>}
                </div>
                <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center justify-center border aspect-square lg:aspect-video overflow-hidden">
                  {scrapedData.images?.[0] ? <img src={scrapedData.images[0]} alt="Scraped" className="max-h-full object-contain" /> : <p className="text-gray-400">No Image</p>}
                </div>
              </div>

              {/* SKU-ID Section */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                   <h3 className="font-semibold text-gray-700">Golden SKU-ID</h3>
                   <h3 className="font-semibold text-gray-700">Your SKU-ID</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg font-mono text-sm h-full flex items-center">
                    {goldenProduct.skuId || 'SKU-NONE-REF'}
                  </div>
                  <div className="space-y-3">
                    {isEditingSkuId ? (
                      <div className="space-y-2">
                        <input className="w-full border p-2 rounded font-mono text-sm" value={productSkuId} onChange={e => setProductSkuId(e.target.value)} />
                        <div className="flex gap-2">
                          <button className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" onClick={handleAcceptSkuId}><Check size={14}/> Accept</button>
                          <button className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm" onClick={() => setIsEditingSkuId(false)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-gray-50 p-4 border rounded-lg font-mono text-sm min-h-[50px] flex items-center">{acceptedSkuId || <span className="text-gray-400 italic">None</span>}</div>
                        <div className="flex gap-2">
                          <button className="bg-purple-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" onClick={handleAIGenerateSkuId} disabled={isGeneratingSkuId}>
                            <Hash size={14} className={isGeneratingSkuId ? 'animate-spin' : ''}/> Listro Generate
                          </button>
                          <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" onClick={() => setIsEditingSkuId(true)}><Edit2 size={14}/> Edit</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Title Section */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                   <h3 className="font-semibold text-gray-700">Golden Title</h3>
                   <h3 className="font-semibold text-gray-700">Your Title</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-sm leading-relaxed">{goldenProduct.title}</div>
                  <div className="space-y-3">
                    {isEditingTitle ? (
                      <div className="space-y-2">
                        <textarea ref={titleTextareaRef} className="w-full border p-2 rounded text-sm resize-none" value={productTitle} onChange={e => setProductTitle(e.target.value)} rows={3} />
                        <div className="flex gap-2">
                          <button className="bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" onClick={handleAcceptTitle}><Check size={14}/> Accept</button>
                          <button className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm" onClick={handleCancelTitle}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-gray-50 p-4 border rounded-lg text-sm min-h-[80px] leading-relaxed">{acceptedTitle}</div>
                        <div className="flex gap-2">
                          <button className="bg-white border border-gray-300 px-3 py-1 rounded text-sm flex items-center gap-1" onClick={() => { setProductTitle(originalTitle); setIsEditingTitle(true); }}><Eye size={14}/> View Original</button>
                          <button className="bg-purple-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" onClick={handleAIGenerateTitle} disabled={isGeneratingTitle}>
                            <Wand2 size={14} className={isGeneratingTitle ? 'animate-spin' : ''}/> Listro Generate
                          </button>
                          <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1" onClick={() => setIsEditingTitle(true)}><Edit2 size={14}/> Edit</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Attributes Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-700 border-b pb-2">Product Specifications</h3>
                {productAttributes.map(attr => (
                  <div key={attr.id} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <div className="bg-amber-50 p-3 border border-amber-200 rounded text-sm">
                      <div className="text-[10px] uppercase font-bold text-amber-600 mb-1">{attr.key} {attr.isCategorySpecific && `(${attr.section})`}</div>
                      <div className="font-medium text-gray-800">{attr.goldenValue || <span className="text-gray-400 italic">Not in Golden</span>}</div>
                    </div>
                    <div className="group relative">
                      {editingAttributes[attr.id] ? (
                        <div className="flex gap-2">
                          <input className="flex-1 border rounded px-3 py-1.5 text-sm" value={attributeValues[attr.id] || ''} onChange={e => handleAttributeChange(attr.id, e.target.value)} autoFocus />
                          <button className="bg-green-600 text-white p-1.5 rounded" onClick={() => handleAcceptAttribute(attr.id)}><Check size={16}/></button>
                        </div>
                      ) : (
                        <div className="bg-white border hover:border-blue-400 transition-colors rounded p-3 flex items-center justify-between text-sm">
                          <div>
                            <div className="text-[10px] uppercase font-bold text-blue-600 mb-1">{attr.key}</div>
                            <div className="text-gray-800">{attributeValues[attr.id] || attr.scrapedValue || <span className="text-gray-400 italic">None</span>}</div>
                          </div>
                          <div className="flex gap-1">
                            <button className="p-1 hover:bg-gray-100 rounded text-blue-600" onClick={() => handleEditAttribute(attr.id)}><Edit2 size={14}/></button>
                            {attr.accepted ? <Check size={16} className="text-green-600"/> : <button className="p-1 hover:bg-green-50 rounded text-green-600" onClick={() => handleAcceptAttribute(attr.id)}><Check size={16}/></button>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Features Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-700 border-b pb-2">About This Item</h3>
                {productFeatures.map((f, i) => (
                  <div key={f.id} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg text-sm leading-relaxed min-h-[60px] flex items-center">
                       <span className="text-amber-600 mr-2">•</span> {goldenProduct.features?.[i] || <span className="text-gray-400 italic">No corresponding feature</span>}
                    </div>
                    <div className="bg-white border rounded-lg p-4 relative group">
                      {editingFeatures[f.id] ? (
                        <div className="space-y-2">
                          <input className="w-full border p-2 rounded text-sm" value={featureValues[f.id] || f.text} onChange={e => handleFeatureChange(f.id, e.target.value)} autoFocus />
                          <div className="flex gap-2">
                            <button className="bg-green-600 text-white px-2 py-1 rounded text-xs" onClick={() => handleAcceptFeature(f.id)}>Accept</button>
                            <button className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs" onClick={() => setEditingFeatures(prev => ({...prev, [f.id]: false}))}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 flex gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <p className="text-sm leading-relaxed text-gray-800">{f.text}</p>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditFeature(f.id)}><Edit2 size={14} className="text-blue-600"/></button>
                            <button onClick={() => handleDeleteFeature(f.id)}><X size={14} className="text-red-500"/></button>
                            {f.accepted && <Check size={16} className="text-green-600"/>}
                          </div>
                          {!editingFeatures[f.id] && !f.accepted && (
                            <button className="ml-2 text-green-600" onClick={() => handleAcceptFeature(f.id)}><Check size={16}/></button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button className="w-full lg:w-auto flex items-center justify-center space-x-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm">
                   <Plus size={16} /> <span>Add Feature Block</span>
                </button>
              </div>

              {/* Action Bar */}
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-50">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                  <div className="text-sm flex gap-4 text-gray-600">
                    <div><b>Attributes:</b> {productAttributes.filter(a => a.accepted).length}/{productAttributes.length}</div>
                    <div><b>Features:</b> {productFeatures.filter(f => f.accepted).length}/{productFeatures.length}</div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={handleAcceptAll} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded underline font-medium">Accept All Drafts</button>
                    <button 
                      onClick={handleProceed}
                      disabled={!productAttributes.every(a => a.accepted) || !productFeatures.every(f => f.accepted)}
                      className={`px-8 py-2 rounded-lg font-bold text-white transition-all ${
                        productAttributes.every(a => a.accepted) && productFeatures.every(f => f.accepted)
                        ? 'bg-green-600 hover:bg-green-700 shadow-md'
                        : 'bg-gray-300 cursor-not-allowed'
                      }`}
                    >
                      Continue to Media Optimization
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductComparatorPage;
