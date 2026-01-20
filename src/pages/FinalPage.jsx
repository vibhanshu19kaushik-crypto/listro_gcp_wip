import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { ChevronLeft, ChevronRight, X, Home, RefreshCw } from 'lucide-react';
import { insertProductToBigQuery, updateEndTimeInSheet } from "../api/api.js";
import { NODE_API_BASE_URL } from "../api/config";

const FinalPage = () => {
  const [comparisonData, setComparisonData] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [allImages, setAllImages] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [endTimeUpdated, setEndTimeUpdated] = useState(false);
  const [endTimeData, setEndTimeData] = useState(null);
  const contentRef = useRef(null);
  const navigate = useNavigate();

  const handleDownload = () => {
    const element = contentRef.current;
    const opt = {
      margin: 1,
      filename: 'product-comparison-report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  // ================================
  // 🗂️ Helper: Build Google Sheets Data
  // ================================
  const buildSheetData = (comparisonData, allImages) => {
    const safeValue = (value) => {
      if (value === null || value === undefined || value === 'N/A' || value === '') return '';
      return String(value).trim();
    };

    const findDetailValue = (labelSearch) => {
      // Check in product details
      if (comparisonData.productDetails) {
        const detail = comparisonData.productDetails.find(d =>
          d.label && d.label.toLowerCase().includes(labelSearch.toLowerCase())
        );
        if (detail && detail.value && detail.value !== 'N/A') return detail.value;
      }
     
      // Check in manufacturing details
      if (comparisonData.manufacturingDetails) {
        const detail = comparisonData.manufacturingDetails.find(d =>
          d.label && d.label.toLowerCase().includes(labelSearch.toLowerCase())
        );
        if (detail && detail.value && detail.value !== 'N/A') return detail.value;
      }
     
      // Check in accepted attributes (custom attributes added in ProductComparatorPage)
      if (comparisonData.acceptedAttributes) {
        const detail = comparisonData.acceptedAttributes.find(d =>
          d.key && d.key.toLowerCase().includes(labelSearch.toLowerCase())
        );
        if (detail && detail.value && detail.value !== 'N/A') return detail.value;
      }
     
      return '';
    };

    const getBulletPoint = (index) => {
      if (comparisonData.features && comparisonData.features[index]) {
        return comparisonData.features[index];
      }
      return '';
    };

    const getSpecialFeature = (index) => {
      if (comparisonData.features && comparisonData.features.length > 5) {
        const featureIndex = 5 + index;
        if (comparisonData.features[featureIndex]) {
          return comparisonData.features[featureIndex];
        }
      }
      return '';
    };

    const getImageURL = (index) => {
      if (allImages && allImages[index]) {
        return allImages[index].url;
      }
      return '';
    };

    // Date for Google Sheets (day/month/year)
    const currentDate = new Date();
    const day = currentDate.getDate();
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    const columnHeaders = [
      'Date', 'Number_of_attributes_with_errors', 'Number_of_attributes_with_other_suggestions', 'Product_Sub_type',
      'Seller_SKU', 'Brand_Name', 'Update_Delete', 'Manufacturer_Part_Number', 'Product_ID', 'Product_ID_Type',
      'Item_Name', 'Product_Description', 'Manufacturer', 'Recommended_Browse_Nodes', 'Closure_Type',
      'Model_Name', 'Model_Number', 'Product_Care_Instructions', 'Your_price', 'Quantity',
      'Apparel_Size_Body_Type', 'Target_Gender', 'Age_Range_Description', 'Apparel_Size_System',
      'Apparel_Size_Class', 'Apparel_Size_Value', 'Apparel_Size_To_Range', 'Main_Image_URL',
      'Other_Image_URL1', 'Other_Image_URL2', 'Other_Image_URL3', 'Other_Image_URL4', 'Other_Image_URL5',
      'Other_Image_URL6', 'Other_Image_URL7', 'Other_Image_URL8', 'Swatch_Image_URL', 'Parentage',
      'Parent_SKU', 'Relationship_Type', 'Variation_Theme', 'Bullet_Point1', 'Bullet_Point2',
      'Bullet_Point3', 'Bullet_Point4', 'Bullet_Point5', 'Generic_Keyword', 'Style',
      'Packer_Contact_Information', 'Special_Features1', 'Special_Features2', 'Special_Features3',
      'Special_Features4', 'Special_Features5', 'Design', 'Item_Type_Name', 'Occasion1', 'Occasion2',
      'Occasion3', 'Occasion4', 'Occasion5', 'Duration_Unit', 'Neck_Style', 'Colour_Map', 'Season',
      'Team_Name', 'Importer_Contact_Information', 'Material_Type', 'Duration', 'Occasion_Lifestyle',
      'Number_Of_Pockets', 'Manufacturer_Contact', 'Fur_Description', 'Fitting_type', 'Collar_Style',
      'Color', 'Embellishment_Feature1', 'Embellishment_Feature2', 'Embellishment_Feature3',
      'Embellishment_Feature4', 'Embellishment_Feature5', 'Weave_Type', 'Back_Style', 'Theme', 'Gender',
      'League_Name', 'Special_Sizes', 'Embroidery_Type', 'Included_Components1', 'Included_Components2',
      'Included_Components3', 'Included_Components4', 'Included_Components5', 'Sleeve_Type', 'Size',
      'Product_Lifecycle_Supply_Type', 'Pattern', 'Maximum_Seller_Allowed_Price',
      'flash_point_unit_of_measure', 'Is_exempt_from_supplier_declared_external_product_identifier',
      'Skip_Offer', 'Minimum_Advertised_Price_Display', 'Minimum_Seller_Allowed_Price', 'Item_Weight',
      'Item_Weight_Unit', 'Item_Width_Unit_Of_Measure', 'Item_Width', 'Item_Height', 'Generic_Size',
      'Chest_Size_Unit', 'Chest_Size', 'Unit_Count', 'Item_Length_Description',
      'Item_Height_Unit_Of_Measure', 'Item_Length_Unit_Of_Measure', 'Item_Length', 'Unit_Count_Type',
      'Item_Length_Longer_Edge', 'Item_Length_Unit', 'Fulfillment_Centre_ID', 'Package_Weight',
      'Package_Weight_Unit_Of_Measure', 'Package_Height', 'Item_Package_height_Unit_of_Measure',
      'Package_Length', 'Package_Length_Unit_Of_Measure', 'package_width',
      'Item_Package_width_Unit_of_Measure', 'Country_of_Origin', 'Are_batteries_required',
      'Dangerous_Goods_Regulations1', 'Dangerous_Goods_Regulations2', 'Dangerous_Goods_Regulations3',
      'Dangerous_Goods_Regulations4', 'Dangerous_Goods_Regulations5', 'Hazmat', 'Safety_Data_Sheet_URL',
      'Compliance_Media_Content_Type1', 'Compliance_Media_Content_Type2', 'Compliance_Media_Content_Type3',
      'Compliance_Media_Content_Type4', 'Compliance_Media_Content_Type5', 'Compliance_Media_Content_Type6',
      'Compliance_Media_Content_Type7', 'Compliance_Media_Content_Type8', 'Compliance_Media_Content_Type9',
      'Compliance_Media_Content_Type10', 'Compliance_Media_Content_Type11', 'Compliance_Media_Content_Type12',
      'Compliance_Media_Content_Type13', 'Compliance_Media_Content_Type14', 'Compliance_Media_Content_Type15',
      'Compliance_Media_Content_Type16', 'Compliance_Media_Content_Type17', 'Fabric_Type', 'Flash_point_C',
      'Specific_Uses_for_Product', 'External_Product_Information', 'Material_Fabric_Regulations1',
      'Material_Fabric_Regulations2', 'Material_Fabric_Regulations3', 'Compliance_Media_Source_Location1',
      'Compliance_Media_Source_Location2', 'Compliance_Media_Source_Location3',
      'Compliance_Media_Source_Location4', 'Compliance_Media_Source_Location5',
      'Compliance_Media_Source_Location6', 'Compliance_Media_Source_Location7',
      'Compliance_Media_Source_Location8', 'Compliance_Media_Source_Location9',
      'Compliance_Media_Source_Location10', 'Compliance_Media_Source_Location11',
      'Compliance_Media_Source_Location12', 'Compliance_Media_Source_Location13',
      'Compliance_Media_Source_Location14', 'Compliance_Media_Source_Location15',
      'Compliance_Media_Source_Location16', 'Compliance_Media_Source_Location17',
      'Compliance_Media_Language1', 'Compliance_Media_Language2', 'Compliance_Media_Language3',
      'Compliance_Media_Language4', 'Compliance_Media_Language5', 'Compliance_Media_Language6',
      'Compliance_Media_Language7', 'Compliance_Media_Language8', 'Compliance_Media_Language9',
      'Compliance_Media_Language10', 'Compliance_Media_Language11', 'Compliance_Media_Language12',
      'Compliance_Media_Language13', 'Compliance_Media_Language14', 'Compliance_Media_Language15',
      'Compliance_Media_Language16', 'Compliance_Media_Language17', 'GHS_Class', 'Condition',
      'Condition_Note', 'Handling_Time', 'Release_Date', 'Restock_Date', 'Product_Tax_Code',
      'Sale_Price', 'Sale_Start_Date', 'Sale_End_Date', 'Max_Order_Quantity', 'Number_of_Items',
      'Can_Be_Gift_Messaged', 'Is_Gift_Wrap_Available', 'Minimum_Advertised_Price', 'List_Price',
      'Currency', 'Offer_End_Date', 'Shipping_Template', 'Offer_Start_Date', 'Maximum_Retail_Price',
      'Business_Price', 'Quantity_Price_Type', 'Quantity_Price_1', 'Quantity_Lower_Bound_1',
      'Quantity_Price_2', 'Quantity_Lower_Bound_2', 'Quantity_Price_3', 'Quantity_Lower_Bound_3',
      'Quantity_Price_4', 'Quantity_Lower_Bound_4', 'Quantity_Price_5', 'Quantity_Lower_Bound_5',
      'Pricing_Action', 'United_Nations_Standard_Products_and_Services_Code', 'National_Stock_Number'
    ];

    // Extract price from accepted attributes first, then fallback to original price
    const priceFromAttributes = findDetailValue('price');
    const productPrice = priceFromAttributes !== '' ? priceFromAttributes : safeValue(comparisonData.originalPrice);

    // Extract brand from accepted attributes first, then fallback to brand comparison
    const brandFromAttributes = findDetailValue('brand') || findDetailValue('brand name');
    const productBrand = brandFromAttributes !== '' ? brandFromAttributes : safeValue(comparisonData.brandComparison?.original);

    const dataRow = [
      formattedDate, // Date
      '', // Number_of_attributes_with_errors (blank instead of 'N/A')
      '', // Number_of_attributes_with_other_suggestions (blank instead of 'N/A')
      safeValue(comparisonData.subcategory), // Product_Sub_type
      safeValue(comparisonData.originalAsin), // Seller_SKU
      productBrand, // Brand_Name (from attributes or comparison)
      'Update', // Update_Delete
      findDetailValue('part number'), // Manufacturer_Part_Number
      safeValue(comparisonData.originalAsin), // Product_ID
      'ASIN', // Product_ID_Type
      safeValue(comparisonData.originalTitle), // Item_Name
      safeValue(comparisonData.description || comparisonData.notes), // Product_Description
      findDetailValue('manufacturer'), // Manufacturer
      '', // Recommended_Browse_Nodes (blank instead of 'N/A')
      findDetailValue('closure'), // Closure_Type
      findDetailValue('model name'), // Model_Name
      findDetailValue('model number'), // Model_Number
      findDetailValue('care instructions'), // Product_Care_Instructions
      productPrice, // Your_price (from attributes or original price)
      '1', // Quantity
      '', // Apparel_Size_Body_Type (blank instead of 'N/A')
      safeValue(findDetailValue('gender') || comparisonData.department), // Target_Gender
      findDetailValue('age range'), // Age_Range_Description
      '', // Apparel_Size_System (blank instead of 'N/A')
      '', // Apparel_Size_Class (blank instead of 'N/A')
      findDetailValue('size'), // Apparel_Size_Value
      '', // Apparel_Size_To_Range (blank instead of 'N/A')
      getImageURL(0), // Main_Image_URL
      getImageURL(1), // Other_Image_URL1
      getImageURL(2), // Other_Image_URL2
      getImageURL(3), // Other_Image_URL3
      getImageURL(4), // Other_Image_URL4
      getImageURL(5), // Other_Image_URL5
      getImageURL(6), // Other_Image_URL6
      getImageURL(7), // Other_Image_URL7
      getImageURL(8), // Other_Image_URL8
      '', // Swatch_Image_URL (blank instead of 'N/A')
      '', // Parentage (blank instead of 'N/A')
      '', // Parent_SKU (blank instead of 'N/A')
      '', // Relationship_Type (blank instead of 'N/A')
      '', // Variation_Theme (blank instead of 'N/A')
      getBulletPoint(0), // Bullet_Point1
      getBulletPoint(1), // Bullet_Point2
      getBulletPoint(2), // Bullet_Point3
      getBulletPoint(3), // Bullet_Point4
      getBulletPoint(4), // Bullet_Point5
      safeValue(comparisonData.category), // Generic_Keyword
      findDetailValue('style'), // Style
      findDetailValue('packer'), // Packer_Contact_Information
      getSpecialFeature(0), // Special_Features1
      getSpecialFeature(1), // Special_Features2
      getSpecialFeature(2), // Special_Features3
      getSpecialFeature(3), // Special_Features4
      getSpecialFeature(4), // Special_Features5
      findDetailValue('design'), // Design
      safeValue(comparisonData.department), // Item_Type_Name
      findDetailValue('occasion'), // Occasion1
      '', // Occasion2 (blank instead of 'N/A')
      '', // Occasion3 (blank instead of 'N/A')
      '', // Occasion4 (blank instead of 'N/A')
      '', // Occasion5 (blank instead of 'N/A')
      '', // Duration_Unit (blank instead of 'N/A')
      findDetailValue('neck'), // Neck_Style
      findDetailValue('color') || findDetailValue('colour'), // Colour_Map
      findDetailValue('season'), // Season
      '', // Team_Name (blank instead of 'N/A')
      findDetailValue('importer'), // Importer_Contact_Information
      findDetailValue('material'), // Material_Type
      '', // Duration (blank instead of 'N/A')
      '', // Occasion_Lifestyle (blank instead of 'N/A')
      findDetailValue('pockets'), // Number_Of_Pockets
      findDetailValue('manufacturer'), // Manufacturer_Contact
      findDetailValue('fur'), // Fur_Description
      findDetailValue('fit'), // Fitting_type
      findDetailValue('collar'), // Collar_Style
      findDetailValue('color') || findDetailValue('colour'), // Color
      '', // Embellishment_Feature1 (blank instead of 'N/A')
      '', // Embellishment_Feature2 (blank instead of 'N/A')
      '', // Embellishment_Feature3 (blank instead of 'N/A')
      '', // Embellishment_Feature4 (blank instead of 'N/A')
      '', // Embellishment_Feature5 (blank instead of 'N/A')
      findDetailValue('weave'), // Weave_Type
      '', // Back_Style (blank instead of 'N/A')
      findDetailValue('theme'), // Theme
      safeValue(findDetailValue('gender') || comparisonData.department), // Gender
      '', // League_Name (blank instead of 'N/A')
      '', // Special_Sizes (blank instead of 'N/A')
      '', // Embroidery_Type (blank instead of 'N/A')
      '', // Included_Components1 (blank instead of 'N/A')
      '', // Included_Components2 (blank instead of 'N/A')
      '', // Included_Components3 (blank instead of 'N/A')
      '', // Included_Components4 (blank instead of 'N/A')
      '', // Included_Components5 (blank instead of 'N/A')
      findDetailValue('sleeve'), // Sleeve_Type
      findDetailValue('size'), // Size
      '', // Product_Lifecycle_Supply_Type (blank instead of 'N/A')
      findDetailValue('pattern'), // Pattern
      '', // Maximum_Seller_Allowed_Price (blank instead of 'N/A')
      '', // flash_point_unit_of_measure (blank instead of 'N/A')
      '', // Is_exempt_from_supplier_declared_external_product_identifier (blank instead of 'N/A')
      '', // Skip_Offer (blank instead of 'N/A')
      '', // Minimum_Advertised_Price_Display (blank instead of 'N/A')
      '', // Minimum_Seller_Allowed_Price (blank instead of 'N/A')
      findDetailValue('weight'), // Item_Weight
      '', // Item_Weight_Unit (blank instead of 'N/A')
      '', // Item_Width_Unit_Of_Measure (blank instead of 'N/A')
      findDetailValue('width'), // Item_Width
      findDetailValue('height'), // Item_Height
      findDetailValue('size'), // Generic_Size
      '', // Chest_Size_Unit (blank instead of 'N/A')
      findDetailValue('chest'), // Chest_Size
      '', // Unit_Count (blank instead of 'N/A')
      findDetailValue('length'), // Item_Length_Description
      '', // Item_Height_Unit_Of_Measure (blank instead of 'N/A')
      '', // Item_Length_Unit_Of_Measure (blank instead of 'N/A')
      findDetailValue('length'), // Item_Length
      '', // Unit_Count_Type (blank instead of 'N/A')
      '', // Item_Length_Longer_Edge (blank instead of 'N/A')
      '', // Item_Length_Unit (blank instead of 'N/A')
      '', // Fulfillment_Centre_ID (blank instead of 'N/A')
      findDetailValue('package weight'), // Package_Weight
      '', // Package_Weight_Unit_Of_Measure (blank instead of 'N/A')
      findDetailValue('package height'), // Package_Height
      '', // Item_Package_height_Unit_of_Measure (blank instead of 'N/A')
      findDetailValue('package length'), // Package_Length
      '', // Package_Length_Unit_Of_Measure (blank instead of 'N/A')
      findDetailValue('package width'), // package_width
      '', // Item_Package_width_Unit_of_Measure (blank instead of 'N/A')
      findDetailValue('country') || findDetailValue('origin'), // Country_of_Origin
      '', // Are_batteries_required (blank instead of 'N/A')
      '', // Dangerous_Goods_Regulations1 (blank instead of 'N/A')
      '', // Dangerous_Goods_Regulations2 (blank instead of 'N/A')
      '', // Dangerous_Goods_Regulations3 (blank instead of 'N/A')
      '', // Dangerous_Goods_Regulations4 (blank instead of 'N/A')
      '', // Dangerous_Goods_Regulations5 (blank instead of 'N/A')
      '', // Hazmat (blank instead of 'N/A')
      '', // Safety_Data_Sheet_URL (blank instead of 'N/A')
      '', '', '', '', '', '', '', '', '', '', // Compliance_Media_Content_Type1-10 (blank instead of 'N/A')
      '', '', '', '', '', '', '', // Compliance_Media_Content_Type11-17 (blank instead of 'N/A')
      findDetailValue('fabric'), // Fabric_Type
      '', // Flash_point_C (blank instead of 'N/A')
      '', // Specific_Uses_for_Product (blank instead of 'N/A')
      '', // External_Product_Information (blank instead of 'N/A')
      '', '', '', // Material_Fabric_Regulations1-3 (blank instead of 'N/A')
      '', '', '', '', '', '', '', '', '', '', // Compliance_Media_Source_Location1-10 (blank instead of 'N/A')
      '', '', '', '', '', '', '', // Compliance_Media_Source_Location11-17 (blank instead of 'N/A')
      '', '', '', '', '', '', '', '', '', '', // Compliance_Media_Language1-10 (blank instead of 'N/A')
      '', '', '', '', '', '', '', // Compliance_Media_Language11-17 (blank instead of 'N/A')
      '', // GHS_Class (blank instead of 'N/A')
      'New', // Condition
      '', // Condition_Note (blank instead of 'N/A')
      '2', // Handling_Time
      '', // Release_Date (blank instead of 'N/A')
      '', // Restock_Date (blank instead of 'N/A')
      '', // Product_Tax_Code (blank instead of 'N/A')
      '', // Sale_Price (blank instead of 'N/A')
      '', // Sale_Start_Date (blank instead of 'N/A')
      '', // Sale_End_Date (blank instead of 'N/A')
      '', // Max_Order_Quantity (blank instead of 'N/A')
      '1', // Number_of_Items
      '', // Can_Be_Gift_Messaged (blank instead of 'N/A')
      '', // Is_Gift_Wrap_Available (blank instead of 'N/A')
      '', // Minimum_Advertised_Price (blank instead of 'N/A')
      productPrice, // List_Price (from attributes or original price)
      'INR', // Currency
      '', // Offer_End_Date (blank instead of 'N/A')
      '', // Shipping_Template (blank instead of 'N/A')
      '', // Offer_Start_Date (blank instead of 'N/A')
      findDetailValue('M.R.P.'), // Maximum_Retail_Price (from attributes or original price)
      '', // Business_Price (blank instead of 'N/A')
      '', // Quantity_Price_Type (blank instead of 'N/A')
      '', '', '', '', '', '', '', '', '', '', // Quantity_Price/Bound 1-5 (blank instead of 'N/A')
      '', // Pricing_Action (blank instead of 'N/A')
      '', // United_Nations_Standard_Products_and_Services_Code (blank instead of 'N/A')
      '' , // National_Stock_Number (blank instead of 'N/A')
    ];

    const sheetData = [columnHeaders, dataRow];

    return {
      sheetData,
      formattedDate,
      currentSellerSKU: safeValue(comparisonData.originalAsin)
    };
  };

  // ================================
  // 🚀 Combined Submit (Sheets + BigQuery + End_Time)
  // ================================
  const handleCombinedSubmit = async () => {
    if (!comparisonData) {
      alert('No data available to export');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);
    setShowSuccessDialog(false);
    setEndTimeUpdated(false);
    setEndTimeData(null);

    try {
      // Get user data
      const userData = localStorage.getItem('user');
      const userEmail = userData ? JSON.parse(userData).email : null;
      const currentAsin = comparisonData.originalAsin;

      console.log('🚀 Starting export process:', {
        asin: currentAsin,
        userEmail,
        hasComparisonData: !!comparisonData
      });

      // Helpers for BigQuery mapping
      const safeValue = (value) => {
        if (value === null || value === undefined || value === 'N/A' || value === '') return 'N/A';
        return String(value);
      };

      const findDetailValue = (labelSearch) => {
        // Check in product details
        if (comparisonData.productDetails) {
          const detail = comparisonData.productDetails.find(d =>
            d.label && d.label.toLowerCase().includes(labelSearch.toLowerCase())
          );
          if (detail && detail.value && detail.value !== 'N/A') return detail.value;
        }
       
        // Check in manufacturing details
        if (comparisonData.manufacturingDetails) {
          const detail = comparisonData.manufacturingDetails.find(d =>
            d.label && d.label.toLowerCase().includes(labelSearch.toLowerCase())
          );
          if (detail && detail.value && detail.value !== 'N/A') return detail.value;
        }
       
        // Check in accepted attributes (custom attributes added in ProductComparatorPage)
        if (comparisonData.acceptedAttributes) {
          const detail = comparisonData.acceptedAttributes.find(d =>
            d.key && d.key.toLowerCase().includes(labelSearch.toLowerCase())
          );
          if (detail && detail.value && detail.value !== 'N/A') return detail.value;
        }
       
        return 'N/A';
      };

      // 📅 Export date for BigQuery (ISO yyyy-mm-dd)
      const exportDate = new Date().toISOString().split("T")[0];

      // Extract price from accepted attributes first, then fallback to original price
      const priceFromAttributes = findDetailValue('price');
      const productPrice = priceFromAttributes !== 'N/A' ? priceFromAttributes : safeValue(comparisonData.originalPrice);

      // Extract brand from accepted attributes first, then fallback to brand comparison
      const brandFromAttributes = findDetailValue('brand') || findDetailValue('brand name');
      const productBrand = brandFromAttributes !== 'N/A' ? brandFromAttributes : safeValue(comparisonData.brandComparison?.original);

      // 🗃️ BigQuery payload with unified IDs
      const productData = {
        // ID unification
        Seller_SKU: safeValue(comparisonData.originalAsin),
        Product_ID: safeValue(comparisonData.originalAsin),
        ASIN: safeValue(comparisonData.originalAsin),
        Product_ID_Type: "ASIN",

        // Date
        Date: exportDate,

        // Core Identification & Naming
        Title: safeValue(comparisonData.originalTitle),
        Brand: productBrand, // Use brand from attributes if available
        'Generic Name': findDetailValue('model name'),

        // Categorization
        Category: safeValue(comparisonData.category),
        Subcategory: safeValue(comparisonData.subcategory),
        Department: safeValue(findDetailValue('gender') || comparisonData.department),

        // Descriptive Content
        'Product Description': safeValue(comparisonData.description || comparisonData.notes),

        // Product Specifications
        'Product Dimensions': findDetailValue('dimensions'),
        'Item model number': findDetailValue('model number'),
        'Net Quantity': '1',

        // Price
        price: productPrice, // Use price from attributes if available

        // Logistics & Dates
        Manufacturer: findDetailValue('manufacturer'),
        'Country of Origin': findDetailValue('country') || findDetailValue('origin'),
        Packer: findDetailValue('packer'),
        'Date First Available': findDetailValue('date first available'),

        // Images & Features
        images: allImages.map(img => img.url),
        featureBullets: comparisonData.features || [],

        // Raw data for debugging
        raw_product_details: {
          productDetails: comparisonData.productDetails || [],
          manufacturingDetails: comparisonData.manufacturingDetails || [],
          acceptedAttributes: comparisonData.acceptedAttributes || [], // Include accepted attributes
          features: comparisonData.features || []
        }
      };

      console.log('📤 Prepared data for BigQuery:', productData);

      // 📊 Build Google Sheets data
      const { sheetData, formattedDate, currentSellerSKU } = buildSheetData(comparisonData, allImages);

      // Call both endpoints (Sheets + BigQuery)
      const [sheetResult, bigQueryResult] = await Promise.allSettled([
        // Google Sheets
        fetch(`${NODE_API_BASE_URL}/api/upload-to-sheets`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            csvData: sheetData,
            sheetId: '1-azsWJHPgwUicaX1bdJUoH-4bFxR-sFmwtmFeeDUXgc',
            tabName: 'Product_Data',
            duplicateCheck: true,
            duplicateKeys: ['Date', 'Seller_SKU'],
            currentDate: formattedDate,
            currentSellerSKU
          })
        }),

        // BigQuery
        insertProductToBigQuery(productData)
      ]);

      // Handle Sheets result
      let sheetsSuccess = false;
      let sheetsDuplicate = false;
      let sheetsUrl = null;

      if (sheetResult.status === 'fulfilled') {
        const response = sheetResult.value;
        const json = await response.json();
        if (json.success) {
          sheetsSuccess = true;
          sheetsDuplicate = !!json.duplicateFound;
          sheetsUrl = json.sheetUrl || null;
          console.log('✅ Data processed in Google Sheets:', json);
        } else {
          console.error('❌ Google Sheets upload failed:', json.error);
        }
      } else {
        console.error('❌ Google Sheets request error:', sheetResult.reason);
      }

      // Handle BigQuery result
      let bigQuerySuccess = false;
      let bigQueryInserted = 0;

      if (bigQueryResult.status === 'fulfilled') {
        const result = bigQueryResult.value;
        if (result.success) {
          bigQuerySuccess = true;
          bigQueryInserted = result.inserted || 0;
          console.log('✅ Successfully exported to BigQuery:', result);
        } else {
          console.error('❌ BigQuery export failed:', result.error);
        }
      } else {
        console.error('❌ BigQuery request error:', bigQueryResult.reason);
      }

      // ✅ STEP 3: UPDATE END_TIME IN SHEET
      let endTimeUpdateResult = null;
      if (userEmail && currentAsin && (sheetsSuccess || bigQuerySuccess)) {
        try {
          console.log('🔄 Updating End_Time for ASIN:', currentAsin);
          endTimeUpdateResult = await updateEndTimeInSheet(currentAsin, userEmail);
          
          if (endTimeUpdateResult.success && endTimeUpdateResult.updated) {
            setEndTimeUpdated(true);
            setEndTimeData(endTimeUpdateResult);
            console.log('✅ End_Time updated successfully:', endTimeUpdateResult);
          } else {
            console.log('⚠️ End_Time not updated:', endTimeUpdateResult?.message);
          }
        } catch (endTimeError) {
          console.error('⚠️ Failed to update End_Time:', endTimeError);
        }
      }

      // Determine if export was successful
      const isSuccessful = sheetsSuccess || bigQuerySuccess;
      setExportSuccess(isSuccessful);

      // Build summary message for initial alert
      let message = isSuccessful ? 'SUBMISSION COMPLETE!\n\n' : 'SUBMISSION FAILED!\n\n';

      if (bigQuerySuccess && sheetsSuccess) {
        message += '✅ Data exported to BigQuery\n✅ Data exported to Google Sheets\n\nBoth platforms updated successfully!';
      } else if (bigQuerySuccess && !sheetsSuccess) {
        message += '✅ Data exported to BigQuery\n❌ Google Sheets export failed\n\nBigQuery was updated successfully.';
      } else if (!bigQuerySuccess && sheetsSuccess) {
        message += '❌ BigQuery export failed\n✅ Data exported to Google Sheets\n\nGoogle Sheets was updated successfully.';
      } else {
        message += '❌ Both exports failed\n\nPlease check your connection and try again.';
        setIsExporting(false);
        alert(message);
        return;
      }

      // Add End_Time info if updated
      if (endTimeUpdated && endTimeData) {
        message += `\n\n⏰ Work completion recorded at: ${endTimeData.endTime}`;
      }

      // Show initial alert with details
      alert(message);

      // Show success dialog for navigation options
      if (isSuccessful) {
        setTimeout(() => {
          setShowSuccessDialog(true);
        }, 500);
      }

      if (sheetsUrl) {
        setTimeout(() => {
          window.open(sheetsUrl, '_blank');
        }, 1000);
      }

      setIsExporting(false);

    } catch (error) {
      console.error('❌ Error in combined submit:', error);
      alert(`Submission Error: ${error.message}\n\nPlease try again or check console for details.`);
      setIsExporting(false);
    }
  };

  // ================================
  // 🚀 Dialog Navigation Functions
  // ================================

  const handleSelectNewSeller = () => {
    console.log('🚀 Navigating to Data Selection Page (New Seller)');
    
    // Clear ALL localStorage data
    localStorage.removeItem('selectedAsins');
    localStorage.removeItem('actionType');
    localStorage.removeItem('comparisonPageSelectedAsin');
    localStorage.removeItem('existingProduct');
    localStorage.removeItem('goldStandardProduct');
    localStorage.removeItem('productFilters');
    localStorage.removeItem('allProductImages');
    localStorage.removeItem('generatedImages');
    localStorage.removeItem('sellerId');
    
    // Close dialog
    setShowSuccessDialog(false);
    
    // Navigate to Data Selection Page (Page 2)
    navigate('/data-selection');
  };

  const handleStartNewAsin = () => {
    console.log('🚀 Navigating to Comparison Setup Page (New ASIN)');
    
    // Keep seller context but clear ASIN-specific data
    const sellerId = localStorage.getItem('sellerId');
    
    // Clear ASIN-specific data
    localStorage.removeItem('selectedAsins');
    localStorage.removeItem('comparisonPageSelectedAsin');
    localStorage.removeItem('existingProduct');
    localStorage.removeItem('goldStandardProduct');
    localStorage.removeItem('productFilters');
    localStorage.removeItem('allProductImages');
    localStorage.removeItem('generatedImages');
    
    // Keep actionType and sellerId for the same seller
    
    // Close dialog
    setShowSuccessDialog(false);
    
    // Navigate back to Comparison Setup (Page 3) for same seller
    if (sellerId) {
      navigate(`/setup/${sellerId}`);
    } else {
      // Fallback to data selection if no sellerId
      navigate('/data-selection');
    }
  };

  const handleCloseDialog = () => {
    setShowSuccessDialog(false);
  };

  // Image slider navigation
  const nextImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }
  };

  const prevImage = () => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    }
  };

  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  // Helper function to extract MRP and calculate discount
  const extractMRPAndDiscount = () => {
    if (!comparisonData) return { mrp: null, discountPercentage: null };
   
    // Try to find MRP in accepted attributes
    let mrp = null;
    let mrpValue = null;
   
    if (comparisonData.acceptedAttributes && Array.isArray(comparisonData.acceptedAttributes)) {
      // Look for MRP in accepted attributes (multiple possible keys)
      const mrpAttribute = comparisonData.acceptedAttributes.find(attr =>
        attr.key && (
          attr.key.toLowerCase().includes('m.r.p.') ||
          attr.key.toLowerCase().includes('mrp') ||
          attr.key.toLowerCase().includes('maximum retail price') ||
          attr.key.toLowerCase().includes('price') && attr.key.toLowerCase().includes('mrp')
        )
      );
     
      if (mrpAttribute && mrpAttribute.value && mrpAttribute.value !== 'N/A') {
        mrp = mrpAttribute.value;
        mrpValue = mrp;
      }
    }
   
    // If not found in accepted attributes, try product details
    if (!mrp && comparisonData.productDetails && Array.isArray(comparisonData.productDetails)) {
      const mrpDetail = comparisonData.productDetails.find(detail =>
        detail.label && (
          detail.label.toLowerCase().includes('m.r.p.') ||
          detail.label.toLowerCase().includes('mrp') ||
          detail.label.toLowerCase().includes('maximum retail price')
        )
      );
     
      if (mrpDetail && mrpDetail.value && mrpDetail.value !== 'N/A') {
        mrp = mrpDetail.value;
        mrpValue = mrp;
      }
    }
   
    // Calculate discount if we have MRP and current price
    let discountPercentage = null;
    if (mrp && comparisonData.originalPrice) {
      try {
        // Extract numeric value from MRP (remove currency symbols, commas, etc.)
        const mrpNum = parseFloat(mrp.replace(/[^0-9.]/g, ''));
        const priceNum = parseFloat(comparisonData.originalPrice);
       
        if (!isNaN(mrpNum) && !isNaN(priceNum) && mrpNum > 0 && priceNum > 0 && mrpNum > priceNum) {
          discountPercentage = Math.round(((mrpNum - priceNum) / mrpNum) * 100);
        }
      } catch (error) {
        console.error('Error calculating discount:', error);
      }
    }
   
    return { mrp: mrpValue, discountPercentage };
  };

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user')) || {
      name: "John Doe",
      email: "john.doe@example.com"
    };
    setUserInfo(user);

    const storedExisting = localStorage.getItem('existingProduct');
    const existingProductData = storedExisting ? JSON.parse(storedExisting) : null;

    // DEBUG: Log the raw data to see duplicates
    console.log('🔍 DEBUG: Raw existingProductData from localStorage:', existingProductData);
   
    if (existingProductData) {
      console.log('🔍 DEBUG: productDetailsArray:', existingProductData.productDetailsArray);
      console.log('🔍 DEBUG: manufacturingDetailsArray:', existingProductData.manufacturingDetailsArray);
      console.log('🔍 DEBUG: acceptedAttributes:', existingProductData.acceptedAttributes);
      console.log('🔍 DEBUG: productDetails (object):', existingProductData.productDetails);
      console.log('🔍 DEBUG: manufacturingDetails (object):', existingProductData.manufacturingDetails);
    }

    const storedAllImages = localStorage.getItem('allProductImages');
    let productImages = [];

    if (storedAllImages) {
      try {
        productImages = JSON.parse(storedAllImages);
        console.log('🖼️ Loaded all product images:', productImages);
      } catch (error) {
        console.error('Error parsing all product images:', error);
      }
    }

    if (productImages.length === 0) {
      const storedGeneratedImages = localStorage.getItem('generatedImages');
      const generatedImages = storedGeneratedImages ? JSON.parse(storedGeneratedImages) : [];

      if (existingProductData?.images && Array.isArray(existingProductData.images)) {
        existingProductData.images.forEach((url, index) => {
          productImages.push({
            url: url,
            type: 'existing',
            label: `Existing Image ${index + 1}`
          });
        });
      }

      if (generatedImages.length > 0) {
        generatedImages.forEach((url, index) => {
          productImages.push({
            url: url,
            type: 'generated',
            label: `Listro Generated ${index + 1}`
          });
        });
      }

      console.log('🖼️ Built combined images from individual sources:', productImages);
    }

    setAllImages(productImages);

    const storedGeneratedImages = localStorage.getItem('generatedImages');
    const generatedImages = storedGeneratedImages ? JSON.parse(storedGeneratedImages) : [];

    const storedGoldStandard = localStorage.getItem('goldStandardProduct');
    const goldStandardData = storedGoldStandard ? JSON.parse(storedGoldStandard) : null;

    const storedFilters = localStorage.getItem('productFilters');
    const productAttributes = storedFilters ? JSON.parse(storedFilters) : {};

    console.log('📦 Loaded existing product:', existingProductData);
    console.log('🎨 Loaded generated images:', generatedImages);
    console.log('⭐ Loaded gold standard:', goldStandardData);
    console.log('🏷️ Loaded attributes:', productAttributes);

    if (existingProductData) {
      const existingFeatures = extractFeatures(existingProductData);
      console.log('✨ Features extracted from EXISTING product:', existingFeatures);

      // Extract accepted attributes from existingProductData
      const acceptedAttributes = existingProductData.acceptedAttributes || [];
     
      // Extract price from accepted attributes first, then fallback to extracted price
      const priceFromAttributes = acceptedAttributes.find(attr =>
        attr.key && (attr.key.toLowerCase().includes('price') && !attr.key.toLowerCase().includes('mrp'))
      );
     
      // Extract MRP from accepted attributes
      const mrpFromAttributes = acceptedAttributes.find(attr =>
        attr.key && (
          attr.key.toLowerCase().includes('m.r.p.') ||
          attr.key.toLowerCase().includes('mrp') ||
          attr.key.toLowerCase().includes('maximum retail price')
        )
      );
     
      // Use price from attributes if available, otherwise use extracted price
      let productPrice = 0;
      if (priceFromAttributes && priceFromAttributes.value && priceFromAttributes.value !== 'N/A') {
        productPrice = priceFromAttributes.value;
      } else if (mrpFromAttributes && mrpFromAttributes.value && mrpFromAttributes.value !== 'N/A') {
        // If no regular price but have MRP, use MRP as price
        productPrice = mrpFromAttributes.value;
      } else {
        productPrice = extractPrice(existingProductData) || 0;
      }

      // Extract brand from accepted attributes first, then fallback to extracted brand
      const brandFromAttributes = acceptedAttributes.find(attr =>
        attr.key && (attr.key.toLowerCase().includes('brand'))
      );
      const productBrand = brandFromAttributes && brandFromAttributes.value && brandFromAttributes.value !== 'N/A'
        ? brandFromAttributes.value
        : extractBrand(existingProductData);

      const data = {
        originalTitle: existingProductData.title || 'N/A',
        originalPrice: productPrice,
        originalAsin: existingProductData.asin || existingProductData.id || 'N/A',
        originalImage: (existingProductData.images && existingProductData.images[0]) || 'https://placehold.co/400x400/E5E7EB/6B7280?text=No+Image',
        originalRating: extractRating(existingProductData) || 0,
        originalReviews: extractReviews(existingProductData) || 0,

        competitorTitle: goldStandardData?.title || 'Gold Standard Product',
        competitorPrice: extractPrice(goldStandardData) || 0,
        competitorAsin: goldStandardData?.asin || goldStandardData?.id || 'N/A',
        competitorImage: (goldStandardData?.images && goldStandardData.images[0]) || 'https://placehold.co/400x400/E5E7EB/6B7280?text=No+Image',
        competitorRating: extractRating(goldStandardData) || 0,
        competitorReviews: extractReviews(goldStandardData) || 0,

        generatedImages: generatedImages || [],

        description: existingProductData.description || 'No description available',
        features: existingFeatures,

        brandComparison: {
          original: productBrand || 'N/A', // Use brand from accepted attributes
          competitor: goldStandardData?.brand || extractBrand(goldStandardData) || 'N/A'
        },

        productAttributes: productAttributes,

        productDetails: existingProductData.productDetailsArray || [],
        manufacturingDetails: existingProductData.manufacturingDetailsArray || [],
       
        // Add accepted attributes from ProductComparatorPage
        acceptedAttributes: acceptedAttributes,

        department: extractDepartment(existingProductData) || productAttributes.Category || 'General',
        category: productAttributes.Category || 'N/A',
        subcategory: productAttributes.Subcategory || productAttributes.SubCategory || 'N/A',

        sizes: extractSizes(existingProductData) || ['S', 'M', 'L', 'XL', 'XXL'],
        colors: extractColors(existingProductData) || ['Default'],

        similarityScore: 0,

        notes: generateComparisonNotes(existingProductData, goldStandardData, productAttributes),

        deliveryDate: `Delivery by ${getEstimatedDelivery()}`
      };

      setComparisonData(data);
      console.log('✅ Built comparison data:', data);
    } else {
      console.warn('⚠️ No existing product found in localStorage, using default data');
      const defaultData = {
        originalTitle: "Product Not Found",
        originalPrice: 0,
        originalAsin: "N/A",
        originalImage: "https://placehold.co/400x400/E5E7EB/6B7280?text=No+Product",
        originalRating: 0,
        originalReviews: 0,

        competitorTitle: "No Gold Standard",
        competitorPrice: 0,
        competitorAsin: "N/A",
        competitorImage: "https://placehold.co/400x400/E5E7EB/6B7280?text=No+Image",
        competitorRating: 0,
        competitorReviews: 0,

        generatedImages: generatedImages || [],
        similarityScore: 0,
        notes: "No product data available. Please go back and select a product.",

        brandComparison: {
          original: "N/A",
          competitor: "N/A"
        },
        features: [],
        sizes: [],
        colors: [],
        acceptedAttributes: [],
        deliveryDate: "N/A"
      };

      setComparisonData(defaultData);
    }
  }, [navigate]);

  // Helper functions to extract data from product
  const extractPrice = (product) => {
    if (!product) return 0;
    if (product.price) return parseFloat(product.price);
    if (product.productDetails?.Price) return parseFloat(product.productDetails.Price);
    if (product.productDetailsArray) {
      const priceDetail = product.productDetailsArray.find(d =>
        d.label && d.label.toLowerCase().includes('price')
      );
      if (priceDetail) return parseFloat(priceDetail.value);
    }
    return 0;
  };

  const extractRating = (product) => {
    if (!product) return 0;
    if (product.rating) return parseFloat(product.rating);
    if (product.productDetails?.Rating) return parseFloat(product.productDetails.Rating);
    return 0;
  };

  const extractReviews = (product) => {
    if (!product) return 0;
    if (product.reviews) return parseInt(product.reviews);
    if (product.reviewCount) return parseInt(product.reviewCount);
    if (product.productDetails?.Reviews) return parseInt(product.productDetails.Reviews);
    return 0;
  };

  const extractBrand = (product) => {
    if (!product) return null;
    if (product.brand) return product.brand;

    if (product.manufacturingDetails?.Manufacturer) {
      const manufacturer = product.manufacturingDetails.Manufacturer;
      return manufacturer.split(',')[0].trim();
    }
    if (product.productDetailsArray) {
      const brandDetail = product.productDetailsArray.find(d =>
        d.label && d.label.toLowerCase().includes('brand')
      );
      if (brandDetail) return brandDetail.value;
    }

    if (product.productDetails?.Brand) {
      return product.productDetails.Brand;
    }

    return null;
  };

  const extractFeatures = (product) => {
    console.log('🔍 extractFeatures called with product:', product);
    if (!product) {
      console.log('⚠️ No product provided to extractFeatures');
      return [];
    }

    if (product.features && Array.isArray(product.features) && product.features.length > 0) {
      console.log('✅ Found features array in product:', product.features);
      return product.features;
    }

    console.log('⚠️ No features array found in product, trying fallback methods');

    const features = [];
    if (product.description) {
      features.push(product.description);
      console.log('📝 Added description as feature:', product.description);
    }

    if (product.productDetails?.Department) {
      features.push(`Department: ${product.productDetails.Department}`);
    }
    if (product.productDetails?.['Generic Name']) {
      features.push(`Type: ${product.productDetails['Generic Name']}`);
    }

    console.log('📋 Final features array:', features.length > 0 ? features : ['No features available']);
    return features.length > 0 ? features : ['No features available'];
  };

  const extractDepartment = (product) => {
    if (!product) return null;
    if (product.productDetails?.Department) return product.productDetails.Department;

    if (product.productDetailsArray) {
      const deptDetail = product.productDetailsArray.find(d =>
        d.label && d.label.toLowerCase().includes('department')
      );
      if (deptDetail) return deptDetail.value;
    }

    return null;
  };

  const extractSizes = (product) => {
    if (!product) return null;
    return null;
  };

  const extractColors = (product) => {
    if (!product) return null;
    return null;
  };

  const generateComparisonNotes = (existingProduct, goldStandard, attributes) => {
    if (!existingProduct) return 'No product data available for comparison.';

    let notes = '';

    if (goldStandard) {
      notes += `Comparing "${existingProduct.title}" with gold standard "${goldStandard.title}". `;
    } else {
      notes += `Analyzing product: "${existingProduct.title}". `;
    }

    if (attributes && Object.keys(attributes).length > 0) {
      notes += `Product attributes: ${Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ')}. `;
    }

    if (existingProduct.description) {
      console.log(existingProduct.description);
      notes += existingProduct.description;
    }

    return notes || 'No additional notes available.';
  };

  const getEstimatedDelivery = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper function to get display value (hide N/A values)
  const getDisplayValue = (value) => {
    if (!value || value === 'N/A' || value === '' || value === 'null' || value === 'undefined') {
      return null; // Return null to hide the row
    }
    return value;
  };

  // Helper function to check if a detail should be displayed
  const shouldDisplayDetail = (detail) => {
    if (!detail || !detail.label || !detail.value) return false;
   
    const label = detail.label.toString().trim();
    const value = detail.value.toString().trim();
   
    // Skip common duplicates and empty values
    if (!label || !value) return false;
    if (value === 'N/A' || value === '' || value === 'null' || value === 'undefined') return false;
   
    return true;
  };

  // Helper function to check if an accepted attribute should be displayed
  const shouldDisplayAttribute = (attribute) => {
    if (!attribute || !attribute.key || !attribute.value) return false;
   
    const key = attribute.key.toString().trim();
    const value = attribute.value.toString().trim();
   
    // Skip common duplicates and empty values
    if (!key || !value) return false;
    if (value === 'N/A' || value === '' || value === 'null' || value === 'undefined') return false;
   
    return true;
  };

  // Combine all details and attributes for display with deduplication
  const getAllDisplayDetails = () => {
    if (!comparisonData) return [];
   
    const allDetails = [];
    const seenLabels = new Set();
   
    // Function to normalize label more aggressively
    const normalizeLabel = (label) => {
      if (!label) return '';
      return label.toString()
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/gi, '') // Remove all special characters
        .replace(/\s+/g, ' ')     // Replace multiple spaces with single space
        .replace(/package\s*dimensions/gi, 'package dimensions') // Standardize package dimensions
        .replace(/date\s*first\s*available/gi, 'date first available') // Standardize date first available
        .replace(/item\s*part\s*number/gi, 'item part number') // Standardize item part number
        .replace(/asin/gi, 'asin') // Standardize asin
        .replace(/department/gi, 'department') // Standardize department
        .replace(/\s+/g, ''); // Remove ALL spaces for comparison
    };
   
    // Helper function to process and add details
    const processDetails = (detailsArray, type) => {
      if (!detailsArray || !Array.isArray(detailsArray)) return;
     
      detailsArray.forEach(item => {
        if (!item) return;
       
        // Handle different data structures
        const label = item.label || item.key || '';
        const value = item.value || '';
       
        if (!label || !value) return;
       
        const normalizedLabel = normalizeLabel(label);
       
        // Skip if we've already seen this label
        if (seenLabels.has(normalizedLabel)) {
          console.log(`Skipping duplicate ${type} attribute: "${label}" -> "${value}"`);
          return;
        }
       
        // Skip if value is N/A or empty
        if (value === 'N/A' || value === '' || value === 'null' || value === 'undefined') {
          return;
        }
       
        seenLabels.add(normalizedLabel);
        allDetails.push({
          label: label.trim(),
          value: value,
          type: type
        });
      });
    };
   
    // Also check for duplicates in the existingProductData structure
    const processNestedDetails = (detailsObject, type) => {
      if (!detailsObject || typeof detailsObject !== 'object') return;
     
      Object.entries(detailsObject).forEach(([key, value]) => {
        if (!key || !value) return;
       
        const normalizedLabel = normalizeLabel(key);
       
        // Skip if we've already seen this label
        if (seenLabels.has(normalizedLabel)) {
          console.log(`Skipping duplicate nested ${type} attribute: "${key}" -> "${value}"`);
          return;
        }
       
        // Skip if value is N/A or empty
        if (value === 'N/A' || value === '' || value === 'null' || value === 'undefined') {
          return;
        }
       
        seenLabels.add(normalizedLabel);
        allDetails.push({
          label: key.replace(/([A-Z])/g, ' $1').trim(), // Convert camelCase to spaces
          value: value,
          type: type
        });
      });
    };
   
    // Process all sources in priority order (custom attributes first, then product details, then manufacturing details)
   
    // 1. First process accepted attributes (highest priority - these are user-edited)
    if (comparisonData.acceptedAttributes && Array.isArray(comparisonData.acceptedAttributes)) {
      processDetails(comparisonData.acceptedAttributes, 'custom');
    }
   
    // 2. Process product details
    if (comparisonData.productDetails && Array.isArray(comparisonData.productDetails)) {
      processDetails(comparisonData.productDetails, 'product');
    }
   
    // 3. Process productDetailsArray if it exists
    if (comparisonData.productDetailsArray && Array.isArray(comparisonData.productDetailsArray)) {
      processDetails(comparisonData.productDetailsArray, 'product');
    }
   
    // 4. Process manufacturing details
    if (comparisonData.manufacturingDetails && Array.isArray(comparisonData.manufacturingDetails)) {
      processDetails(comparisonData.manufacturingDetails, 'manufacturing');
    }
   
    // 5. Process manufacturingDetailsArray if it exists
    if (comparisonData.manufacturingDetailsArray && Array.isArray(comparisonData.manufacturingDetailsArray)) {
      processDetails(comparisonData.manufacturingDetailsArray, 'manufacturing');
    }
    
    // 5a. Process technicalDetails for Home & Kitchen (object format)
    if (comparisonData.technicalDetails && typeof comparisonData.technicalDetails === 'object' && !Array.isArray(comparisonData.technicalDetails)) {
      processNestedDetails(comparisonData.technicalDetails, 'technical-details');
    }
    
    // 5b. Process additionalInfo for Home & Kitchen (object format)
    if (comparisonData.additionalInfo && typeof comparisonData.additionalInfo === 'object' && !Array.isArray(comparisonData.additionalInfo)) {
      processNestedDetails(comparisonData.additionalInfo, 'additional-info');
    }
    
    // 5c. Add What's in the Box if present
    if (comparisonData.whatsInBox && comparisonData.whatsInBox !== 'Not specified') {
      allDetails.push({
        label: "What's in the Box",
        value: comparisonData.whatsInBox,
        source: 'whats-in-box'
      });
    }
   
    // 6. Process nested productDetails object
    if (comparisonData.productDetails && typeof comparisonData.productDetails === 'object' && !Array.isArray(comparisonData.productDetails)) {
      processNestedDetails(comparisonData.productDetails, 'product-nested');
    }
   
    // 7. Process nested manufacturingDetails object
    if (comparisonData.manufacturingDetails && typeof comparisonData.manufacturingDetails === 'object' && !Array.isArray(comparisonData.manufacturingDetails)) {
      processNestedDetails(comparisonData.manufacturingDetails, 'manufacturing-nested');
    }
   
    // Sort by label for consistent display
    allDetails.sort((a, b) => a.label.localeCompare(b.label));
   
    console.log('Display details after deduplication:', allDetails);
    return allDetails;
  };

  if (!comparisonData || !userInfo) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const displayDetails = getAllDisplayDetails();
  const { mrp, discountPercentage } = extractMRPAndDiscount();

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-[#131921] text-white px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold">Amazon</div>
          <div className="text-sm flex items-center gap-4">
            <span className="text-gray-300">Generated by {userInfo.name}</span>
            <button
              onClick={() => navigate('/seller-list')}
              className="bg-[#febd69] text-black px-4 py-1 rounded hover:bg-[#f3a847]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </nav>

      <div className="bg-[#232f3e] text-white px-4 py-2 mb-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-lg text-center">
            Final Preview
          </div>
        </div>
      </div>

      <div ref={contentRef} className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Image */}
          <div className="col-span-5">
            <div className="sticky top-4">
              {/* Main Image Display with Slider */}
              <div className="border p-4 mb-4 bg-white rounded-lg">
                <div className="h-[500px] flex items-center justify-center bg-gray-50 relative group rounded-lg overflow-hidden">
                  {allImages.length > 0 ? (
                    <>
                      <img
                        src={allImages[currentImageIndex]?.url}
                        alt={allImages[currentImageIndex]?.label || 'Product Image'}
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => {
                          e.target.src = `https://placehold.co/500x500/E5E7EB/6B7280?text=Image+Error`;
                        }}
                      />

                      {allImages.length > 1 && (
                        <>
                          <button
                            onClick={prevImage}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Previous Image"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </button>
                          <button
                            onClick={nextImage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Next Image"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </button>
                        </>
                      )}

                      <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                        {currentImageIndex + 1} / {allImages.length}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-400">
                      <p className="text-lg mb-2">No images available</p>
                      <p className="text-sm">Please upload or generate product images</p>
                    </div>
                  )}
                </div>

                <div className="text-center mt-3">
                  <p className="text-sm font-medium text-gray-900">
                    {allImages[currentImageIndex]?.label || 'Product Image'}
                  </p>
                </div>
              </div>

              {/* Thumbnail Strip */}
              {allImages.length > 0 && (
                <div className="border rounded-lg p-3 bg-white">
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {allImages.map((image, index) => (
                      <div
                        key={index}
                        onClick={() => goToImage(index)}
                        className={`flex-shrink-0 cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${currentImageIndex === index
                          ? 'border-blue-500 ring-2 ring-blue-300'
                          : 'border-gray-200 hover:border-blue-300'
                          }`}
                        style={{ width: '80px', height: '80px' }}
                      >
                        <div className="relative w-full h-full">
                          <img
                            src={image.url}
                            alt={image.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = `https://placehold.co/80x80/E5E7EB/6B7280?text=${index + 1}`;
                            }}
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                            {image.type === 'generated' ? 'Listro' : 'Orig'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Product Details */}
          <div className="col-span-7">
            <div className="border-b border-[#e7e7e7] pb-4">
              <h1 className="text-xl font-medium mb-2">
                {comparisonData?.originalTitle}
              </h1>
            </div>

            {/* Price Section - Amazon Style with MRP and Discount */}
            <div className="py-4 border-b border-[#e7e7e7]">
              {/* MRP with strikethrough - Show only if MRP exists */}
              {mrp && (
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] text-gray-600">M.R.P.:</span>
                  <span className="text-[14px] text-gray-600 line-through">
                    {mrp}
                  </span>
                </div>
              )}
             
              {/* Current Price */}
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-gray-900">Price:</span>
                <span className="text-[28px] text-[#0F1111] font-light tracking-tight">
                  {comparisonData?.originalPrice}
                </span>
               
                {/* Discount Percentage - Show only if discount can be calculated */}
                {discountPercentage && discountPercentage > 0 && (
                  <span className="text-[14px] text-[#cc0c39]">
                    ({discountPercentage}% off)
                  </span>
                )}
              </div>
             
              {/* Tax info */}
              <div className="mt-1 text-[12px] text-gray-500">
                <span>Inclusive of all taxes</span>
              </div>
             
              {/* Price comparison with gold standard */}
              {comparisonData?.competitorPrice > 0 && (
                <div className="mt-2">
                  <div className="inline-flex items-center bg-[#fef8f2] px-2 py-1 rounded">
                    <span className="text-sm text-[#c45500]">
                      {comparisonData?.originalPrice < comparisonData?.competitorPrice
                        ? 'Lower price than gold standard by '
                        : 'Higher price than gold standard by '}
                      {Math.abs(comparisonData?.originalPrice - comparisonData?.competitorPrice).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Product Information */}
            <div className="py-4 border-b border-[#e7e7e7]">
              <table className="w-full text-sm">
                <tbody>
                  {/* Brand - Show only if not N/A */}
                  {getDisplayValue(comparisonData?.brandComparison.original) && (
                    <tr>
                      <td className="py-1 pr-4 align-top text-[#565959]" style={{ width: '120px' }}>Brand</td>
                      <td className="py-1 text-[#0F1111]">{comparisonData?.brandComparison.original}</td>
                    </tr>
                  )}
                 
                  {/* ASIN - Always show */}
                  <tr>
                    <td className="py-1 pr-4 align-top text-[#565959]">ASIN</td>
                    <td className="py-1 text-[#0F1111]">{comparisonData?.originalAsin}</td>
                  </tr>
                 
                  {/* Category - Show only if not N/A */}
                  {getDisplayValue(comparisonData?.category) && comparisonData.category !== 'N/A' && (
                    <tr>
                      <td className="py-1 pr-4 align-top text-[#565959]">Category</td>
                      <td className="py-1 text-[#0F1111]">{comparisonData.category}</td>
                    </tr>
                  )}
                 
                  {/* Subcategory - Show only if not N/A */}
                  {getDisplayValue(comparisonData?.subcategory) && comparisonData.subcategory !== 'N/A' && (
                    <tr>
                      <td className="py-1 pr-4 align-top text-[#565959]">Subcategory</td>
                      <td className="py-1 text-[#0F1111]">{comparisonData.subcategory}</td>
                    </tr>
                  )}
                 
                  {/* Department - Show only if not N/A and not 'General' */}
                  {getDisplayValue(comparisonData?.department) && comparisonData.department !== 'General' && comparisonData.department !== 'N/A' && (
                    <tr>
                      <td className="py-1 pr-4 align-top text-[#565959]">Department</td>
                      <td className="py-1 text-[#0F1111]">{comparisonData.department}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Complete Listing Data Section-wise */}
            <div className="py-6 border-b border-[#e7e7e7]">
              
              {/* Product Overview Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[#0F1111] mb-3 pb-2 border-b-2 border-[#FFD814]">Product Overview</h3>
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {comparisonData?.originalTitle && comparisonData.originalTitle !== 'N/A' && (
                      <>
                        <div className="font-medium text-[#565959]">Product Title:</div>
                        <div className="text-[#0F1111] font-semibold">{comparisonData.originalTitle}</div>
                      </>
                    )}
                    {comparisonData?.originalAsin && comparisonData.originalAsin !== 'N/A' && (
                      <>
                        <div className="font-medium text-[#565959]">ASIN:</div>
                        <div className="text-[#0F1111]">{comparisonData.originalAsin}</div>
                      </>
                    )}
                    {comparisonData?.brandComparison?.original && comparisonData.brandComparison.original !== 'N/A' && (
                      <>
                        <div className="font-medium text-[#565959]">Brand:</div>
                        <div className="text-[#0F1111]">{comparisonData.brandComparison.original}</div>
                      </>
                    )}
                    {comparisonData?.originalPrice && comparisonData.originalPrice !== 0 && (
                      <>
                        <div className="font-medium text-[#565959]">Price:</div>
                        <div className="text-[#0F1111] font-semibold">₹{comparisonData.originalPrice}</div>
                      </>
                    )}
                    {comparisonData?.category && comparisonData.category !== 'N/A' && (
                      <>
                        <div className="font-medium text-[#565959]">Category:</div>
                        <div className="text-[#0F1111]">{comparisonData.category}</div>
                      </>
                    )}
                    {comparisonData?.subcategory && comparisonData.subcategory !== 'N/A' && (
                      <>
                        <div className="font-medium text-[#565959]">Subcategory:</div>
                        <div className="text-[#0F1111]">{comparisonData.subcategory}</div>
                      </>
                    )}
                    {comparisonData?.department && comparisonData.department !== 'N/A' && comparisonData.department !== 'General' && (
                      <>
                        <div className="font-medium text-[#565959]">Department:</div>
                        <div className="text-[#0F1111]">{comparisonData.department}</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Product Features Section */}
              {comparisonData?.features && comparisonData.features.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#0F1111] mb-3 pb-2 border-b-2 border-[#FFD814]">About This Item (Bullet Points)</h3>
                  <div className="bg-green-50 rounded-lg p-4">
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      {comparisonData.features.map((feature, index) => (
                        feature && feature !== 'No features available' && (
                          <li key={index} className="text-[#0F1111]">{feature}</li>
                        )
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Product Description Section */}
              {comparisonData?.description && comparisonData.description !== 'No description available' && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#0F1111] mb-3 pb-2 border-b-2 border-[#FFD814]">Product Description</h3>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-[#0F1111] whitespace-pre-wrap">{comparisonData.description}</p>
                  </div>
                </div>
              )}

              {/* Product Details Section */}
              {comparisonData?.productDetails && comparisonData.productDetails.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#0F1111] mb-3 pb-2 border-b-2 border-[#FFD814]">Product Details</h3>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {comparisonData.productDetails.map((detail, index) => (
                        detail.value && detail.value.trim() !== '' && detail.value !== 'N/A' && (
                          <div key={index} className="flex flex-col space-y-1">
                            <div className="font-medium text-[#565959]">
                              {detail.label ? detail.label.replace(/[\n\s:â€Žâ€]+/g, ' ').trim() : 'Attribute'}:
                            </div>
                            <div className="text-[#0F1111] font-semibold">{detail.value}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Manufacturing Details Section */}
              {comparisonData?.manufacturingDetails && comparisonData.manufacturingDetails.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#0F1111] mb-3 pb-2 border-b-2 border-[#FFD814]">Manufacturing Details</h3>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {comparisonData.manufacturingDetails.map((detail, index) => (
                        detail.value && detail.value.trim() !== '' && detail.value !== 'N/A' && (
                          <div key={index} className="flex flex-col space-y-1">
                            <div className="font-medium text-[#565959]">
                              {detail.label ? detail.label.replace(/[\n\s:â€Žâ€]+/g, ' ').trim() : 'Attribute'}:
                            </div>
                            <div className="text-[#0F1111] font-semibold">{detail.value}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Accepted Attributes Section */}
              {comparisonData?.acceptedAttributes && comparisonData.acceptedAttributes.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#0F1111] mb-3 pb-2 border-b-2 border-[#FFD814]">Additional Attributes</h3>
                  <div className="bg-pink-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {comparisonData.acceptedAttributes.map((attr, index) => (
                        attr.value && attr.value.trim() !== '' && attr.value !== 'N/A' && (
                          <div key={index} className="flex flex-col space-y-1">
                            <div className="font-medium text-[#565959]">
                              {attr.key ? attr.key : 'Attribute'}:
                            </div>
                            <div className="text-[#0F1111] font-semibold">{attr.value}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="py-4 space-y-4">
              <div className="flex flex-col gap-3 mt-6">
                <button
                  onClick={handleCombinedSubmit}
                  disabled={isExporting}
                  className="bg-gradient-to-r from-[#FF9900] to-[#FFD814] hover:from-[#F08804] hover:to-[#F7CA00]
                    text-[#0F1111] py-3 px-4 rounded-lg shadow-lg border border-[#FCD200] font-medium text-base
                    transition-all duration-300 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed
                    flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

                  {isExporting ? (
                    <>
                      <svg className="animate-spin h-6 w-6 text-[#0F1111]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-semibold">Submitting to Both Platforms...</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="font-bold text-lg">SUBMIT</span>
                      </div>
                    </>
                  )}
                </button>

                <div className="text-center text-sm text-gray-500 mt-1">
                  <p>Exports data to both Google Sheets and BigQuery simultaneously</p>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Success Dialog Modal */}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-fadeIn">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-2xl">
              <div className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center ring-4 ring-green-50">
                  <div className="h-7 w-7 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Export Successful! 🎉</h3>
                  <p className="text-sm text-gray-600 mt-1">Choose your next step</p>
                </div>
              </div>
              <button
                onClick={handleCloseDialog}
                className="text-gray-400 hover:text-gray-600 transition-colors hover:bg-gray-100 p-2 rounded-full"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="p-8">
              {/* Success Message */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mb-4">
                  <svg className="h-10 w-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                
                <p className="text-gray-700 text-lg font-medium mb-2">
                  Your work has been successfully completed!
                </p>
                <p className="text-sm text-gray-600">
                  {endTimeUpdated ? '✅ Completion time recorded in tracking sheet' : '✅ Data exported successfully'}
                </p>

                {/* Current ASIN Info */}
                <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed ASIN</div>
                      <div className="text-lg font-bold text-gray-900 mt-1">
                        {comparisonData?.originalAsin || 'ASIN'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Completed On</div>
                      <div className="text-sm font-medium text-gray-700 mt-1">
                        {endTimeData?.endTime || new Date().toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">What would you like to do next?</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                {/* Option 1: Start New ASIN */}
                <button
                  onClick={handleStartNewAsin}
                  className="w-full group relative overflow-hidden flex items-center space-x-4 px-6 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl hover:border-blue-400 hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                    <RefreshCw className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="relative z-10 text-left flex-1">
                    <div className="font-bold text-gray-900 text-lg">Start New ASIN</div>
                    <div className="text-sm text-gray-600 mt-1">Continue with same seller</div>
                  </div>
                  <div className="relative z-10 ml-auto text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </button>

                {/* Option 2: Select New Seller */}
                <button
                  onClick={handleSelectNewSeller}
                  className="w-full group relative overflow-hidden flex items-center space-x-4 px-6 py-5 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl hover:border-purple-400 hover:from-purple-100 hover:to-pink-100 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="relative z-10 flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors">
                    <Home className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="relative z-10 text-left flex-1">
                    <div className="font-bold text-gray-900 text-lg">Select New Seller</div>
                    <div className="text-sm text-gray-600 mt-1">Choose a different seller</div>
                  </div>
                  <div className="relative z-10 ml-auto text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </button>
              </div>

              {/* Footer Note */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-center text-gray-500">
                  <span className="font-semibold">Tracking:</span> ASIN <span className="font-mono">{comparisonData?.originalAsin}</span> marked as completed
                  {endTimeUpdated && ' with timestamp'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalPage;

