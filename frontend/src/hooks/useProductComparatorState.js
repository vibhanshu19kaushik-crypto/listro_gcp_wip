import { useState, useCallback } from 'react';
import { PYTHON_API_BASE_URL } from '../api/config';

/**
 * Hook to manage the complex state of the product comparator.
 * 
 * @param {Object} initialData - Initial scraped data or cached state
 */
export const useProductComparatorState = (scrapedData) => {
  // Title State
  const [productTitle, setProductTitle] = useState('');
  const [acceptedTitle, setAcceptedTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  // Description State
  const [productDescription, setProductDescription] = useState('');
  const [acceptedDescription, setAcceptedDescription] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Features State
  const [productFeatures, setProductFeatures] = useState([]);
  const [featureValues, setFeatureValues] = useState({});
  const [editingFeatures, setEditingFeatures] = useState({});

  // Attributes State
  const [productAttributes, setProductAttributes] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});
  const [editingAttributes, setEditingAttributes] = useState({});

  // SKU State
  const [productSkuId, setProductSkuId] = useState('');
  const [acceptedSkuId, setAcceptedSkuId] = useState('');
  const [isEditingSkuId, setIsEditingSkuId] = useState(false);
  const [isGeneratingSkuId, setIsGeneratingSkuId] = useState(false);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // --- Title Handlers ---
  const handleAcceptTitle = useCallback(() => {
    setAcceptedTitle(productTitle);
    setIsEditingTitle(false);
    setHasUnsavedChanges(true);
  }, [productTitle]);

  const handleCancelTitle = useCallback(() => {
    setProductTitle(acceptedTitle);
    setIsEditingTitle(false);
  }, [acceptedTitle]);

  // --- Feature Handlers ---
  const handleFeatureChange = useCallback((id, value) => {
    setFeatureValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleAcceptFeature = useCallback((id) => {
    const currentFeature = productFeatures.find(f => f.id === id);
    const newValue = featureValues[id] || currentFeature?.text || '';
    setProductFeatures(prev => prev.map(f => f.id === id ? { ...f, accepted: true, text: newValue } : f));
    setEditingFeatures(prev => ({ ...prev, [id]: false }));
    setHasUnsavedChanges(true);
  }, [productFeatures, featureValues]);

  const handleEditFeature = useCallback((id) => {
    setEditingFeatures(prev => ({ ...prev, [id]: true }));
  }, []);

  const handleDeleteFeature = useCallback((id) => {
    setProductFeatures(prev => prev.filter(f => f.id !== id));
    setHasUnsavedChanges(true);
  }, []);

  // --- Attribute Handlers ---
  const handleAttributeChange = useCallback((id, value) => {
    setAttributeValues(prev => ({ ...prev, [id]: value }));
  }, []);

  const handleAcceptAttribute = useCallback((id) => {
    const currentAttr = productAttributes.find(a => a.id === id);
    const newValue = attributeValues[id] || currentAttr?.scrapedValue || '';
    setProductAttributes(prev => prev.map(a => a.id === id ? { ...a, accepted: true, scrapedValue: newValue } : a));
    setEditingAttributes(prev => ({ ...prev, [id]: false }));
    setHasUnsavedChanges(true);
  }, [productAttributes, attributeValues]);

  const handleEditAttribute = useCallback((id) => {
    setEditingAttributes(prev => ({ ...prev, [id]: true }));
  }, []);

  // --- SKU Handlers ---
  const handleAcceptSkuId = useCallback(() => {
    setAcceptedSkuId(productSkuId);
    setIsEditingSkuId(false);
    setHasUnsavedChanges(true);
  }, [productSkuId]);

  // --- Bulk Handlers ---
  const handleAcceptAll = useCallback(() => {
    setAcceptedTitle(productTitle);
    setAcceptedDescription(productDescription);
    setAcceptedSkuId(productSkuId);
    setProductFeatures(prev => prev.map(f => ({ ...f, accepted: true })));
    setProductAttributes(prev => prev.map(a => ({ ...a, accepted: true })));
    setHasUnsavedChanges(true);
  }, [productTitle, productDescription, productSkuId]);

  return {
    // State
    productTitle, setProductTitle, acceptedTitle, setAcceptedTitle, isEditingTitle, setIsEditingTitle, isGeneratingTitle, setIsGeneratingTitle,
    productDescription, setProductDescription, acceptedDescription, setAcceptedDescription, isEditingDescription, setIsEditingDescription, isGeneratingDescription, setIsGeneratingDescription,
    productFeatures, setProductFeatures, featureValues, setFeatureValues, editingFeatures, setEditingFeatures,
    productAttributes, setProductAttributes, attributeValues, setAttributeValues, editingAttributes, setEditingAttributes,
    productSkuId, setProductSkuId, acceptedSkuId, setAcceptedSkuId, isEditingSkuId, setIsEditingSkuId, isGeneratingSkuId, setIsGeneratingSkuId,
    hasUnsavedChanges, setHasUnsavedChanges,

    // Handlers
    handleAcceptTitle, handleCancelTitle,
    handleFeatureChange, handleAcceptFeature, handleEditFeature, handleDeleteFeature,
    handleAttributeChange, handleAcceptAttribute, handleEditAttribute,
    handleAcceptSkuId, handleAcceptAll,
    
    // AI Generation Handlers
    handleAIGenerateTitle: async () => {
      setIsGeneratingTitle(true);
      try {
        const payload = buildAIPayload(scrapedData, productAttributes, attributeValues, "title");
        const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-title-description`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.success) {
          setProductTitle(data.generated_title || "");
          setIsEditingTitle(true);
          setHasUnsavedChanges(true);
        } else {
          throw new Error(data.error || "Generation failed");
        }
      } catch (error) {
        console.error("Error generating title:", error);
        alert("Failed to generate title: " + error.message);
      } finally {
        setIsGeneratingTitle(false);
      }
    },
    
    handleAIGenerateDescription: async () => {
      setIsGeneratingDescription(true);
      try {
        const payload = buildAIPayload(scrapedData, productAttributes, attributeValues, "description");
        const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-title-description`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.success) {
          setProductDescription(data.generated_description || "");
          setIsEditingDescription(true);
          setHasUnsavedChanges(true);
        } else {
          throw new Error(data.error || "Generation failed");
        }
      } catch (error) {
        console.error("Error generating description:", error);
        alert("Failed to generate description: " + error.message);
      } finally {
        setIsGeneratingDescription(false);
      }
    },
    
    handleAIGenerateSkuId: async () => {
      setIsGeneratingSkuId(true);
      try {
        const subcategory = getSubcategoryFromProduct(scrapedData);
        const payload = {
          title: acceptedTitle || productTitle || '',
          subcategory,
          category: 'Clothing',
          page_type: 'gno',
          attributes: Object.fromEntries(
            productAttributes.map(attr => [attr.key, attributeValues[attr.id] || attr.scrapedValue || ''])
          )
        };
        const response = await fetch(`${PYTHON_API_BASE_URL}/api/generate-sku-for-listing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.success) {
          setProductSkuId(data.sku);
          setIsEditingSkuId(true);
          setHasUnsavedChanges(true);
        } else {
          throw new Error(data.error || "SKU generation failed");
        }
      } catch (error) {
        console.error('Error generating SKU-ID:', error);
        // Fallback locally
        const timestamp = Date.now().toString().slice(-6);
        const fallbackSku = `CL${timestamp}${new Date().getFullYear()}`;
        setProductSkuId(fallbackSku);
        setIsEditingSkuId(true);
        alert(`Generated fallback SKU: ${fallbackSku}`);
      } finally {
        setIsGeneratingSkuId(false);
      }
    }
  };
};

// --- Helpers ---
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

function getSubcategoryFromProduct(scrapedData) {
  if (!scrapedData) return 'Clothing';
  if (scrapedData.category) return scrapedData.category;
  if (scrapedData.title) {
    const title = scrapedData.title.toLowerCase();
    if (title.includes('dress')) return 'Dress';
    if (title.includes('shirt')) return 'Shirt';
    if (title.includes('pant')) return 'Pants';
    return 'Clothing';
  }
  return 'Clothing';
}
