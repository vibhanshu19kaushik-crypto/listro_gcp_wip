import React from 'react';
import { Star, Save } from 'lucide-react';

// --- Custom Hooks ---
import { useNewProductState } from '../hooks/useNewProductState';
import { useKeywordGenerator } from '../hooks/useKeywordGenerator';
import { useAttributeGrid } from '../hooks/useAttributeGrid';

// --- Components ---
import KeywordSection from '../components/NewProduct/KeywordSection';
import AttributeGrid from '../components/NewProduct/AttributeGrid';
import FeatureEditor from '../components/NewProduct/FeatureEditor';
import AIFieldEditor from '../components/NewProduct/AIFieldEditor';

// --- Utilities ---
import { extractAttributesFromKeywords, calculateListingProgress } from '../utils/attributeUtils';

const NewProductCreationPage = () => {
  const state = useNewProductState();
  const {
    goldenProduct,
    productSkuId, setProductSkuId, acceptedSkuId, setAcceptedSkuId, isEditingSkuId, setIsEditingSkuId, isGeneratingSkuId,
    productTitle, setProductTitle, acceptedTitle, setAcceptedTitle, isEditingTitle, setIsEditingTitle, isGeneratingTitle,
    productDescription, setProductDescription, acceptedDescription, setAcceptedDescription, isEditingDescription, setIsEditingDescription, isGeneratingDescription,
    productFeatures, featureValues, newFeature, setNewFeature,
    handleAIGenerateSku, handleAIGenerateTitle, handleAIGenerateDescription,
    handleSaveDraft, setFeatureValues, setProductFeatures
  } = state;

  const attrState = useAttributeGrid();
  const {
    productAttributes, setProductAttributes, usedAttributes, 
    showAddAttribute, setShowAddAttribute,
    newAttributeKey, setNewAttributeKey,
    newAttributeValue, setNewAttributeValue,
    selectedAttributeType, setSelectedAttributeType,
    handleAttributeChange, handleAddAttribute
  } = attrState;

  const kwState = useKeywordGenerator(goldenProduct, (kw) => {
    const updated = extractAttributesFromKeywords(kw, productAttributes);
    if (updated !== productAttributes) setProductAttributes(updated);
  });

  const progress = calculateListingProgress({
    productSkuId, productTitle, productDescription, keywords: kwState.keywords,
    productAttributes, productFeatures, featureValues
  });

  if (!goldenProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create New Listing (Modular)</h1>
          <p className="text-sm text-gray-600">Optimized Architecture</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 pb-4 border-b">
            <div className="flex items-center gap-2"><Star className="h-6 w-6 text-yellow-400 fill-yellow-400" /><h2 className="text-xl font-semibold">Gold Standard</h2></div>
            <h2 className="text-xl font-semibold">Your New Listing</h2>
          </div>

          <KeywordSection {...kwState} goldenProduct={goldenProduct} onGenerate={kwState.generateKeywords} onStartEdit={kwState.startEditing} onSaveEdit={kwState.saveEdit} onCancelEdit={kwState.cancelEdit} />

          <AttributeGrid {...attrState} goldenProduct={goldenProduct} onAttributeChange={handleAttributeChange} onAddAttribute={handleAddAttribute} />

          <FeatureEditor 
            goldenProduct={goldenProduct} 
            productFeatures={productFeatures} 
            featureValues={featureValues} 
            newFeature={newFeature} 
            setNewFeature={setNewFeature}
            onFeatureChange={(id, v) => setFeatureValues(prev => ({ ...prev, [id]: v }))}
            onAddFeature={() => {
              if (newFeature.trim()) {
                const id = productFeatures.length;
                setProductFeatures([...productFeatures, { id, text: newFeature.trim(), accepted: false }]);
                setFeatureValues(prev => ({ ...prev, [id]: '' }));
                setNewFeature('');
              }
            }}
          />

          <AIFieldEditor 
            label="SKU-ID" type="sku" value={productSkuId} acceptedValue={acceptedSkuId} 
            isEditing={isEditingSkuId} isGenerating={isGeneratingSkuId} 
            goldenValue={goldenProduct?.skuId}
            onGenerate={() => handleAIGenerateSku(productAttributes)}
            onAccept={() => { setAcceptedSkuId(productSkuId); setIsEditingSkuId(false); }}
            onCancel={() => { setProductSkuId(acceptedSkuId); setIsEditingSkuId(false); }}
            onEdit={() => setIsEditingSkuId(true)}
            onChange={setProductSkuId}
          />

          <AIFieldEditor 
            label="Product Title" value={productTitle} acceptedValue={acceptedTitle} 
            isEditing={isEditingTitle} isGenerating={isGeneratingTitle} 
            goldenValue={goldenProduct?.title}
            onGenerate={() => handleAIGenerateTitle(productAttributes)}
            onAccept={() => { setAcceptedTitle(productTitle); setIsEditingTitle(false); }}
            onCancel={() => { setProductTitle(acceptedTitle); setIsEditingTitle(false); }}
            onEdit={() => setIsEditingTitle(true)}
            onChange={setProductTitle}
          />

          <AIFieldEditor 
            label="Description" type="textarea" value={productDescription} acceptedValue={acceptedDescription} 
            isEditing={isEditingDescription} isGenerating={isGeneratingDescription} 
            goldenValue={goldenProduct?.description}
            onGenerate={() => handleAIGenerateDescription(productAttributes)}
            onAccept={() => { setAcceptedDescription(productDescription); setIsEditingDescription(false); }}
            onCancel={() => { setProductDescription(acceptedDescription); setIsEditingDescription(false); }}
            onEdit={() => setIsEditingDescription(true)}
            onChange={setProductDescription}
          />
        </div>

        {/* Action Bar */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky bottom-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 font-medium">Progress: {progress.filled} of {progress.total} fields</div>
            <button
              onClick={() => handleSaveDraft(kwState.keywords, productAttributes)}
              className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all font-bold shadow-lg"
            >
              <Save size={18} />
              <span>Proceed to Comparison</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewProductCreationPage;
