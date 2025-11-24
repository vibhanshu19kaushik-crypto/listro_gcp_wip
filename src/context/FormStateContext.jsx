import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const FormStateContext = createContext();

export const useFormState = () => {
  const context = useContext(FormStateContext);
  if (!context) {
    throw new Error('useFormState must be used within a FormStateProvider');
  }
  return context;
};

export const FormStateProvider = ({ children }) => {
  const [formData, setFormData] = useState({
    // DataSelectionPage
    selectedSeller: '',
    sellerData: null,
    rawFilteredData: null,
    
    // ComparisonSetupPage
    filters: {},
    loadedProduct: null,
    
    // ProductComparatorPage / NewProductCreationPage
    productTitle: '',
    productDescription: '',
    productFeatures: [],
    productAttributes: [],
    scrapedData: null,
    acceptedTitle: '',
    originalTitle: '',
    acceptedDescription: '', 
    originalDescription: '',
    featureValues: {},
    attributeValues: {},
    
    // ImageComparisonPage
    generatedImages: [],
    selectedImages: [],
    referenceImage: null,
    referenceFile: null
  });

  // Load data from localStorage on component mount
  useEffect(() => {
    const savedData = localStorage.getItem('formState');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setFormData(prev => ({ ...prev, ...parsedData }));
      } catch (error) {
        console.error('Error loading form state from localStorage:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever formData changes
  useEffect(() => {
    localStorage.setItem('formState', JSON.stringify(formData));
  }, [formData]);

  // Use useCallback to memoize the updateFormData function
  const updateFormData = useCallback((newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  }, []);

  const clearFormData = useCallback(() => {
    setFormData({
      selectedSeller: '',
      sellerData: null,
      rawFilteredData: null,
      filters: {},
      loadedProduct: null,
      productTitle: '',
      productDescription: '',
      productFeatures: [],
      productAttributes: [],
      scrapedData: null,
      acceptedTitle: '',
      originalTitle: '',
      acceptedDescription: '',
      originalDescription: '',
      featureValues: {},
      attributeValues: {},
      generatedImages: [],
      selectedImages: [],
      referenceImage: null,
      referenceFile: null
    });
    localStorage.removeItem('formState');
  }, []);

  const value = {
    formData,
    updateFormData,
    clearFormData
  };

  return (
    <FormStateContext.Provider value={value}>
      {children}
    </FormStateContext.Provider>
  );
};