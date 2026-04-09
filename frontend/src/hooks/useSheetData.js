import { useState, useCallback } from 'react';
import { api } from '../api/apiService';
import { 
  isClothingCategory, isElectronicsCategory, isBeautyCategory, 
  isHealthPersonalCareCategory, isGroceryCategory 
} from '../utils/categoryUtils';

export const useSheetData = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAllSheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const results = await Promise.all([
        api.sheets.getGolden(),
        api.sheets.getHomeKitchen(),
        api.sheets.getElectronics(),
        api.sheets.getBeauty(),
        api.sheets.getHealthPersonalCare(),
        api.sheets.getGrocery()
      ]);
      
      const allHeaders = [...new Set(results.flatMap(r => r.headers || []))];
      const allData = results.flatMap(r => r.data || []);
      
      setProducts(allData);
      return { data: allData, headers: allHeaders };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSheetByCategory = useCallback(async (category) => {
    setIsLoading(true);
    try {
      let sheetData;
      if (isClothingCategory(category)) {
        sheetData = await api.sheets.getGolden();
      } else if (isElectronicsCategory(category)) {
        sheetData = await api.sheets.getElectronics();
      } else if (isBeautyCategory(category)) {
        sheetData = await api.sheets.getBeauty();
      } else if (isHealthPersonalCareCategory(category)) {
        sheetData = await api.sheets.getHealthPersonalCare();
      } else if (isGroceryCategory(category)) {
        sheetData = await api.sheets.getGrocery();
      } else {
        sheetData = await api.sheets.getHomeKitchen();
      }
      
      if (!sheetData.success) throw new Error(sheetData.error || 'Failed to load sheet');
      setProducts(sheetData.data);
      return sheetData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    products, setProducts,
    isLoading, error, setError,
    fetchAllSheets, fetchSheetByCategory
  };
};
