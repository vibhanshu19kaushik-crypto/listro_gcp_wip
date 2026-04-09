/**
 * Category validation and typing utilities
 */

export const isClothingCategory = (categoryRaw) => {
  if (!categoryRaw) return false;
  const cat = categoryRaw.toLowerCase();
  return (cat.includes('clothing') || cat.includes('accessories')) && 
         (cat.includes('&') || cat.includes('and'));
};

export const isElectronicsCategory = (categoryRaw) => {
  if (!categoryRaw) return false;
  const cat = categoryRaw.toLowerCase();
  return cat.includes('electronics') || 
         cat.includes('computer') || 
         cat.includes('camera') || 
         cat.includes('mobile');
};

export const isBeautyCategory = (categoryRaw) => {
  if (!categoryRaw) return false;
  const cat = categoryRaw.toLowerCase();
  return cat.includes('beauty');
};

export const isHealthPersonalCareCategory = (categoryRaw) => {
  if (!categoryRaw) return false;
  const cat = categoryRaw.toLowerCase();
  return cat.includes('health') || 
         cat.includes('personal care') || 
         cat.includes('diet') || 
         cat.includes('nutrition');
};

export const isGroceryCategory = (categoryRaw) => {
  if (!categoryRaw) return false;
  const cat = categoryRaw.toLowerCase();
  return cat.includes('grocery') || 
         cat.includes('gourmet') || 
         cat.includes('food');
};

export const getCategoryLabel = (categoryRaw) => {
  if (isClothingCategory(categoryRaw)) return "Clothing";
  if (isElectronicsCategory(categoryRaw)) return "Electronics";
  if (isHealthPersonalCareCategory(categoryRaw)) return "Health & Personal Care";
  if (isBeautyCategory(categoryRaw)) return "Beauty";
  if (isGroceryCategory(categoryRaw)) return "Grocery & Gourmet Foods";
  return "Home & Kitchen / Other";
};

/**
 * Robust supported category check (for legacy compat)
 */
export function isSupportedCategory(categoryRaw) {
  if (!categoryRaw) return false;
  const cat = categoryRaw.toLowerCase().replace(/[^a-z&]/g, ' ');
  if (cat.includes('home') && cat.includes('kitchen')) return true;
  if (cat.includes('clothing')) return true;
  if (cat.includes('accessories')) return true;
  if (cat.match(/clothing\s*(and|&)\s*accessories/)) return true;
  if (cat.includes('electronics') || cat.includes('computer') || cat.includes('mobile') || cat.includes('camera')) return true;
  if (cat.includes('beauty')) return true;
  if (cat.includes('personal care') || cat.includes('health')) return true;
  if (cat.includes('diet') || cat.includes('nutrition')) return true;
  if (cat.includes('grocery') || cat.includes('gourmet') || cat.includes('food')) return true;
  return false;
}
