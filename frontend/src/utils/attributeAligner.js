/**
 * Utility to align golden product attributes with scraped data.
 * Extracted from ProductComparatorPage.jsx for modularity.
 * 
 * @param {Object} goldenProduct - The reference product data from localStorage
 * @param {Object} scrapedData - The newly scraped product data
 * @returns {Array} - List of aligned attribute objects
 */
export const getAlignedAttributesFromData = (goldenProduct, scrapedData) => {
  if (!goldenProduct) return [];

  const goldenAttrs = [];
  const scrapedAttrs = [];

  // 1. Extract Golden Attributes
  if (goldenProduct.details) {
    Object.entries(goldenProduct.details).forEach(([key, value]) => {
      goldenAttrs.push({
        key: key.replace(/([A-Z])/g, ' $1').trim(),
        value: value,
        section: 'Product Details'
      });
    });
  } else {
    // Standard structure
    if (goldenProduct.productOverviewArray && Array.isArray(goldenProduct.productOverviewArray)) {
      goldenProduct.productOverviewArray.forEach(item => {
        goldenAttrs.push({
          key: item.label || item.key || 'Attribute',
          value: item.value || 'N/A',
          section: 'Product Overview'
        });
      });
    }

    if (goldenProduct.productInformationArrays && typeof goldenProduct.productInformationArrays === 'object') {
      Object.keys(goldenProduct.productInformationArrays).forEach(subsectionName => {
        const subsectionData = goldenProduct.productInformationArrays[subsectionName];
        if (Array.isArray(subsectionData)) {
          subsectionData.forEach(item => {
            goldenAttrs.push({
              key: item.label || item.key || 'Attribute',
              value: item.value || 'N/A',
              section: subsectionName
            });
          });
        }
      });
    }

    if (goldenProduct.technicalDetails && typeof goldenProduct.technicalDetails === 'object') {
      Object.entries(goldenProduct.technicalDetails).forEach(([key, value]) => {
        if (key !== 'status') {
          goldenAttrs.push({
            key: key,
            value: value || 'N/A',
            section: 'Technical Details'
          });
        }
      });
    }
    
    // Fallbacks and extra info...
    if (goldenProduct.productDetailsArray && Array.isArray(goldenProduct.productDetailsArray)) {
      const hasProductOverview = goldenProduct.productOverviewArray && goldenProduct.productOverviewArray.length > 0;
      if (!hasProductOverview) {
        goldenProduct.productDetailsArray.forEach(item => {
          goldenAttrs.push({
            key: item.label || item.key || 'Attribute',
            value: item.value || 'N/A',
            section: 'Product Information'
          });
        });
      }
    }

    if (goldenProduct.additionalInfoArray && Array.isArray(goldenProduct.additionalInfoArray)) {
      goldenProduct.additionalInfoArray.forEach(item => {
        goldenAttrs.push({
          key: item.label || item.key || 'Attribute',
          value: item.value || 'N/A',
          section: 'Additional Information'
        });
      });
    }

    if (goldenProduct.whatsInBox && goldenProduct.whatsInBox !== 'Not specified') {
      goldenAttrs.push({
        key: "What's in the Box",
        value: goldenProduct.whatsInBox,
        section: 'Package Contents'
      });
    }

    if (goldenProduct.moreProductDetailsArray && Array.isArray(goldenProduct.moreProductDetailsArray)) {
      goldenProduct.moreProductDetailsArray.forEach(item => {
        goldenAttrs.push({
          key: item.label || item.key || 'Attribute',
          value: item.value || 'N/A',
          section: 'More Product Details'
        });
      });
    }
  }

  // 2. Extract Scraped Attributes
  if (scrapedData) {
    if (scrapedData.productOverviewArray && Array.isArray(scrapedData.productOverviewArray)) {
      scrapedData.productOverviewArray.forEach(item => {
        scrapedAttrs.push({
          key: item.label || item.key || 'Attribute',
          value: item.value || 'N/A',
          section: 'Product Overview'
        });
      });
    }

    if (scrapedData.productInformationArrays && typeof scrapedData.productInformationArrays === 'object') {
      Object.keys(scrapedData.productInformationArrays).forEach(subsectionName => {
        const subsectionData = scrapedData.productInformationArrays[subsectionName];
        if (Array.isArray(subsectionData)) {
          subsectionData.forEach(item => {
            scrapedAttrs.push({
              key: item.label || item.key || 'Attribute',
              value: item.value || 'N/A',
              section: subsectionName
            });
          });
        }
      });
    }

    if (scrapedData.technicalDetails && typeof scrapedData.technicalDetails === 'object') {
      Object.entries(scrapedData.technicalDetails).forEach(([key, value]) => {
        if (key !== 'status') {
          scrapedAttrs.push({
            key: key,
            value: value || 'N/A',
            section: 'Technical Details'
          });
        }
      });
    }

    if (scrapedData.additionalInfoArray && Array.isArray(scrapedData.additionalInfoArray)) {
      scrapedData.additionalInfoArray.forEach(item => {
        scrapedAttrs.push({
          key: item.label || item.key || 'Attribute',
          value: item.value || 'N/A',
          section: 'Additional Information'
        });
      });
    }

    if (scrapedData.whatsInBox && scrapedData.whatsInBox !== 'Not specified') {
      scrapedAttrs.push({
        key: "What's in the Box",
        value: scrapedData.whatsInBox,
        section: 'Package Contents'
      });
    }

    if (scrapedData.moreProductDetailsArray && Array.isArray(scrapedData.moreProductDetailsArray)) {
      scrapedData.moreProductDetailsArray.forEach(item => {
        scrapedAttrs.push({
          key: item.label || item.key || 'Attribute',
          value: item.value || 'N/A',
          section: 'More Product Details'
        });
      });
    }

    if (scrapedData.safetyInfo && scrapedData.safetyInfo !== 'Not specified') {
      scrapedAttrs.push({
        key: "Safety Information",
        value: scrapedData.safetyInfo,
        section: 'Safety Information'
      });
    }
  }

  // 3. Align & Match
  const aligned = [];
  const scrapedMap = new Map();
  const goldenMap = new Map();

  const categorySpecificSections = [
    'Product Overview', 'Technical Details', 'Additional Information', 
    'Package Contents', 'More Product Details', 'Safety Information'
  ];

  // Capture dynamic sections
  const dynamicSubsections = new Set();
  [...goldenAttrs, ...scrapedAttrs].forEach(attr => {
    if (attr.section && !categorySpecificSections.includes(attr.section)) {
      dynamicSubsections.add(attr.section);
    }
  });
  dynamicSubsections.forEach(s => {
    if (!categorySpecificSections.includes(s)) {
      categorySpecificSections.push(s);
    }
  });

  const categorySpecificScraped = [];
  const categorySpecificGolden = [];

  scrapedAttrs.forEach(attr => {
    if (categorySpecificSections.includes(attr.section)) {
      categorySpecificScraped.push(attr);
    } else {
      scrapedMap.set(attr.key.toLowerCase(), attr);
    }
  });

  goldenAttrs.forEach(attr => {
    if (categorySpecificSections.includes(attr.section)) {
      categorySpecificGolden.push(attr);
    } else {
      goldenMap.set(attr.key.toLowerCase(), attr);
    }
  });

  // Match core details
  goldenMap.forEach((gAttr, key) => {
    const sAttr = scrapedMap.get(key);
    aligned.push({
      id: aligned.length,
      key: gAttr.key,
      goldenValue: gAttr.value,
      scrapedValue: sAttr ? sAttr.value : '',
      section: gAttr.section,
      isMatched: !!sAttr
    });
    if (sAttr) scrapedMap.delete(key);
  });

  // Add extra scraped ones
  scrapedMap.forEach(attr => {
    aligned.push({
      id: aligned.length,
      key: attr.key,
      goldenValue: '',
      scrapedValue: attr.value,
      section: attr.section,
      isMatched: false,
      isExtra: true
    });
  });

  // Match category specific
  const catScrapedMap = new Map();
  categorySpecificScraped.forEach(a => catScrapedMap.set(`${a.section}:${a.key}`.toLowerCase(), a));

  categorySpecificGolden.forEach(gAttr => {
    const key = `${gAttr.section}:${gAttr.key}`.toLowerCase();
    const sAttr = catScrapedMap.get(key);
    aligned.push({
      id: aligned.length,
      key: gAttr.key,
      goldenValue: gAttr.value,
      scrapedValue: sAttr ? sAttr.value : '',
      section: gAttr.section,
      isMatched: !!sAttr,
      isCategorySpecific: true
    });
    if (sAttr) catScrapedMap.delete(key);
  });

  categorySpecificScraped.forEach(a => {
    const key = `${a.section}:${a.key}`.toLowerCase();
    if (catScrapedMap.has(key)) {
      aligned.push({
        id: aligned.length,
        key: a.key,
        goldenValue: '',
        scrapedValue: a.value,
        section: a.section,
        isMatched: false,
        isExtra: true,
        isCategorySpecific: true
      });
    }
  });

  // Re-assign IDs after sorting
  aligned.forEach((attr, index) => {
    attr.id = index;
  });

  return aligned;
};
