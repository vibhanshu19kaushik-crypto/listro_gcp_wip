// Page 2: Seller List and Data Selection Page


import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSheetData, fetchSellerData } from '../api/frontendApi'; // UPDATED IMPORT
import { ChevronDown, Download, ArrowRight, Loader2, Search, X, CheckCircle, XCircle, Clock } from 'lucide-react';


const DataSelectionPage = () => {
 const [selectedSeller, setSelectedSeller] = useState('');
 const [sellerData, setSellerData] = useState(null);
 const [rawFilteredData, setRawFilteredData] = useState(null);
 const [tableHeaders, setTableHeaders] = useState([]);
 const [isLoading, setIsLoading] = useState(false);
 const [isLoadingDropdown, setIsLoadingDropdown] = useState(true);
 const [error, setError] = useState(null);
 const [availableOptions, setAvailableOptions] = useState([]);
 const [rawSheetData, setRawSheetData] = useState(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [isDropdownOpen, setIsDropdownOpen] = useState(false);
 const [selectedListings, setSelectedListings] = useState(new Set());
 const navigate = useNavigate();


 // Define columns for second table
 const secondTableColumns = [
   { key: 'seller_id', label: 'SELLER ID' },
   { key: 'store_name', label: 'STORE NAME' },
   { key: 'asin1', label: 'ASIN' },
   { key: 'listing_id', label: 'LISTING ID' },
   { key: 'status', label: 'Status' },
   { key: 'claimed_status', label: 'Claimed Status' },
   { key: 'last_date_checked', label: 'Last date checked' }
 ];
  // Fetch available sellers and stores on component mount
 useEffect(() => {
   const loadAvailableSellers = async () => {
     setIsLoadingDropdown(true);
     try {
       const sheetData = await fetchSheetData();
       setRawSheetData(sheetData.data);
      
       // Store headers from API
       if (sheetData.headers && sheetData.headers.length > 0) {
         setTableHeaders(sheetData.headers);
       }
      
       // Create combined options with store names and seller IDs
       const storeMap = new Map();
      
       sheetData.data.forEach(item => {
         // Use exact GCP column names
         const sellerId = item.seller_id;
         const storeName = item.store_name;
        
         if (sellerId && storeName) {
           const key = `${storeName}-${sellerId}`;
           if (!storeMap.has(key)) {
             storeMap.set(key, {
               id: sellerId,
               storeName: storeName,
               displayName: `${storeName} - (${sellerId})`
             });
           }
         }
       });
      
       const combinedOptions = Array.from(storeMap.values());
       setAvailableOptions(combinedOptions);
     } catch (err) {
       console.error('Failed to load sellers from GCP:', err);
       setAvailableOptions([]);
     } finally {
       setIsLoadingDropdown(false);
     }
   };
  
   loadAvailableSellers();
 }, []);


 // Filter options based on search term
 const filteredOptions = availableOptions.filter(option =>
   option.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
   option.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
   option.storeName.toLowerCase().includes(searchTerm.toLowerCase())
 );


 const handleSellerChange = async (sellerId, storeName) => {
   if (!sellerId) {
     setSelectedSeller('');
     setSellerData(null);
     setRawFilteredData(null);
     setError(null);
     setIsDropdownOpen(false);
     setSearchTerm('');
     setSelectedListings(new Set());
     return;
   }


   setSelectedSeller(sellerId);
   setIsLoading(true);
   setError(null);
   setSellerData(null);
   setRawFilteredData(null);
   setSelectedListings(new Set());
   setIsDropdownOpen(false);
   setSearchTerm('');


   try {
     // Fetch seller listings from GCP
     const sellerData = await fetchSellerData(sellerId);
     setRawFilteredData(sellerData.data);
    
     // Set headers from the API response
     if (sellerData.headers && sellerData.headers.length > 0) {
       setTableHeaders(sellerData.headers);
     }
   } catch (err) {
     setError(err.message);
   } finally {
     setIsLoading(false);
   }
 };


 // ADDED: Store selected ASINs when proceeding
 const handleProcess = () => {
   if (selectedSeller && selectedListings.size > 0) {
    
     // Get selected ASINs from checked listings
     const selectedAsins = rawFilteredData
       .filter((item, index) => {
         const listingId = item.listing_id || index.toString();
         return selectedListings.has(listingId);
       })
       .map(item => item.asin1)
       .filter(asin => asin && asin.trim() !== '');
    
     // Store selected ASINs in localStorage
     localStorage.setItem('selectedAsins', JSON.stringify(selectedAsins));
    
     navigate(`/setup/${selectedSeller}`);
   }
 };


 const handleDownload = () => {
   if (!rawFilteredData || rawFilteredData.length === 0) {
     alert('No data available to download');
     return;
   }


   // Use dynamic headers from API
   const headers = tableHeaders.length > 0 ? tableHeaders : Object.keys(rawFilteredData[0] || {});
  
   // Download the exact raw data retrieved from GCP
   const csvContent = [
     headers.join(','),
     ...rawFilteredData.map(item =>
       headers.map(header => `"${item[header] || ''}"`).join(',')
     )
   ].join('\n');
  
   const blob = new Blob([csvContent], { type: 'text/csv' });
   const url = window.URL.createObjectURL(blob);
   const a = document.createElement('a');
   const todayDate = new Date().toISOString().split('T')[0];
   a.href = url;
   a.download = `${selectedSeller}_${todayDate}_gcp_data.csv`;
   a.click();
   window.URL.revokeObjectURL(url);
 };


 // Toggle selection of a listing
 const toggleListingSelection = (listingId) => {
   const newSelected = new Set(selectedListings);
   if (newSelected.has(listingId)) {
     newSelected.delete(listingId);
   } else {
     newSelected.add(listingId);
   }
   setSelectedListings(newSelected);
 };


 // Select all listings
 const selectAllListings = () => {
   if (selectedListings.size === rawFilteredData.length) {
     setSelectedListings(new Set());
   } else {
     const allListingIds = rawFilteredData.map((item, index) => item.listing_id || index.toString()).filter(id => id);
     setSelectedListings(new Set(allListingIds));
   }
 };


 // Get claimed status based on selection
 const getClaimedStatus = (listingId) => {
   return selectedListings.has(listingId) ? 'claimed' : 'unclaimed';
 };


 // Get claimed status badge - automatically updates based on checkbox selection
 const getClaimedStatusBadge = (listingId) => {
   const isSelected = selectedListings.has(listingId);
   const status = isSelected ? 'claimed' : 'unclaimed';
  
   if (status === 'claimed') {
     return (
       <div className="flex flex-col space-y-1">
         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
           <CheckCircle className="w-3 h-3 mr-1" />
           Claimed
         </span>
         <span className="text-xs text-gray-500 italic">(Auto-selected)</span>
       </div>
     );
   } else {
     return (
       <div className="flex flex-col space-y-1">
         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
           <XCircle className="w-3 h-3 mr-1" />
           Unclaimed
         </span>
         <span className="text-xs text-gray-500 italic">(Not selected)</span>
       </div>
     );
   }
 };


 // Clear search and close dropdown
 const clearSearch = () => {
   setSearchTerm('');
 };


 // Get selected store name for display
 const getSelectedDisplayName = () => {
   if (!selectedSeller) return '';
   const selectedOption = availableOptions.find(option => option.id === selectedSeller);
   return selectedOption ? selectedOption.displayName : selectedSeller;
 };


 // Get status badge component
 const getStatusBadge = (status) => {
   const statusLower = (status || '').toLowerCase();
  
   if (statusLower.includes('active')) {
     return (
       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
         <CheckCircle className="w-3 h-3 mr-1" />
         Active
       </span>
     );
   } else if (statusLower.includes('inactive')) {
     return (
       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
         <XCircle className="w-3 h-3 mr-1" />
         Inactive
       </span>
     );
   } else {
     return (
       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
         <Clock className="w-3 h-3 mr-1" />
         {status || 'Unknown'}
       </span>
     );
   }
 };


 // Render first table with all columns and download button
 const renderFirstTable = () => (
   <div
     className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-0 translate-y-4 animate-fadeInUp"
     style={{
       animation: 'fadeInUp 0.6s ease-out forwards'
     }}
   >
     <div className="p-4 border-b border-gray-200">
       <h2 className="text-base font-semibold text-gray-900">
         Full Listing Data for {getSelectedDisplayName()}
       </h2>
       <p className="text-gray-600 mt-1 text-m">
         Listings Found: <span className="font-bold text-blue-600">{rawFilteredData.length}</span>
       </p>
     </div>


     {/* Data Table */}
     <div className="overflow-y-auto max-h-[500px]">
       <table className="w-full">
         <thead className="bg-gray-50 sticky top-0">
           <tr>
             {tableHeaders.length > 0 ? (
               tableHeaders.map((header, index) => (
                 <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                   {header}
                 </th>
               ))
             ) : (
               // Fallback headers
               <>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                   Store Name
                 </th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                   Item Name
                 </th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                   Price
                 </th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                   Quantity
                 </th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                   Status
                 </th>
               </>
             )}
           </tr>
         </thead>
         <tbody className="bg-white divide-y divide-gray-200">
           {rawFilteredData.map((item, index) => (
             <tr key={index} className="hover:bg-gray-50">
               {tableHeaders.length > 0 ? (
                 tableHeaders.map((header, colIndex) => (
                   <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                     {header === 'image_url' && item[header] ? (
                       <img
                         src={item[header]}
                         alt="Product"
                         className="h-10 w-10 object-cover rounded"
                       />
                     ) : header === 'item_name' ? (
                       <span className="font-medium text-gray-900">
                         {item[header] || '-'}
                       </span>
                     ) : (
                       <span>
                         {item[header] || '-'}
                       </span>
                     )}
                   </td>
                 ))
               ) : (
                 // Fallback content
                 <>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     {item.store_name || '-'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                     {item.item_name || '-'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                     {item.price || '-'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                     {item.quantity || '-'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                     {item.status || '-'}
                   </td>
                 </>
               )}
             </tr>
           ))}
         </tbody>
       </table>
     </div>


     {/* Download Button */}
     <div className="p-4 bg-gray-50 border-t border-gray-200">
       <div className="flex items-center justify-center">
         <button
           onClick={handleDownload}
           className="flex items-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
         >
           <Download className="h-5 w-5" />
           <span>Download Full Data Sheet</span>
         </button>
       </div>
     </div>
   </div>
 );


 // Render second table with checkbox and specific columns
 const renderSecondTable = () => (
   <div
     className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-0 translate-y-4 animate-fadeInUp"
     style={{
       animation: 'fadeInUp 0.6s ease-out forwards',
       animationDelay: '0.2s'
     }}
   >
     <div className="p-4 border-b border-gray-200 flex justify-between items-center">
       <div>
         <h2 className="text-base font-semibold text-gray-900">
           Select Listings to Optimize
         </h2>
         <p className="text-gray-600 mt-1 text-sm">
           Selected: <span className="font-bold text-blue-600">{selectedListings.size}</span> of {rawFilteredData.length} listings
         </p>
         <p className="text-xs text-gray-500 mt-1">
           Selected listings will automatically show as "Claimed" status
         </p>
       </div>
       <div className="flex items-center space-x-4">
         <button
           onClick={selectAllListings}
           className="text-sm text-blue-600 hover:text-blue-800 font-medium"
         >
           {selectedListings.size === rawFilteredData.length ? 'Deselect All' : 'Select All'}
         </button>
         <button
           onClick={handleProcess}
           disabled={selectedListings.size === 0}
           className={`flex items-center space-x-2 px-6 py-2 rounded-md text-sm font-medium transition-colors ${
             selectedListings.size === 0
               ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
               : 'bg-blue-600 text-white hover:bg-blue-700'
           }`}
         >
           <span>Proceed with Selected ({selectedListings.size})</span>
           <ArrowRight className="h-4 w-4" />
         </button>
       </div>
     </div>


     {/* Data Table */}
     <div className="overflow-y-auto max-h-[500px]">
       <table className="w-full">
         <thead className="bg-gray-50 sticky top-0">
           <tr>
             <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
               <input
                 type="checkbox"
                 checked={selectedListings.size === rawFilteredData.length && rawFilteredData.length > 0}
                 onChange={selectAllListings}
                 className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
               />
             </th>
             {secondTableColumns.map((column, index) => (
               <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                 {column.label}
               </th>
             ))}
           </tr>
         </thead>
         <tbody className="bg-white divide-y divide-gray-200">
           {rawFilteredData.map((item, index) => {
             const listingId = item.listing_id || index.toString();
             const isSelected = selectedListings.has(listingId);
            
             return (
               <tr
                 key={index}
                 className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
               >
                 {/* Checkbox column */}
                 <td className="px-6 py-4 whitespace-nowrap">
                   <input
                     type="checkbox"
                     checked={isSelected}
                     onChange={() => toggleListingSelection(listingId)}
                     className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                   />
                 </td>
                
                 {/* Data columns */}
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                   {item.seller_id || '-'}
                 </td>
                
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                   {item.store_name || '-'}
                 </td>
                
                 <td className="px-6 py-4 whitespace-nowrap text-sm">
                   <span className="font-mono font-semibold text-blue-600">
                     {item.asin1 || '-'}
                   </span>
                 </td>
                
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                   {item.listing_id || '-'}
                 </td>
                
                 <td className="px-6 py-4 whitespace-nowrap text-sm">
                   {getStatusBadge(item.status)}
                 </td>
                
                 {/* Claimed Status - automatically updates based on checkbox selection */}
                 <td className="px-6 py-4 whitespace-nowrap text-sm">
                   {getClaimedStatusBadge(listingId)}
                 </td>
                
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                   {item.last_date_checked
                     ? new Date(item.last_date_checked).toLocaleDateString()
                     : '-'}
                 </td>
               </tr>
             );
           })}
         </tbody>
       </table>
     </div>


     {/* Footer with selection info */}
     <div className="p-4 bg-gray-50 border-t border-gray-200">
       <div className="flex items-center justify-between">
         <div className="text-sm text-gray-600">
           <span className="font-medium">{selectedListings.size}</span> listing(s) selected for optimization
           <span className="ml-4 text-xs text-gray-500">
             ({selectedListings.size} claimed, {rawFilteredData.length - selectedListings.size} unclaimed)
           </span>
         </div>
         <div className="flex items-center space-x-3">
           <button
             onClick={() => setSelectedListings(new Set())}
             className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
           >
             Clear Selection
           </button>
           <button
             onClick={handleProcess}
             disabled={selectedListings.size === 0}
             className={`flex items-center space-x-2 px-6 py-2 rounded-md text-sm font-medium transition-colors ${
               selectedListings.size === 0
                 ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                 : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
             }`}
           >
             <span>Proceed with Selected Listings</span>
             <ArrowRight className="h-4 w-4" />
           </button>
         </div>
       </div>
     </div>
   </div>
 );


 return (
   <div className="min-h-screen bg-gray-50">
     <div className="max-w-7xl mx-auto px-6 py-8">
       <div className="space-y-8">
         {/* Header */}
         <div className="text-center space-y-3">
           <h1 className="text-2xl font-bold text-gray-900">Select Seller Data</h1>
           <p className="text-base text-gray-600 max-w-2xl mx-auto">
             Search and select by Store Name or Seller ID to load listing data and begin the optimization process.
           </p>
         </div>


         {/* Seller Selection */}
         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
           <div className="max-w-2xl mx-auto">
             <label htmlFor="seller-select" className="block text-sm font-medium text-gray-700 mb-2">
               Search Store or Seller
             </label>
            
             {/* Custom Dropdown */}
             <div className="relative">
               {/* Dropdown Trigger */}
               <button
                 onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                 className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left text-sm flex items-center justify-between cursor-pointer hover:bg-gray-50"
                 disabled={isLoading || isLoadingDropdown}
               >
                 <span className="truncate">
                   {selectedSeller ? getSelectedDisplayName() : 'Select a store or seller...'}
                 </span>
                 {isLoadingDropdown ? (
                   <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                 ) : (
                   <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                 )}
               </button>


               {/* Dropdown Menu */}
               {isDropdownOpen && (
                 <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
                   {/* Search Input */}
                   <div className="p-2 border-b border-gray-200">
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                       <input
                         type="text"
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         placeholder="Search by store name or seller ID..."
                         className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                         autoFocus
                       />
                       {searchTerm && (
                         <button
                           onClick={clearSearch}
                           className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                         >
                           <X className="h-4 w-4" />
                         </button>
                       )}
                     </div>
                   </div>


                   {/* Options List */}
                   <div className="overflow-y-auto max-h-60">
                     {filteredOptions.length === 0 ? (
                       <div className="px-4 py-3 text-sm text-gray-500 text-center">
                         {isLoadingDropdown ? 'Loading...' : 'No stores or sellers found'}
                       </div>
                     ) : (
                       filteredOptions.map((option) => (
                         <button
                           key={`${option.storeName}-${option.id}`}
                           onClick={() => handleSellerChange(option.id, option.storeName)}
                           className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                             selectedSeller === option.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                           }`}
                         >
                           <div className="font-medium">{option.storeName}</div>
                           <div className="text-xs text-gray-500 mt-1">Seller ID: {option.id}</div>
                         </button>
                       ))
                     )}
                   </div>


                   {/* Results Count */}
                   {filteredOptions.length > 0 && (
                     <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
                       {filteredOptions.length} result{filteredOptions.length !== 1 ? 's' : ''} found
                     </div>
                   )}
                 </div>
               )}
             </div>


             {/* Selected Info */}
             {selectedSeller && (
               <div className="mt-3 p-3 bg-blue-50 rounded-md">
                 <div className="text-sm text-blue-700">
                   <span className="font-medium">Selected: </span>
                   {getSelectedDisplayName()}
                 </div>
               </div>
             )}
           </div>
         </div>


         {/* Loading State */}
         {isLoading && (
           <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
             <div className="flex flex-col items-center justify-center space-y-4">
               <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
               <div className="text-center">
                 <h3 className="text-lg font-medium text-gray-900">Loading Product Data</h3>
                 <p className="text-gray-600">Fetching data for {getSelectedDisplayName()}...</p>
               </div>
               {/* Skeleton loader */}
               <div className="w-full max-w-4xl space-y-3 mt-6">
                 {[...Array(5)].map((_, i) => (
                   <div key={i} className="animate-pulse flex space-x-4 p-4 bg-gray-50 rounded">
                     <div className="h-4 bg-gray-300 rounded w-20"></div>
                     <div className="h-4 bg-gray-300 rounded flex-1"></div>
                     <div className="h-4 bg-gray-300 rounded w-16"></div>
                     <div className="h-4 bg-gray-300 rounded w-20"></div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
         )}


         {/* Error State */}
         {error && (
           <div className="bg-red-50 border border-red-200 rounded-lg p-6">
             <div className="text-center">
               <h3 className="text-lg font-medium text-red-900">Error Loading Data</h3>
               <p className="text-red-700 mt-2">{error}</p>
               <button
                 onClick={() => handleSellerChange(selectedSeller)}
                 className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
               >
                 Try Again
               </button>
             </div>
           </div>
         )}


         {/* Data Loaded State - Two Tables */}
         {rawFilteredData && !isLoading && (
           <>
             {/* First Table - Full data with download button */}
             {renderFirstTable()}


             {/* Second Table - Selection table with checkboxes */}
             <div className="mt-8">
               {renderSecondTable()}
             </div>
           </>
         )}


         {/* How it Works Section */}
         <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
           <div className="text-center mb-6">
             <h2 className="text-xl font-bold text-gray-900 mb-2">How It Works</h2>
             <p className="text-gray-600 text-sm">Follow these simple steps to optimize your Amazon product listings</p>
           </div>
          
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="text-center p-4 bg-blue-50 rounded-lg">
               <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                 1
               </div>
               <h3 className="font-semibold text-gray-900 mb-2 text-sm">Select Data</h3>
               <p className="text-gray-600 text-xs">Search and select by Store Name or Seller ID to load your listing data</p>
             </div>
            
             <div className="text-center p-4 bg-green-50 rounded-lg">
               <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                 2
               </div>
               <h3 className="font-semibold text-gray-900 mb-2 text-sm">Compare & Setup</h3>
               <p className="text-gray-600 text-xs">View the gold standard and decide whether to edit existing or create new listings</p>
             </div>
            
             <div className="text-center p-4 bg-purple-50 rounded-lg">
               <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                 3
               </div>
               <h3 className="font-semibold text-gray-900 mb-2 text-sm">Optimization</h3>
               <p className="text-gray-600 text-xs">Use Listro tools to enhance titles, descriptions, and generate better product listing images</p>
             </div>
            
             <div className="text-center p-4 bg-orange-50 rounded-lg">
               <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                 4
               </div>
               <h3 className="font-semibold text-gray-900 mb-2 text-sm">Publish & Track</h3>
               <p className="text-gray-600 text-xs">Review final changes and publish your optimized listings to Amazon</p>
             </div>
           </div>
         </div>
       </div>
     </div>


     {/* Close dropdown when clicking outside */}
     {isDropdownOpen && (
       <div
         className="fixed inset-0 z-40"
         onClick={() => setIsDropdownOpen(false)}
       />
     )}


     <style jsx>{`
       @keyframes fadeInUp {
         from {
           opacity: 0;
           transform: translateY(16px);
         }
         to {
           opacity: 1;
           transform: translateY(0);
         }
       }
     `}</style>
   </div>
 );
};


export default DataSelectionPage;

