/**
 * Utility functions for NewProductCreationPage attribute management
 */

/**
 * Normalizes a label into a camelCase-like key for internal state
 * @param {string} label 
 * @returns {string}
 */
export const normalizeLabelToKey = (label) => {
  if (!label) return '';
  return label
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Converts a technical key back to a readable label
 * @param {string} key 
 * @returns {string}
 */
export const formatKeyToLabel = (key) => {
  if (!key) return '';
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lower and upper
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Calculates form completion progress
 */
export const calculateListingProgress = (data) => {
  const {
    productSkuId,
    productTitle,
    productDescription,
    keywords,
    productAttributes,
    productFeatures,
    featureValues
  } = data;

  let totalFields = 0;
  let filledFields = 0;

  // 1. SKU-ID field
  totalFields += 1;
  if (productSkuId?.trim()) filledFields += 1;

  // 2. Title field
  totalFields += 1;
  if (productTitle?.trim()) filledFields += 1;

  // 3. Description field
  totalFields += 1;
  if (productDescription?.trim()) filledFields += 1;

  // 4. Keywords field
  totalFields += 1;
  if (keywords?.trim()) filledFields += 1;

  // 5. Attributes
  Object.values(productAttributes || {}).forEach(value => {
    totalFields += 1;
    if (value && value.trim() !== '') {
      filledFields += 1;
    }
  });

  // 6. Features
  (productFeatures || []).forEach(feature => {
    totalFields += 1;
    const value = featureValues ? featureValues[feature.id] : '';
    if (value && value.trim() !== '') {
      filledFields += 1;
    }
  });

  return { filled: filledFields, total: totalFields };
};

/**
 * Auto-extracts attributes from a semicolon-separated keyword string
 */
export const extractAttributesFromKeywords = (keywords, currentAttributes) => {
  if (!keywords?.trim()) return currentAttributes;

  const keywordArray = keywords.split(';').map(k => k.trim().toLowerCase());
  
  const patterns = {
    material: ['cotton', 'polyester', 'silk', 'wool', 'linen', 'denim', 'leather', 'nylon', 'spandex', 'rayon', 'viscose', 'modal'],
    color: ['black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'grey', 'gray', 'navy', 'maroon', 'beige', 'cream'],
    style: ['casual', 'formal', 'bohemian', 'vintage', 'modern', 'traditional', 'ethnic', 'western', 'sporty', 'elegant', 'classic'],
    pattern: ['solid', 'striped', 'floral', 'printed', 'checkered', 'polka dot', 'geometric', 'abstract', 'plain', 'patterned'],
    fit: ['slim', 'regular', 'loose', 'fitted', 'relaxed', 'tailored', 'oversized', 'tight', 'comfortable']
  };

  const updatedAttributes = { ...currentAttributes };
  let extractedCount = 0;

  keywordArray.forEach(keyword => {
    Object.entries(patterns).forEach(([attribute, values]) => {
      values.forEach(value => {
        if (keyword.includes(value) && (!updatedAttributes[attribute] || updatedAttributes[attribute].trim() === '')) {
          updatedAttributes[attribute] = value.charAt(0).toUpperCase() + value.slice(1);
          extractedCount++;
        }
      });
    });
  });

  return extractedCount > 0 ? updatedAttributes : currentAttributes;
};
