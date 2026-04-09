import { useEffect, useState, useCallback } from 'react';

/**
 * Hook to handle auto-saving product data to localStorage.
 * 
 * @param {Object} scrapedData - The latest scraped product data
 * @param {Object} state - Object containing title, description, features, and attributes
 * @param {boolean} hasUnsavedChanges - Flag indicating if there are changes to save
 * @param {function} setHasUnsavedChanges - Setter for the unsaved changes flag
 */
export const useAutoSave = (scrapedData, state, hasUnsavedChanges, setHasUnsavedChanges) => {
  const [lastSavedTime, setLastSavedTime] = useState(null);

  const saveToCacheSilently = useCallback(() => {
    if (!scrapedData) return;

    try {
      const { 
        acceptedTitle, 
        acceptedDescription, 
        productFeatures, 
        productAttributes, 
        attributeValues 
      } = state;

      // Prepare attributes for saving
      const attributesToSave = productAttributes.map(attr => ({
        id: attr.id,
        key: attr.key,
        value: attributeValues[attr.id] || attr.scrapedValue || '',
        accepted: attr.accepted,
        section: attr.section || 'Custom Attributes',
        isCustom: attr.isExtra || false
      }));

      // Save to localStorage
      localStorage.setItem('savedProductAttributes', JSON.stringify(attributesToSave));
      localStorage.setItem('savedProductTitle', acceptedTitle);
      localStorage.setItem('savedProductDescription', acceptedDescription);
      localStorage.setItem('savedProductFeatures', JSON.stringify(productFeatures));

      const now = new Date();
      localStorage.setItem('lastSavedTime', now.toISOString());
      setLastSavedTime(now);
      
      // Reset unsaved changes flag
      setHasUnsavedChanges(false);
      
      console.log('✅ Product data auto-saved to cache');
    } catch (error) {
      console.error('Error auto-saving to cache:', error);
    }
  }, [scrapedData, state, setHasUnsavedChanges]);

  // Set up auto-save on page leave or browser close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (scrapedData && hasUnsavedChanges) {
        saveToCacheSilently();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save when component unmounts
      if (scrapedData && hasUnsavedChanges) {
        saveToCacheSilently();
      }
    };
  }, [scrapedData, hasUnsavedChanges, saveToCacheSilently]);

  // Initialize lastSavedTime from localStorage
  useEffect(() => {
    const savedTime = localStorage.getItem('lastSavedTime');
    if (savedTime) {
      setLastSavedTime(new Date(savedTime));
    }
  }, []);

  return { lastSavedTime, saveToCacheSilently };
};
