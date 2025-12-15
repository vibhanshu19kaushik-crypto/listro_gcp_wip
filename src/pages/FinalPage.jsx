import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { insertProductToBigQuery } from "../api/api.js";
import { NODE_API_BASE_URL } from "../api/config";


const FinalPage = () => {
 const [comparisonData, setComparisonData] = useState(null);
 const [userInfo, setUserInfo] = useState(null);
 const [currentImageIndex, setCurrentImageIndex] = useState(0);
 const [allImages, setAllImages] = useState([]);
 const [isExporting, setIsExporting] = useState(false);
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
 // ðŸ”§ Helper: Build Google Sheets Data
 // ================================
 const buildSheetData = (comparisonData, allImages) => {
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


   const getBulletPoint = (index) => {
     if (comparisonData.features && comparisonData.features[index]) {
       return comparisonData.features[index];
     }
     return 'N/A';
   };


   const getSpecialFeature = (index) => {
     if (comparisonData.features && comparisonData.features.length > 5) {
       const featureIndex = 5 + index;
       if (comparisonData.features[featureIndex]) {
         return comparisonData.features[featureIndex];
       }
     }
     return 'N/A';
   };


   const getImageURL = (index) => {
     if (allImages && allImages[index]) {
       return allImages[index].url;
     }
     return 'N/A';
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
   const productPrice = priceFromAttributes !== 'N/A' ? priceFromAttributes : safeValue(comparisonData.originalPrice);


   // Extract brand from accepted attributes first, then fallback to brand comparison
   const brandFromAttributes = findDetailValue('brand') || findDetailValue('brand name');
   const productBrand = brandFromAttributes !== 'N/A' ? brandFromAttributes : safeValue(comparisonData.brandComparison?.original);


   const dataRow = [
     formattedDate, // Date
     'N/A', // Number_of_attributes_with_errors
     'N/A', // Number_of_attributes_with_other_suggestions
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
     'N/A', // Recommended_Browse_Nodes
     findDetailValue('closure'), // Closure_Type
     findDetailValue('model name'), // Model_Name
     findDetailValue('model number'), // Model_Number
     findDetailValue('care instructions'), // Product_Care_Instructions
     productPrice, // Your_price (from attributes or original price)
     '1', // Quantity
     'N/A', // Apparel_Size_Body_Type
     safeValue(findDetailValue('gender') || comparisonData.department), // Target_Gender
     findDetailValue('age range'), // Age_Range_Description
     'N/A', // Apparel_Size_System
     'N/A', // Apparel_Size_Class
     findDetailValue('size'), // Apparel_Size_Value
     'N/A', // Apparel_Size_To_Range
     getImageURL(0), // Main_Image_URL
     getImageURL(1), // Other_Image_URL1
     getImageURL(2), // Other_Image_URL2
     getImageURL(3), // Other_Image_URL3
     getImageURL(4), // Other_Image_URL4
     getImageURL(5), // Other_Image_URL5
     getImageURL(6), // Other_Image_URL6
     getImageURL(7), // Other_Image_URL7
     getImageURL(8), // Other_Image_URL8
     'N/A', // Swatch_Image_URL
     'N/A', // Parentage
     'N/A', // Parent_SKU
     'N/A', // Relationship_Type
     'N/A', // Variation_Theme
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
     'N/A', // Occasion2
     'N/A', // Occasion3
     'N/A', // Occasion4
     'N/A', // Occasion5
     'N/A', // Duration_Unit
     findDetailValue('neck'), // Neck_Style
     findDetailValue('color') || findDetailValue('colour'), // Colour_Map
     findDetailValue('season'), // Season
     'N/A', // Team_Name
     findDetailValue('importer'), // Importer_Contact_Information
     findDetailValue('material'), // Material_Type
     'N/A', // Duration
     'N/A', // Occasion_Lifestyle
     findDetailValue('pockets'), // Number_Of_Pockets
     findDetailValue('manufacturer'), // Manufacturer_Contact
     findDetailValue('fur'), // Fur_Description
     findDetailValue('fit'), // Fitting_type
     findDetailValue('collar'), // Collar_Style
     findDetailValue('color') || findDetailValue('colour'), // Color
     'N/A', // Embellishment_Feature1
     'N/A', // Embellishment_Feature2
     'N/A', // Embellishment_Feature3
     'N/A', // Embellishment_Feature4
     'N/A', // Embellishment_Feature5
     findDetailValue('weave'), // Weave_Type
     'N/A', // Back_Style
     findDetailValue('theme'), // Theme
     safeValue(findDetailValue('gender') || comparisonData.department), // Gender
     'N/A', // League_Name
     'N/A', // Special_Sizes
     'N/A', // Embroidery_Type
     'N/A', // Included_Components1
     'N/A', // Included_Components2
     'N/A', // Included_Components3
     'N/A', // Included_Components4
     'N/A', // Included_Components5
     findDetailValue('sleeve'), // Sleeve_Type
     findDetailValue('size'), // Size
     'N/A', // Product_Lifecycle_Supply_Type
     findDetailValue('pattern'), // Pattern
     'N/A', // Maximum_Seller_Allowed_Price
     'N/A', // flash_point_unit_of_measure
     'N/A', // Is_exempt_from_supplier_declared_external_product_identifier
     'N/A', // Skip_Offer
     'N/A', // Minimum_Advertised_Price_Display
     'N/A', // Minimum_Seller_Allowed_Price
     findDetailValue('weight'), // Item_Weight
     'N/A', // Item_Weight_Unit
     'N/A', // Item_Width_Unit_Of_Measure
     findDetailValue('width'), // Item_Width
     findDetailValue('height'), // Item_Height
     findDetailValue('size'), // Generic_Size
     'N/A', // Chest_Size_Unit
     findDetailValue('chest'), // Chest_Size
     'N/A', // Unit_Count
     findDetailValue('length'), // Item_Length_Description
     'N/A', // Item_Height_Unit_Of_Measure
     'N/A', // Item_Length_Unit_Of_Measure
     findDetailValue('length'), // Item_Length
     'N/A', // Unit_Count_Type
     'N/A', // Item_Length_Longer_Edge
     'N/A', // Item_Length_Unit
     'N/A', // Fulfillment_Centre_ID
     findDetailValue('package weight'), // Package_Weight
     'N/A', // Package_Weight_Unit_Of_Measure
     findDetailValue('package height'), // Package_Height
     'N/A', // Item_Package_height_Unit_of_Measure
     findDetailValue('package length'), // Package_Length
     'N/A', // Package_Length_Unit_Of_Measure
     findDetailValue('package width'), // package_width
     'N/A', // Item_Package_width_Unit_of_Measure
     findDetailValue('country') || findDetailValue('origin'), // Country_of_Origin
     'N/A', // Are_batteries_required
     'N/A', // Dangerous_Goods_Regulations1
     'N/A', // Dangerous_Goods_Regulations2
     'N/A', // Dangerous_Goods_Regulations3
     'N/A', // Dangerous_Goods_Regulations4
     'N/A', // Dangerous_Goods_Regulations5
     'N/A', // Hazmat
     'N/A', // Safety_Data_Sheet_URL
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Compliance_Media_Content_Type1-10
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Compliance_Media_Content_Type11-17
     findDetailValue('fabric'), // Fabric_Type
     'N/A', // Flash_point_C
     'N/A', // Specific_Uses_for_Product
     'N/A', // External_Product_Information
     'N/A', 'N/A', 'N/A', // Material_Fabric_Regulations1-3
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Compliance_Media_Source_Location1-10
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Compliance_Media_Source_Location11-17
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Compliance_Media_Language1-10
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Compliance_Media_Language11-17
     'N/A', // GHS_Class
     'New', // Condition
     'N/A', // Condition_Note
     '2', // Handling_Time
     'N/A', // Release_Date
     'N/A', // Restock_Date
     'N/A', // Product_Tax_Code
     'N/A', // Sale_Price
     'N/A', // Sale_Start_Date
     'N/A', // Sale_End_Date
     'N/A', // Max_Order_Quantity
     '1', // Number_of_Items
     'N/A', // Can_Be_Gift_Messaged
     'N/A', // Is_Gift_Wrap_Available
     'N/A', // Minimum_Advertised_Price
     productPrice, // List_Price (from attributes or original price)
     'INR', // Currency
     'N/A', // Offer_End_Date
     'N/A', // Shipping_Template
     'N/A', // Offer_Start_Date
     productPrice, // Maximum_Retail_Price (from attributes or original price)
     'N/A', // Business_Price
     'N/A', // Quantity_Price_Type
     'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', 'N/A', // Quantity_Price/Bound 1-5
     'N/A', // Pricing_Action
     'N/A', // United_Nations_Standard_Products_and_Services_Code
     'N/A'  // National_Stock_Number
   ];


   const sheetData = [columnHeaders, dataRow];


   return {
     sheetData,
     formattedDate,
     currentSellerSKU: safeValue(comparisonData.originalAsin)
   };
 };


 // ================================
 // ðŸš€ Combined Submit (Sheets + BigQuery)
 // ================================
 const handleCombinedSubmit = async () => {
   if (!comparisonData) {
     alert('No data available to export');
     return;
   }


   setIsExporting(true);


   try {
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


     // ðŸ“… Export date for BigQuery (ISO yyyy-mm-dd)
     const exportDate = new Date().toISOString().split("T")[0];


     // Extract price from accepted attributes first, then fallback to original price
     const priceFromAttributes = findDetailValue('price');
     const productPrice = priceFromAttributes !== 'N/A' ? priceFromAttributes : safeValue(comparisonData.originalPrice);


     // Extract brand from accepted attributes first, then fallback to brand comparison
     const brandFromAttributes = findDetailValue('brand') || findDetailValue('brand name');
     const productBrand = brandFromAttributes !== 'N/A' ? brandFromAttributes : safeValue(comparisonData.brandComparison?.original);


     // ðŸŽ¯ BigQuery payload with unified IDs
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


     console.log('ðŸš€ Prepared data for BigQuery:', productData);


     // ðŸ§¾ Build Google Sheets data
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
         console.log('âœ… Data processed in Google Sheets:', json);
       } else {
         console.error('âŒ Google Sheets upload failed:', json.error);
       }
     } else {
       console.error('âŒ Google Sheets request error:', sheetResult.reason);
     }


     // Handle BigQuery result
     let bigQuerySuccess = false;
     let bigQueryInserted = 0;


     if (bigQueryResult.status === 'fulfilled') {
       const result = bigQueryResult.value;
       if (result.success) {
         bigQuerySuccess = true;
         bigQueryInserted = result.inserted || 0;
         console.log('âœ… Successfully exported to BigQuery:', result);
       } else {
         console.error('âŒ BigQuery export failed:', result.error);
       }
     } else {
       console.error('âŒ BigQuery request error:', bigQueryResult.reason);
     }


     // Build summary message
     let message = 'âœ… SUBMISSION COMPLETE!\n\n';


     if (bigQuerySuccess && sheetsSuccess) {
       message += 'âœ” Data exported to BigQuery\nâœ” Data exported to Google Sheets\n\nBoth platforms updated successfully!';
     } else if (bigQuerySuccess && !sheetsSuccess) {
       message += 'âœ” Data exported to BigQuery\nâœ– Google Sheets export failed\n\nBigQuery was updated successfully.';
     } else if (!bigQuerySuccess && sheetsSuccess) {
       message += 'âœ– BigQuery export failed\nâœ” Data exported to Google Sheets\n\nGoogle Sheets was updated successfully.';
     } else {
       message += 'âœ– Both exports failed\n\nPlease check your connection and try again.';
     }


     if (sheetsSuccess) {
       if (sheetsDuplicate) {
         message += `\n\nExisting Google Sheets entry updated.\nðŸ“… Date: ${formattedDate}\nðŸ“¦ Seller SKU: ${currentSellerSKU}`;
       } else {
         message += `\n\nNew Google Sheets entry added.\nðŸ“… Date: ${formattedDate}\nðŸ“¦ Seller SKU: ${currentSellerSKU}`;
       }
     }


     if (sheetsUrl) {
       message += `\n\nðŸ“Š Google Sheet: ${sheetsUrl}`;
     }


     if (bigQuerySuccess) {
       message += `\n\nðŸ“Š BigQuery: ${bigQueryInserted} record(s) inserted`;
     }


     alert(message);


     if (sheetsUrl) {
       setTimeout(() => {
         window.open(sheetsUrl, '_blank');
       }, 1000);
     }


   } catch (error) {
     console.error('âŒ Error in combined submit:', error);
     alert(`Submission Error: ${error.message}\n\nPlease try again or check console for details.`);
   } finally {
     setIsExporting(false);
   }
 };


 const renderStars = (rating) => {
   return "â˜…".repeat(rating) + "â˜†".repeat(5 - rating);
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
   console.log('ðŸ” DEBUG: Raw existingProductData from localStorage:', existingProductData);
  
   if (existingProductData) {
     console.log('ðŸ” DEBUG: productDetailsArray:', existingProductData.productDetailsArray);
     console.log('ðŸ” DEBUG: manufacturingDetailsArray:', existingProductData.manufacturingDetailsArray);
     console.log('ðŸ” DEBUG: acceptedAttributes:', existingProductData.acceptedAttributes);
     console.log('ðŸ” DEBUG: productDetails (object):', existingProductData.productDetails);
     console.log('ðŸ” DEBUG: manufacturingDetails (object):', existingProductData.manufacturingDetails);
   }


   const storedAllImages = localStorage.getItem('allProductImages');
   let productImages = [];


   if (storedAllImages) {
     try {
       productImages = JSON.parse(storedAllImages);
       console.log('ðŸ–¼ Loaded all product images:', productImages);
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


     console.log('ðŸ“¦ Built combined images from individual sources:', productImages);
   }


   setAllImages(productImages);


   const storedGeneratedImages = localStorage.getItem('generatedImages');
   const generatedImages = storedGeneratedImages ? JSON.parse(storedGeneratedImages) : [];


   const storedGoldStandard = localStorage.getItem('goldStandardProduct');
   const goldStandardData = storedGoldStandard ? JSON.parse(storedGoldStandard) : null;


   const storedFilters = localStorage.getItem('productFilters');
   const productAttributes = storedFilters ? JSON.parse(storedFilters) : {};


   console.log('ðŸ“¦ Loaded existing product:', existingProductData);
   console.log('ðŸŽ¨ Loaded generated images:', generatedImages);
   console.log('â­ Loaded gold standard:', goldStandardData);
   console.log('ðŸ· Loaded attributes:', productAttributes);


   if (existingProductData) {
     const existingFeatures = extractFeatures(existingProductData);
     console.log('âœ¨ Features extracted from EXISTING product:', existingFeatures);


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
     console.log('âœ… Built comparison data:', data);
   } else {
     console.warn('âš  No existing product found in localStorage, using default data');
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
   console.log('ðŸ”§ extractFeatures called with product:', product);
   if (!product) {
     console.log('âš  No product provided to extractFeatures');
     return [];
   }


   if (product.features && Array.isArray(product.features) && product.features.length > 0) {
     console.log('âœ… Found features array in product:', product.features);
     return product.features;
   }


   console.log('âš  No features array found in product, trying fallback methods');


   const features = [];
   if (product.description) {
     features.push(product.description);
     console.log('ðŸ“ Added description as feature:', product.description);
   }


   if (product.productDetails?.Department) {
     features.push(`Department: ${product.productDetails.Department}`);
   }
   if (product.productDetails?.['Generic Name']) {
     features.push(`Type: ${product.productDetails['Generic Name']}`);
   }


   console.log('ðŸ”Ž Final features array:', features.length > 0 ? features : ['No features available']);
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
                   â‚¹{mrp}
                 </span>
               </div>
             )}
            
             {/* Current Price */}
             <div className="flex items-baseline gap-2">
               <span className="text-[12px] text-gray-900">Price:</span>
               <span className="text-[28px] text-[#0F1111] font-light tracking-tight">
                 â‚¹{comparisonData?.originalPrice}
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
                     â‚¹{Math.abs(comparisonData?.originalPrice - comparisonData?.competitorPrice).toFixed(2)}
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


           {/* Features */}
           <div className="border-b border-[#e7e7e7] pb-4">
             <div className="flex items-center justify-between mb-2">
               <h3 className="text-[#0F1111] font-medium text-lg">About this item</h3>
             </div>
             <ul className="list-disc pl-5 space-y-1 text-sm text-[#0F1111]">
               {comparisonData?.features && comparisonData.features.length > 0 ? (
                 comparisonData.features.map((feature, index) => (
                   <li key={index}>{feature}</li>
                 ))
               ) : (
                 <li>No features available</li>
               )}
             </ul>
           </div>


           {/* Description */}
           <div className='border-b border-[#e7e7e7] pb-4'>
             {comparisonData?.description && comparisonData.description !== 'No description available' && (
               <div className="mt-2">
                 <h4 className="text-[#0F1111] font-medium text-lg">Product Description</h4>
                 <p className="text-sm text-[#0F1111] pt-2">{comparisonData.description}</p>
               </div>
             )}
           </div>


           {/* Combined Product Details (Product Details + Manufacturing Details + Accepted Attributes) - DEDUPLICATED */}
           {displayDetails.length > 0 && (
             <div className="py-4 border-b border-[#e7e7e7]">
               <h3 className="text-[#0F1111] font-medium text-lg mb-2">Product Details</h3>
               <table className="w-full text-sm">
                 <tbody>
                   {displayDetails.map((detail, index) => (
                     <tr key={index}>
                       <td className="py-1 pr-4 align-top text-[#565959]" style={{ width: '200px' }}>
                         {detail.label.replace(/[\n\s:â€Žâ€]+/g, ' ').trim()}
                       </td>
                       <td className="py-1 text-[#0F1111]">{detail.value}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           )}


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
   </div>
 );
};


export default FinalPage;


