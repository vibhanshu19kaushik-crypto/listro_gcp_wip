/**
 * Helper: Build Google Sheets Data (163 columns)
 */
export const buildSheetData = (comparisonData, allImages) => {
  const safeValue = (value) => {
    if (value === null || value === undefined || value === 'N/A' || value === '') return '';
    return String(value).trim();
  };

  const findDetailValue = (labelSearch) => {
    if (comparisonData.productDetails) {
      const detail = comparisonData.productDetails.find(d =>
        d.label && d.label.toLowerCase().includes(labelSearch.toLowerCase())
      );
      if (detail && detail.value && detail.value !== 'N/A') return detail.value;
    }
   
    if (comparisonData.manufacturingDetails) {
      const detail = comparisonData.manufacturingDetails.find(d =>
        d.label && d.label.toLowerCase().includes(labelSearch.toLowerCase())
      );
      if (detail && detail.value && detail.value !== 'N/A') return detail.value;
    }
   
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

  const currentDate = new Date();
  const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;

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

  const priceFromAttributes = findDetailValue('price');
  const productPrice = priceFromAttributes !== '' ? priceFromAttributes : safeValue(comparisonData.originalPrice);

  const brandFromAttributes = findDetailValue('brand') || findDetailValue('brand name');
  const productBrand = brandFromAttributes !== '' ? brandFromAttributes : safeValue(comparisonData.brandComparison?.original);

  const dataRow = [
    formattedDate, '', '', safeValue(comparisonData.subcategory), safeValue(comparisonData.originalAsin),
    productBrand, 'Update', findDetailValue('part number'), safeValue(comparisonData.originalAsin), 'ASIN',
    safeValue(comparisonData.originalTitle), safeValue(comparisonData.description || comparisonData.notes),
    findDetailValue('manufacturer'), '', findDetailValue('closure'), findDetailValue('model name'),
    findDetailValue('model number'), findDetailValue('care instructions'), productPrice, '1', '',
    safeValue(findDetailValue('gender') || comparisonData.department), findDetailValue('age range'), '', '',
    findDetailValue('size'), '', getImageURL(0), getImageURL(1), getImageURL(2), getImageURL(3), getImageURL(4),
    getImageURL(5), getImageURL(6), getImageURL(7), getImageURL(8), '', '', '', '', '',
    getBulletPoint(0), getBulletPoint(1), getBulletPoint(2), getBulletPoint(3), getBulletPoint(4),
    safeValue(comparisonData.category), findDetailValue('style'), findDetailValue('packer'),
    getSpecialFeature(0), getSpecialFeature(1), getSpecialFeature(2), getSpecialFeature(3), getSpecialFeature(4),
    findDetailValue('design'), safeValue(comparisonData.department), findDetailValue('occasion'), '', '', '', '', '',
    findDetailValue('neck'), findDetailValue('color') || findDetailValue('colour'), findDetailValue('season'), '',
    findDetailValue('importer'), findDetailValue('material'), '', '', findDetailValue('pockets'),
    findDetailValue('manufacturer'), findDetailValue('fur'), findDetailValue('fit'), findDetailValue('collar'),
    findDetailValue('color') || findDetailValue('colour'), '', '', '', '', '', findDetailValue('weave'), '',
    findDetailValue('theme'), safeValue(findDetailValue('gender') || comparisonData.department), '', '', '', '', '', '', '', '',
    findDetailValue('sleeve'), findDetailValue('size'), '', findDetailValue('pattern'), '', '', '', '', '', '', findDetailValue('weight'),
    '', '', findDetailValue('width'), findDetailValue('height'), findDetailValue('size'), '', findDetailValue('chest'),
    '', findDetailValue('length'), '', '', findDetailValue('length'), '', '', '', '', findDetailValue('package weight'),
    '', findDetailValue('package height'), '', findDetailValue('package length'), '', findDetailValue('package width'),
    '', findDetailValue('country') || findDetailValue('origin'), '', '', '', '', '', '', '', '', 
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // Compliance placeholders
    findDetailValue('fabric'), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // Compliance placeholders
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // Compliance placeholders
    '', 'New', '', '2', '', '', '', '', '', '', '', '1', '', '', '', productPrice, 'INR', '', '', '',
    findDetailValue('M.R.P.'), '', '', '', '', '', '', '', '', '', '', '', '', '', ''
  ];

  return { sheetData: [columnHeaders, dataRow], formattedDate, currentSellerSKU: safeValue(comparisonData.originalAsin) };
};

/**
 * Deduplication logic for technical details
 */
export const getAllDisplayDetails = (comparisonData) => {
  if (!comparisonData) return [];
 
  const allDetails = [];
  const seenLabels = new Set();
 
  const normalizeLabel = (label) => {
    if (!label) return '';
    return label.toString().toLowerCase().trim().replace(/[^\w\s]/gi, '').replace(/\s+/g, '');
  };
 
  const processDetails = (detailsArray, type) => {
    if (!detailsArray || !Array.isArray(detailsArray)) return;
    detailsArray.forEach(item => {
      const label = item.label || item.key || '';
      const value = item.value || '';
      if (!label || !value) return;
      const normalizedLabel = normalizeLabel(label);
      if (seenLabels.has(normalizedLabel)) return;
      if (value === 'N/A' || value === '' || value === 'null' || value === 'undefined') return;
      seenLabels.add(normalizedLabel);
      allDetails.push({ label: label.trim(), value: value, type: type });
    });
  };

  const processNestedDetails = (detailsObject, type) => {
    if (!detailsObject || typeof detailsObject !== 'object') return;
    Object.entries(detailsObject).forEach(([key, value]) => {
      if (!key || !value) return;
      const normalizedLabel = normalizeLabel(key);
      if (seenLabels.has(normalizedLabel)) return;
      if (value === 'N/A' || value === '' || value === 'null' || value === 'undefined') return;
      seenLabels.add(normalizedLabel);
      allDetails.push({ label: key.replace(/([A-Z])/g, ' $1').trim(), value: value, type: type });
    });
  };

  if (comparisonData.acceptedAttributes) processDetails(comparisonData.acceptedAttributes, 'custom');
  if (comparisonData.productDetails) processDetails(comparisonData.productDetails, 'product');
  if (comparisonData.productDetailsArray) processDetails(comparisonData.productDetailsArray, 'product');
  if (comparisonData.manufacturingDetails) processDetails(comparisonData.manufacturingDetails, 'manufacturing');
  if (comparisonData.manufacturingDetailsArray) processDetails(comparisonData.manufacturingDetailsArray, 'manufacturing');
  if (comparisonData.technicalDetails) processNestedDetails(comparisonData.technicalDetails, 'technical');
  if (comparisonData.additionalInfo) processNestedDetails(comparisonData.additionalInfo, 'additional');
  
  if (comparisonData.whatsInBox && comparisonData.whatsInBox !== 'Not specified') {
    allDetails.push({ label: "What's in the Box", value: comparisonData.whatsInBox, source: 'whats-in-box' });
  }

  return allDetails.sort((a, b) => a.label.localeCompare(b.label));
};
