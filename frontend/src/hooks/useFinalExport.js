import { useState, useCallback } from 'react';
import { api } from "../api/apiService";
import { buildSheetData } from "../utils/finalPageUtils";

export const useFinalExport = (comparisonData, allImages, userInfo) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [endTimeUpdated, setEndTimeUpdated] = useState(false);
  const [endTimeData, setEndTimeData] = useState(null);

  const handleCombinedSubmit = useCallback(async () => {
    if (!comparisonData) {
      alert('No data available to export');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);
    setShowSuccessDialog(false);
    setEndTimeUpdated(false);

    try {
      const userEmail = userInfo?.email || null;
      const currentAsin = comparisonData.originalAsin;
      const exportDate = new Date().toISOString().split("T")[0];

      // 1. Prepare BigQuery Data
      const productData = {
        Seller_SKU: currentAsin,
        Product_ID: currentAsin,
        ASIN: currentAsin,
        Product_ID_Type: "ASIN",
        Date: exportDate,
        Title: comparisonData.originalTitle,
        Brand: comparisonData.brandComparison.original,
        Category: comparisonData.category,
        Subcategory: comparisonData.subcategory,
        Department: comparisonData.department,
        'Product Description': comparisonData.description,
        price: comparisonData.originalPrice,
        images: allImages.map(img => img.url),
        featureBullets: comparisonData.features || [],
        raw_product_details: {
          productDetails: comparisonData.productDetails || [],
          manufacturingDetails: comparisonData.manufacturingDetails || [],
          acceptedAttributes: comparisonData.acceptedAttributes || []
        }
      };

      // 2. Route by Category (Home & Kitchen Dual-Insert)
      const isHomeKitchen = (comparisonData.category || '').toLowerCase().includes('home') && 
                            (comparisonData.category || '').toLowerCase().includes('kitchen');

      let sheetsSuccess = false;
      let bigQuerySuccess = false;
      let sheetsUrl = null;

      if (isHomeKitchen) {
        const json = await api.export.appendToHkSheet({
          sheetId: '1Q9HYFjXtm2COrR5WIKEJbkZiMi5SaUWOL2gN8mry3x4',
          tabName: 'Data',
          productData: comparisonData,
          imageLinks: allImages.map(img => img.url)
        });
        sheetsSuccess = json.success;
        bigQuerySuccess = json.success; // Dual insert covers both
        sheetsUrl = `https://docs.google.com/spreadsheets/d/${json.sheetId}/edit`;
      } else {
        const { sheetData, formattedDate, currentSellerSKU } = buildSheetData(comparisonData, allImages);
        
        const [sheetRes, bqRes] = await Promise.allSettled([
          api.export.uploadToSheets({
            csvData: sheetData,
            sheetId: '1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc',
            tabName: 'Product_Data',
            duplicateCheck: true,
            duplicateKeys: ['Date', 'Seller_SKU'],
            currentDate: formattedDate,
            currentSellerSKU
          }),
          api.export.bigquery(productData)
        ]);

        if (sheetRes.status === 'fulfilled') {
          const json = sheetRes.value;
          sheetsSuccess = json.success;
          sheetsUrl = json.sheetUrl;
        }
        if (bqRes.status === 'fulfilled') bigQuerySuccess = bqRes.value.success;
      }

      // 3. End Time Update
      if (userEmail && currentAsin && (sheetsSuccess || bigQuerySuccess)) {
        try {
          const res = await api.scraper.updateEndTime(currentAsin, userEmail);
          if (res.success) {
            setEndTimeUpdated(true);
            setEndTimeData(res);
          }
        } catch (e) { console.error('End Time update failed', e); }
      }

      const overallSuccess = sheetsSuccess || bigQuerySuccess;
      setExportSuccess(overallSuccess);

      let message = overallSuccess ? '✅ SUBMISSION COMPLETE!' : '❌ SUBMISSION FAILED!';
      if (overallSuccess) message += `\n- Sheets: ${sheetsSuccess ? 'OK' : 'FAIL'}\n- BigQuery: ${bigQuerySuccess ? 'OK' : 'FAIL'}`;
      alert(message);

      if (overallSuccess) setShowSuccessDialog(true);
      if (sheetsUrl) window.open(sheetsUrl, '_blank');

    } catch (error) {
      alert(`Export Error: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  }, [comparisonData, allImages, userInfo]);

  return {
    isExporting, exportSuccess, showSuccessDialog, setShowSuccessDialog,
    endTimeUpdated, endTimeData, handleCombinedSubmit
  };
};
