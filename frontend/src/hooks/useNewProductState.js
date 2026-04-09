import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeLabelToKey, calculateListingProgress } from '../utils/attributeUtils';
import { api } from '../api/apiService';

export const useNewProductState = () => {
  const navigate = useNavigate();
  const [goldenProduct, setGoldenProduct] = useState(null);
  const [productSkuId, setProductSkuId] = useState('');
  const [acceptedSkuId, setAcceptedSkuId] = useState('');
  const [isEditingSkuId, setIsEditingSkuId] = useState(false);
  const [isGeneratingSkuId, setIsGeneratingSkuId] = useState(false);

  const [productTitle, setProductTitle] = useState('');
  const [acceptedTitle, setAcceptedTitle] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const [productDescription, setProductDescription] = useState('');
  const [acceptedDescription, setAcceptedDescription] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  const [productFeatures, setProductFeatures] = useState([]);
  const [featureValues, setFeatureValues] = useState({});
  const [newFeature, setNewFeature] = useState('');

  // Initialization
  useEffect(() => {
    const stored = localStorage.getItem('goldStandardProduct');
    if (stored) {
      const parsed = JSON.parse(stored);
      setGoldenProduct(parsed);
      
      // Init features
      const features = parsed.features || [];
      setProductFeatures(features.map((f, i) => ({ id: i, text: f, accepted: false })));
      
      const initialFeatureValues = {};
      features.forEach((_, i) => { initialFeatureValues[i] = ''; });
      setFeatureValues(initialFeatureValues);
    }
  }, []);

  const handleAIGenerateSku = async (attributes) => {
    setIsGeneratingSkuId(true);
    try {
      const data = await api.ai.generateSku({
        title: acceptedTitle || '',
        subcategory: goldenProduct?.category || 'Clothing',
        category: 'Clothing',
        attributes
      });
      if (data.success) {
        setProductSkuId(data.sku);
        setIsEditingSkuId(true);
      }
    } catch (error) {
      console.error('SKU Gen failed', error);
    } finally {
      setIsGeneratingSkuId(false);
    }
  };

  const handleAIGenerateTitle = async (attributes) => {
    setIsGeneratingTitle(true);
    try {
      const title = await api.ai.generateProductTitle('Product', attributes);
      setProductTitle(title);
      setIsEditingTitle(true);
    } catch (error) {
      console.error('Title Gen failed', error);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleAIGenerateDescription = async (attributes) => {
    setIsGeneratingDescription(true);
    try {
      const desc = await api.ai.generateProductDescription('Product', attributes);
      setProductDescription(desc);
      setIsEditingDescription(true);
    } catch (error) {
      console.error('Desc Gen failed', error);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSaveDraft = (keywords, attributes) => {
    const newProductData = {
      id: 'NEW-' + Date.now(),
      asin: 'NEW-' + Date.now(),
      title: acceptedTitle,
      features: productFeatures.map(f => featureValues[f.id] || '').filter(v => v.trim() !== ''),
      description: acceptedDescription,
      keywords,
      skuId: acceptedSkuId,
      productDetailsArray: Object.entries(attributes).map(([key, value]) => ({ label: key, key, value })),
      isNewProduct: true,
      loadedAt: new Date().toISOString(),
      version: Date.now()
    };
    
    localStorage.removeItem('existingProduct');
    localStorage.removeItem('generatedImages');
    localStorage.removeItem('selectedImages');
    localStorage.setItem('existingProduct', JSON.stringify(newProductData));
    navigate('/compare-images', { state: { isNewProduct: true } });
  };

  return {
    goldenProduct,
    productSkuId, setProductSkuId, acceptedSkuId, setAcceptedSkuId, isEditingSkuId, setIsEditingSkuId, isGeneratingSkuId,
    productTitle, setProductTitle, acceptedTitle, setAcceptedTitle, isEditingTitle, setIsEditingTitle, isGeneratingTitle,
    productDescription, setProductDescription, acceptedDescription, setAcceptedDescription, isEditingDescription, setIsEditingDescription, isGeneratingDescription,
    productFeatures, setProductFeatures, featureValues, setFeatureValues, newFeature, setNewFeature,
    handleAIGenerateSku, handleAIGenerateTitle, handleAIGenerateDescription,
    handleSaveDraft
  };
};
