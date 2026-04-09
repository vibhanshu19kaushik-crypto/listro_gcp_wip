import { useState, useCallback } from 'react';
import { api } from '../api/apiService';
import { urlToFile, LOADING_MESSAGES, MAX_REGEN } from '../utils/imageComparisonUtils';

export const useImageGeneration = (productAttributes, setGeneratedImages) => {
  const [totalRegenerations, setTotalRegenerations] = useState(0);
  const [currentMessage, setCurrentMessage] = useState("");

  const handleGenerate = useCallback(async (index, referenceImage, referenceFile) => {
    if (!referenceFile && !referenceImage) {
      alert('Please upload or select a reference image first!');
      return;
    }

    const category = (productAttributes?.Category || productAttributes?.category || '').toLowerCase().trim();
    if (['home & kitchen', 'home and kitchen', 'home kitchen'].includes(category) && index >= 2) {
      alert('🏠 Style coming soon for Home & Kitchen. Please use "Upload Your Own".');
      return;
    }

    // Logic for counting regenerations
    // ... same as monolithic
    
    setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isLoading: true } : img));
    const msgInterval = setInterval(() => {
      setCurrentMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    }, 2000);

    try {
      let file = referenceFile;
      if (!file && referenceImage) {
        file = await urlToFile(referenceImage, `ref-${Date.now()}.jpg`);
      }
      
      const newUrl = await api.ai.generateImage(file, index, productAttributes);
      setGeneratedImages(prev => prev.map((img, i) => i === index ? { url: newUrl, isLoading: false, source: 'generated' } : img));
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
      setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isLoading: false } : img));
    } finally {
      clearInterval(msgInterval);
    }
  }, [productAttributes, setGeneratedImages]);

  return { handleGenerate, totalRegenerations, setTotalRegenerations, currentMessage };
};
