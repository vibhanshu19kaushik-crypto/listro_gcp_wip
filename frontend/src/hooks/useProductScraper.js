import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api/apiService';

/**
 * Hook to manage ASIN selection and product scraping.
 * 
 * @param {string} initialUrl - Initial URL to load
 * @param {function} onDataLoaded - Callback when scraping is successful
 */
export const useProductScraper = (onDataLoaded) => {
  const [productUrl, setProductUrl] = useState('');
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [asinList, setAsinList] = useState([]);
  const [selectedAsin, setSelectedAsin] = useState('');
  const [isLoadingAsins, setIsLoadingAsins] = useState(false);
  const [isAsinSelectionFrozen, setIsAsinSelectionFrozen] = useState(false);
  const [asinDropdownOpen, setAsinDropdownOpen] = useState(false);

  const hasAutoLoadedRef = useRef(false);

  const fetchAsinList = useCallback(async () => {
    try {
      setIsLoadingAsins(true);
      const comparisonPageAsin = localStorage.getItem('comparisonPageSelectedAsin');
      
      if (comparisonPageAsin) {
        setSelectedAsin(comparisonPageAsin);
        setProductUrl(`https://www.amazon.in/dp/${comparisonPageAsin}`);
        setAsinList([comparisonPageAsin]);
        return;
      }
      
      const storedSelectedAsins = localStorage.getItem('selectedAsins');
      if (storedSelectedAsins) {
        const parsedAsins = JSON.parse(storedSelectedAsins);
        const uniqueAsins = [...new Set(parsedAsins.map(a => a.trim()))];
        setAsinList(uniqueAsins);
      }
    } catch (error) {
      console.error('Error loading ASINs:', error);
    } finally {
      setIsLoadingAsins(false);
    }
  }, []);

  const handleLoadUrl = useCallback(async (url) => {
    const trimmedUrl = (url || productUrl).trim();
    if (!trimmedUrl) return;

    setIsLoadingUrl(true);
    try {
      const data = await api.scraper.product(trimmedUrl);
      if (onDataLoaded) onDataLoaded(data);
      return data;
    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    } finally {
      setIsLoadingUrl(false);
    }
  }, [productUrl, onDataLoaded]);

  useEffect(() => {
    fetchAsinList();
    const actionType = localStorage.getItem('actionType');
    if (actionType === 'edit') setIsAsinSelectionFrozen(true);
  }, [fetchAsinList]);

  return {
    productUrl, setProductUrl,
    isLoadingUrl,
    asinList, selectedAsin, setSelectedAsin,
    isLoadingAsins, isAsinSelectionFrozen,
    asinDropdownOpen, setAsinDropdownOpen,
    handleLoadUrl, fetchAsinList
  };
};
