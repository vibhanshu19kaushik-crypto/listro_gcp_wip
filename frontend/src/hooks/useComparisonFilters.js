import { useState, useEffect, useCallback } from 'react';
import { 
  isClothingCategory, isElectronicsCategory, isBeautyCategory, 
  isHealthPersonalCareCategory, isGroceryCategory 
} from '../utils/categoryUtils';

export const useComparisonFilters = (products) => {
  const [filterColumns, setFilterColumns] = useState([]);
  const [filterOptions, setFilterOptions] = useState({});
  const [filters, setFilters] = useState({});
  const [filtersRebuiltCounter, setFiltersRebuiltCounter] = useState(0);

  const buildDynamicFilters = useCallback((data, categoryContext = null) => {
    if (!data || data.length === 0) return;

    const cat = categoryContext || filters.Category;
    const isClothing = isClothingCategory(cat);
    const isElectronics = isElectronicsCategory(cat);
    const isBeauty = isBeautyCategory(cat);
    const isHealth = isHealthPersonalCareCategory(cat);
    const isGrocery = isGroceryCategory(cat);

    const newOptions = {};
    const categories = [...new Set(data.map(item => item.Category).filter(Boolean))].sort();
    newOptions['Category'] = ['Select Category', ...categories];

    let additional = [];
    if (isClothing) {
      additional = ['Gender', 'Age Group'];
    } else {
      additional = ['Department'];
    }

    additional.forEach(col => {
      const values = [...new Set(data.map(item => item[col]).filter(Boolean))].sort();
      newOptions[col] = [`Select ${col}`, ...values];
    });

    newOptions['Subcategory'] = ['Select Subcategory'];

    const columns = ['Category', ...additional, 'Subcategory'];
    setFilterColumns(columns);
    setFilterOptions(newOptions);

    const newFilters = {};
    columns.forEach(col => {
      const current = filters[col];
      const fuzzy = (newOptions[col] || []).find(opt => opt?.toLowerCase().trim() === current?.toLowerCase().trim());
      
      if (current && !current.startsWith('Select ') && (fuzzy || col === 'Subcategory')) {
        newFilters[col] = fuzzy || current;
      } else {
        newFilters[col] = `Select ${col}`;
      }
    });

    setFilters(newFilters);
    setFiltersRebuiltCounter(prev => prev + 1);
  }, [filters]);

  const populateFromMetadata = useCallback((metadata) => {
    const cat = metadata.category || '';
    const isClothing = isClothingCategory(cat);
    
    const mapping = {
      'Category': metadata.category,
      'Subcategory': metadata.subcategory,
      'Gender': isClothing ? metadata.gender : null,
      'Age Group': isClothing ? metadata.ageGroup : null,
      'Department': !isClothing ? (metadata.department || null) : null
    };

    const updatedFilters = { ...filters };
    let count = 0;

    Object.entries(mapping).forEach(([field, value]) => {
      if (value && value !== 'unknown' && value.trim() !== '') {
        const options = filterOptions[field] || [];
        const match = options.find(opt => opt.toLowerCase().trim() === value.toLowerCase().trim() && !opt.startsWith('Select '));
        if (match) {
          updatedFilters[field] = match;
          count++;
        }
      }
    });

    setFilters(updatedFilters);
    return count;
  }, [filters, filterOptions]);

  // Handle Subcategory logic
  useEffect(() => {
    const { Category, Gender, 'Age Group': AgeGroup, Department } = filters;
    if (!Category || Category.startsWith('Select ')) return;

    const catLower = Category.toLowerCase();
    const isClothing = isClothingCategory(catLower);

    const filtered = products.filter(p => {
      const pCat = (p.Category || '').toLowerCase().trim();
      const fCat = Category.toLowerCase().trim();
      if (isClothing) {
        return pCat === fCat && 
               (p.Gender || '').toLowerCase().trim() === (Gender || '').toLowerCase().trim() &&
               (p['Age Group'] || '').toLowerCase().trim() === (AgeGroup || '').toLowerCase().trim();
      } else {
        return pCat === fCat && 
               (p.Department || '').toLowerCase().trim() === (Department || '').toLowerCase().trim();
      }
    });

    const subcategories = [...new Set(filtered.map(p => p.Subcategory).filter(Boolean))].sort();
    setFilterOptions(prev => ({
      ...prev,
      'Subcategory': ['Select Subcategory', ...subcategories]
    }));
  }, [filters.Category, filters.Department, filters.Gender, filters['Age Group'], products]);

  return {
    filterColumns, filterOptions, filters, setFilters,
    filtersRebuiltCounter,
    buildDynamicFilters,
    populateFromMetadata
  };
};
