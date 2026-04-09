import { useState, useRef, useCallback } from 'react';
import { api } from '../api/apiService';

export const useMetadataScraper = (onMetadataLoaded) => {
  const [isScrapingMetadata, setIsScrapingMetadata] = useState(false);
  const [metadataFetched, setMetadataFetched] = useState(false);
  const [scrapedMetadata, setScrapedMetadata] = useState({
    category: '', gender: '', ageGroup: '', subcategory: '', department: ''
  });
  const metadataRequestRef = useRef(0);

  const fetchAsinMetadata = useCallback(async (asin) => {
    if (!asin) return { error: 'Please select an ASIN first' };
    if (isScrapingMetadata) return;

    const requestId = ++metadataRequestRef.current;
    setIsScrapingMetadata(true);
    setMetadataFetched(false);

    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const { email } = JSON.parse(userData);
        if (email) await api.scraper.updateStartTime(asin, email).catch(e => console.warn('Start_Time update failed', e));
      }

      const retryScrape = async (attempts = 3) => {
        for (let i = 1; i <= attempts; i++) {
          if (metadataRequestRef.current !== requestId) throw new Error('Superseded');
          try {
            return await api.scraper.metadata(asin);
          } catch (e) {
            if (i === attempts) throw e;
            await new Promise(r => setTimeout(r, 600 * Math.pow(2, i - 1) + Math.random() * 300));
          }
        }
      };

      const result = await retryScrape();
      if (metadataRequestRef.current !== requestId) return;

      const newMetadata = {
        category: result.category || '',
        gender: result.gender || '',
        ageGroup: result.age_group || '',
        subcategory: result.subcategory || '',
        department: result.department || ''
      };

      setScrapedMetadata(newMetadata);
      setMetadataFetched(true);
      if (onMetadataLoaded) onMetadataLoaded(newMetadata);
      
      return { success: true, metadata: newMetadata };
    } catch (error) {
      if (error?.message === 'Superseded') return;
      console.error('Metadata fetch failed:', error);
      setMetadataFetched(false);
      return { error: `Failed to load product metadata for ASIN ${asin}` };
    } finally {
      if (metadataRequestRef.current === requestId) setIsScrapingMetadata(false);
    }
  }, [isScrapingMetadata, onMetadataLoaded]);

  return {
    isScrapingMetadata,
    metadataFetched, setMetadataFetched,
    scrapedMetadata, setScrapedMetadata,
    fetchAsinMetadata
  };
};
