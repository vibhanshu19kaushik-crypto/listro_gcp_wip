import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/apiService';

export const useKeywordGenerator = (goldenProduct, onExtractAttributes) => {
  const [keywords, setKeywords] = useState('');
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [tempKeywords, setTempKeywords] = useState('');
  const [keywordStats, setKeywordStats] = useState({ count: 0, charCount: 0 });

  // Update stats
  useEffect(() => {
    if (keywords) {
      const keywordArray = keywords.split(';').filter(k => k.trim() !== '');
      setKeywordStats({ count: keywordArray.length, charCount: keywords.length });
      
      if (keywordArray.length >= 3 && onExtractAttributes) {
        onExtractAttributes(keywords);
      }
    } else {
      setKeywordStats({ count: 0, charCount: 0 });
    }
  }, [keywords, onExtractAttributes]);

  const generateKeywords = async () => {
    if (!goldenProduct) return;
    setIsGeneratingKeywords(true);
    try {
      const data = await api.ai.generateKeywords({
        title: goldenProduct.title || '',
        category: 'Clothing',
        subcategory: goldenProduct.category || 'Clothing',
        details: goldenProduct.details || {}
      });
      
      if (data.success) {
        let cleaned = data.keywords
          .replace(/Here are \d+ more relevant Amazon keywords:/gi, '')
          .replace(/Additional keywords:/gi, '')
          .replace(/More keywords:/gi, '')
          .replace(/Keywords:/gi, '')
          .replace(/\.$/, '')
          .trim();
          
        if (cleaned.includes(';')) {
          const unique = [...new Set(cleaned.split(';').map(k => k.trim()).filter(k => k.length > 0))].slice(0, 8);
          cleaned = unique.join('; ');
        }
        setKeywords(cleaned);
      }
    } catch (error) {
      console.error('Error generating keywords:', error);
    } finally {
      setIsGeneratingKeywords(false);
    }
  };

  const startEditing = () => {
    setTempKeywords(keywords);
    setIsEditingKeywords(true);
  };

  const saveEdit = () => {
    setKeywords(tempKeywords);
    setIsEditingKeywords(false);
  };

  const cancelEdit = () => setIsEditingKeywords(false);

  return {
    keywords, setKeywords,
    isGeneratingKeywords,
    isEditingKeywords,
    tempKeywords, setTempKeywords,
    keywordStats,
    generateKeywords,
    startEditing,
    saveEdit,
    cancelEdit
  };
};
