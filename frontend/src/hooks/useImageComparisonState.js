import { useState, useEffect, useMemo, useCallback } from 'react';
import { SELECTION_LIMIT } from '../utils/imageComparisonUtils';

export const useImageComparisonState = (locationState) => {
  const [goldStandardProduct, setGoldStandardProduct] = useState(null);
  const [existingProduct, setExistingProduct] = useState(null);
  const [productAttributes, setProductAttributes] = useState({});
  const [isNewProduct] = useState(locationState?.isNewProduct || false);

  const [generatedImages, setGeneratedImages] = useState(
    Array(20).fill(null).map(() => ({ url: null, isLoading: false, source: null }))
  );

  const [selectedImages, setSelectedImages] = useState(() => {
    const initial = {};
    for (let i = 0; i < 20; i++) initial[i] = { existing: false, generated: false };
    return initial;
  });

  // 1. Initial Data Loading
  const loadStoredData = useCallback(() => {
    // Reset generation state
    setGeneratedImages(Array(20).fill(null).map(() => ({ url: null, isLoading: false, source: null })));
    
    const storedAttributes = localStorage.getItem('productFilters');
    if (storedAttributes) setProductAttributes(JSON.parse(storedAttributes));

    const storedGold = localStorage.getItem('goldStandardProduct');
    if (storedGold) setGoldStandardProduct(JSON.parse(storedGold));

    if (!isNewProduct) {
      const storedExisting = localStorage.getItem('existingProduct');
      if (storedExisting) setExistingProduct(JSON.parse(storedExisting));
    }
  }, [isNewProduct]);

  useEffect(() => { loadStoredData(); }, [loadStoredData]);

  // 2. Selection Logic
  const totalSelectedCount = useMemo(() => {
    return Object.values(selectedImages).reduce((acc, sel) => acc + (sel.existing ? 1 : 0) + (sel.generated ? 1 : 0), 0);
  }, [selectedImages]);

  const handleToggleSelection = (index, type) => {
    const isAdding = !selectedImages[index][type];
    if (isAdding && totalSelectedCount >= SELECTION_LIMIT) {
      alert(`Maximum selection limit reached (${SELECTION_LIMIT} images).`);
      return;
    }
    setSelectedImages(prev => ({
      ...prev,
      [index]: { ...prev[index], [type]: !prev[index][type] }
    }));
  };

  // 3. Derived properties
  const goldImages = goldStandardProduct?.images || [];
  const existingImages = existingProduct?.images || [];
  const maxImageCount = Math.max(goldImages.length, existingImages.length, generatedImages.filter(i => i.url).length, 5);

  return {
    goldStandardProduct, existingProduct, productAttributes, isNewProduct,
    generatedImages, setGeneratedImages,
    selectedImages, handleToggleSelection,
    totalSelectedCount,
    goldImages, existingImages, maxImageCount
  };
};
