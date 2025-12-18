// Page 2: Seller List and Data Selection Page
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSheetData, fetchSellerData, fetchResourceAllocation, claimListings, fetchExistingAllocationsFromSheet } from '../api/frontendApi';
import { ChevronDown, Download, ArrowRight, Loader2, Search, X, CheckCircle, XCircle, Clock, Edit3, Plus, Database, AlertTriangle, User, Calendar, Timer, Check, Lock } from 'lucide-react';

const DataSelectionPage = () => {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [sellerData, setSellerData] = useState(null);
  const [rawFilteredData, setRawFilteredData] = useState(null);
  const [rawResourceData, setRawResourceData] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [resourceTableHeaders, setResourceTableHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDropdown, setIsLoadingDropdown] = useState(true);
  const [error, setError] = useState(null);
  const [availableOptions, setAvailableOptions] = useState([]);
  const [rawSheetData, setRawSheetData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedListings, setSelectedListings] = useState(new Set());
  const [actionType, setActionType] = useState(null); // 'edit' or 'new'
  const [selectionError, setSelectionError] = useState(null);
  const [isSubmittingClaims, setIsSubmittingClaims] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [alreadyClaimedListings, setAlreadyClaimedListings] = useState([]);
  const [userActiveClaimCount, setUserActiveClaimCount] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [userClaimedListings, setUserClaimedListings] = useState([]);
  const navigate = useNavigate();

  // Define BigQuery table names
  const TABLE_SOURCES = {
    TABLE_1: 'ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA',
    TABLE_2: 'ops-excellence.Listro_Listing.Resource_Allocation'
  };

  // Helper function to safely get values with multiple possible column names
  const getColumnValue = (item, possibleKeys) => {
    if (!item) return '';
    for (const key of possibleKeys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
        return item[key];
      }
    }
    return '';
  };

  // Get user email and active claim count on component mount
  useEffect(() => {
    const getUserInfo = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          const email = user.email;
          setUserEmail(email);
          console.log('👤 User email loaded:', email);
          
          // Load user's claimed listings
          loadUserClaimedListings(email);
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
    };
    
    getUserInfo();
  }, []);

  // Load user's claimed listings from Google Sheet
  const loadUserClaimedListings = async (email) => {
    try {
      const response = await fetch('/api/user-claimed-asins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserClaimedListings(data.claimedAsins || []);
          
          // Count active claims (no End_Time)
          const activeClaims = data.claimedAsins.filter(asin => !asin.endTime || asin.endTime.trim() === '').length;
          setUserActiveClaimCount(activeClaims);
          console.log(`📊 User has ${activeClaims} active claims out of 10 allowed`);
        }
      }
    } catch (error) {
      console.error('Error loading user claimed listings:', error);
    }
  };

  // Fetch available sellers and stores on component mount
  useEffect(() => {
    const loadAvailableSellers = async () => {
      setIsLoadingDropdown(true);
      try {
        const sheetData = await fetchSheetData();
        setRawSheetData(sheetData.data);
       
        if (sheetData.headers && sheetData.headers.length > 0) {
          setTableHeaders(sheetData.headers);
        }
       
        const userData = localStorage.getItem('user');
        const userEmail = userData ? (JSON.parse(userData).email || '').toLowerCase() : '';

        let allowedSellerIds = new Set();
        let allocationsFetched = false;
        try {
          const allocRes = await fetchExistingAllocationsFromSheet();
          if (allocRes && allocRes.data && Array.isArray(allocRes.data)) {
            allocationsFetched = true;
            
            let activeClaims = 0;
            
            allocRes.data.forEach(a => {
              const email = (a.Resource_Email || a.resource_email || '').toString().toLowerCase();
              const status = (a.Allocation_Status || a.allocation_status || '').toString().toUpperCase();
              const sellerId = a.Seller_ID || a.seller_id || a.SellerId || a.sellerId;
              const endTime = a.End_Time || a.end_time || '';
              
              if (email && userEmail && email === userEmail) {
                if (status === 'ALLOCATED' && (!endTime || endTime.trim() === '')) {
                  activeClaims++;
                }
                
                if (status === 'ALLOCATED' && sellerId) {
                  allowedSellerIds.add(String(sellerId));
                }
              }
            });
            
            setUserActiveClaimCount(activeClaims);
            console.log(`📊 User has ${activeClaims} active claims out of 10 allowed`);
          } else {
            allocationsFetched = true;
          }
        } catch (allocErr) {
          console.warn('Could not fetch allocations, falling back to full seller list:', allocErr);
        }

        const storeMap = new Map();
       
        sheetData.data.forEach(item => {
          const sellerId = item.seller_id;
          const storeName = item.store_name;
         
          if (sellerId && storeName) {
            if (allocationsFetched && allowedSellerIds.size > 0 && !allowedSellerIds.has(String(sellerId))) {
              return;
            }

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
        
        console.log(`✅ Loaded ${combinedOptions.length} sellers for user ${userEmail}`);
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
      setActionType(null);
      setAlreadyClaimedListings([]);
      return;
    }

    setSelectedSeller(sellerId);
    setIsLoading(true);
    setError(null);
    setSellerData(null);
    setRawFilteredData(null);
    setSelectedListings(new Set());
    setActionType(null);
    setAlreadyClaimedListings([]);
    setIsDropdownOpen(false);
    setSearchTerm('');

    try {
      const sellerData = await fetchSellerData(sellerId);
      setRawFilteredData(sellerData.data);
     
      if (sellerData.headers && sellerData.headers.length > 0) {
        setTableHeaders(sellerData.headers);
      }
     
      try {
        const resourceData = await fetchResourceAllocation(sellerId, storeName, [
          'store_name',
          'seller_id',
          'asin1',
          'listing-id',
          'status',
          'Claimed_Status',
          'Email_id',
          'Last_Claim_Timestamp',
          'Start_Time',
          'End_Time'
        ]);
        
        console.log('📊 Raw resource allocation data response:', {
          dataLength: resourceData.data?.length,
          sampleRow: resourceData.data?.[0]
        });
        
        const processedData = resourceData.data || [];
        
        if (processedData.length > 0) {
          const firstRow = processedData[0];
          console.log('🔍 Actual column names in data:', Object.keys(firstRow));
          console.log('📋 Sample row values:', firstRow);
        }
        
        const claimed = processedData.filter(item => {
          const claimedStatus = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
          return claimedStatus === 'Claimed' && item['listing-id'];
        }).map(item => ({
          listingId: item['listing-id'],
          claimedBy: getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || 'another user',
          claimedAt: getColumnValue(item, ['Last_Claim_Timestamp', 'last_claim_timestamp']) || 'recently',
          endTime: getColumnValue(item, ['End_Time', 'end_time']) || ''
        }));
       
        if (claimed.length > 0) {
          setAlreadyClaimedListings(claimed);
        }
        
        const userClaims = processedData.filter(item => {
          const listingId = item['listing-id'];
          const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
          const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
          const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
          const isCompleted = endTime && endTime.trim() !== '';
          
          return listingId && isClaimedByUser && !isCompleted;
        });
        
        if (userClaims.length > 0) {
          const newSelected = new Set();
          userClaims.forEach(item => {
            if (item['listing-id']) {
              newSelected.add(item['listing-id']);
            }
          });
          setSelectedListings(newSelected);
          setActionType('edit');
        }
        
        setRawResourceData(processedData);
        
        if (processedData.length > 0) {
          const firstRowKeys = Object.keys(processedData[0]);
          setResourceTableHeaders(firstRowKeys);
          console.log('📋 Resource table headers set:', firstRowKeys);
        } else {
          setResourceTableHeaders([
            'store_name',
            'seller_id',
            'asin1',
            'listing-id',
            'Claimed_Status',
            'Email_id',
            'Last_Claim_Timestamp',
            'Start_Time',
            'End_Time'
          ]);
        }
       
      } catch (resourceErr) {
        console.error('❌ Failed to load resource allocation data:', resourceErr);
        setRawResourceData([]);
        setResourceTableHeaders([]);
        setAlreadyClaimedListings([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Edit Existing Listing
  const handleEditExisting = async () => {
    if (!selectedSeller || selectedListings.size === 0) {
      setSubmitError('Please select at least one listing');
      return;
    }

    const alreadyClaimedByOthers = [];
   
    rawResourceData.forEach(item => {
      if (selectedListings.has(item['listing-id'])) {
        const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
        const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
        const claimedStatus = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
        const isClaimed = claimedStatus === 'Claimed';
        const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
        const isCompleted = endTime && endTime.trim() !== '';
        
        if (isClaimed && !isClaimedByUser && !isCompleted) {
          alreadyClaimedByOthers.push({
            listingId: item['listing-id'],
            claimedBy: claimedBy || 'another user'
          });
        }
      }
    });
   
    if (alreadyClaimedByOthers.length > 0) {
      setSubmitError(
        `${alreadyClaimedByOthers.length} listing(s) are already claimed by other users. ` +
        `Please unselect them and try again.`
      );
      return;
    }

    const remainingSlots = 10 - userActiveClaimCount;
    if (selectedListings.size > remainingSlots) {
      setSubmitError(
        `You can only claim ${remainingSlots} more listing(s). ` +
        `You currently have ${userActiveClaimCount} active claims out of 10 allowed. ` +
        `Please unselect some listings.`
      );
      return;
    }

    setIsSubmittingClaims(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const userData = localStorage.getItem('user');
      if (!userData) {
        throw new Error('User not logged in. Please log in to claim listings.');
      }

      const user = JSON.parse(userData);
      const userEmail = user.email;

      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }

      const selectedRows = rawResourceData.filter((item) => {
        const listingId = item['listing-id'];
        const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
        const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
        const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
        const isCompleted = endTime && endTime.trim() !== '';
        
        return listingId && selectedListings.has(listingId) && !isCompleted && !isClaimedByUser;
      });

      if (selectedRows.length === 0) {
        const asins = rawResourceData
          .filter(item => selectedListings.has(item['listing-id']))
          .map(item => item.asin1)
          .filter(asin => asin && asin.trim() !== '');
        
        localStorage.setItem('selectedAsins', JSON.stringify(asins));
        localStorage.setItem('actionType', 'edit');
        
        navigate(`/setup/${selectedSeller}`);
        return;
      }

      const claimResult = await claimListings({
        sellerId: selectedSeller,
        listings: selectedRows.map(item => ({
          'listing-id': item['listing-id'],
          asin1: item.asin1,
          store_name: getColumnValue(item, ['store_name', 'storeName', 'Store Name']),
          seller_id: getColumnValue(item, ['seller_id', 'sellerId', 'Seller_ID']),
        })),
        userEmail: userEmail,
        claimedAt: new Date().toISOString(),
      });

      console.log('✅ Listings claimed successfully:', claimResult);

      if (claimResult.error && claimResult.error.includes('You can only claim up to 10 listings')) {
        setSubmitError(claimResult.error);
        if (claimResult.currentActiveClaims !== undefined) {
          setUserActiveClaimCount(claimResult.currentActiveClaims);
        }
        return;
      }

      if (claimResult.currentActiveClaims !== undefined) {
        setUserActiveClaimCount(claimResult.currentActiveClaims);
      }

      const claimedCount = claimResult.claimedCount || selectedRows.length;
      const currentActiveClaims = claimResult.currentActiveClaims || (userActiveClaimCount + claimedCount);
      setSuccessMessage(
        `✅ Successfully claimed ${claimedCount} listing(s). ` +
        `You now have ${currentActiveClaims} active claims out of 10 allowed.`
      );

      const selectedAsins = [...selectedRows, ...rawResourceData.filter(item => {
        const listingId = item['listing-id'];
        const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
        const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
        return listingId && selectedListings.has(listingId) && isClaimedByUser;
      })]
        .map(item => item.asin1)
        .filter(asin => asin && asin.trim() !== '');
     
      localStorage.setItem('selectedAsins', JSON.stringify(selectedAsins));
      localStorage.setItem('actionType', 'edit');
      setActionType('edit');
     
      try {
        const selectedOption = availableOptions.find(option => option.id === selectedSeller);
        if (selectedOption) {
          const freshResourceData = await fetchResourceAllocation(
            selectedSeller,
            selectedOption.storeName,
            ['store_name', 'seller_id', 'asin1', 'listing-id', 'status', 'Claimed_Status', 'Email_id', 'Last_Claim_Timestamp', 'Start_Time', 'End_Time']
          );
          setRawResourceData(freshResourceData.data || []);
         
          const freshClaimed = freshResourceData.data.filter(item =>
            getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']) === 'Claimed' && item['listing-id']
          ).map(item => ({
            listingId: item['listing-id'],
            claimedBy: getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || 'another user',
            claimedAt: getColumnValue(item, ['Last_Claim_Timestamp', 'last_claim_timestamp']) || 'recently'
          }));
          setAlreadyClaimedListings(freshClaimed);
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh claim status:', refreshErr);
      }
     
      setSelectedListings(new Set());
     
      setTimeout(() => {
        navigate(`/setup/${selectedSeller}`);
      }, 3000);

    } catch (err) {
      console.error('❌ Error claiming listings:', err);
      setSubmitError(err.message || 'Failed to claim listings. Please try again.');
    } finally {
      setIsSubmittingClaims(false);
    }
  };

  // Handle Create New Listing
  const handleCreateNew = () => {
    if (selectedSeller) {
      localStorage.removeItem('selectedAsins');
      localStorage.setItem('actionType', 'new');
      setActionType('new');
      navigate(`/setup/${selectedSeller}`);
    }
  };

  const handleDownload = () => {
    if (!rawFilteredData || rawFilteredData.length === 0) {
      alert('No data available to download');
      return;
    }

    const headers = tableHeaders.length > 0 ? tableHeaders : Object.keys(rawFilteredData[0] || {});
   
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
    if (!listingId) return;
   
    const listingItem = rawResourceData.find(item => item['listing-id'] === listingId);
    if (!listingItem) return;
    
    const claimedBy = getColumnValue(listingItem, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
    const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
    const claimedStatus = getColumnValue(listingItem, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
    const isClaimed = claimedStatus === 'Claimed';
    const endTime = getColumnValue(listingItem, ['End_Time', 'end_time']) || '';
    const isCompleted = endTime && endTime.trim() !== '';
    
    if (isCompleted) {
      setSelectionError('This listing has been completed and cannot be selected');
      setTimeout(() => setSelectionError(null), 3000);
      return;
    }
    
    if (isClaimed && !isClaimedByUser) {
      setSelectionError(`This listing is already claimed`);
      setTimeout(() => setSelectionError(null), 3000);
      return;
    }
   
    const newSelected = new Set(selectedListings);
    if (newSelected.has(listingId)) {
      newSelected.delete(listingId);
      setSelectionError(null);
    } else {
      if (isClaimedByUser) {
        newSelected.add(listingId);
        setSelectionError(null);
      } else {
        const remainingSlots = 10 - userActiveClaimCount;
        if (newSelected.size >= remainingSlots) {
          setSelectionError(
            `Maximum ${remainingSlots} listings can be claimed. ` +
            `You have ${userActiveClaimCount} active claims. ` +
            `Total active claims cannot exceed 10.`
          );
          setTimeout(() => setSelectionError(null), 3000);
          return;
        }
        newSelected.add(listingId);
        setSelectionError(null);
      }
    }
    setSelectedListings(newSelected);
   
    if (newSelected.size > 0) {
      setActionType('edit');
    } else {
      setActionType('new');
    }
  };

  // Get claimed status badge
  const getClaimedStatusBadge = (listingId, isClaimed, claimedBy, endTime) => {
    const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
    const isCompleted = endTime && endTime.trim() !== '';
    
    if (isCompleted) {
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="w-3 h-3 mr-1" />
            Completed
          </span>
          <span className="text-xs text-gray-500 italic">
            Optimization finished
          </span>
        </div>
      );
    }
    
    if (isClaimed && isClaimedByUser) {
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Claimed by You
          </span>
          <span className="text-xs text-gray-500 italic">
            (Ready for optimization)
          </span>
        </div>
      );
    }
    
    if (isClaimed && !isClaimedByUser) {
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
            <Lock className="w-3 h-3 mr-1" />
            Claimed
          </span>
          <span className="text-xs text-gray-500 italic">
            Not available
          </span>
        </div>
      );
    }
   
    const isSelected = selectedListings.has(listingId);
   
    if (isSelected) {
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Selected for Claim
          </span>
          <span className="text-xs text-gray-500 italic">
            (Click to unselect)
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col space-y-1">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Available
          </span>
          <span className="text-xs text-gray-500 italic">
            (Click to select)
          </span>
        </div>
      );
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp || timestamp.trim() === '') return '-';
    
    if (timestamp.includes('-') && timestamp.includes(':')) {
      try {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      } catch (e) {
        return timestamp;
      }
    }
    
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (e) {}
    
    return timestamp;
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

  // Format BigQuery table name for display
  const formatTableName = (fullTableName) => {
    const parts = fullTableName.split('.');
    return parts[parts.length - 1];
  };

  // Get completion status badge
  const getCompletionBadge = (endTime) => {
    if (!endTime || endTime.trim() === '') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Timer className="w-3 h-3 mr-1" />
          In Progress
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Check className="w-3 h-3 mr-1" />
          Completed
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Full Listing Data for {getSelectedDisplayName()}
            </h2>
            <p className="text-gray-600 mt-1 text-sm">
              Listings Found: <span className="font-bold text-blue-600">{rawFilteredData.length}</span>
            </p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-md">
              <Database className="h-3 w-3" />
              <span>Table: {formatTableName(TABLE_SOURCES.TABLE_1)}</span>
            </div>
            <div className="text-xs text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
              {TABLE_SOURCES.TABLE_1}
            </div>
          </div>
        </div>
        <p className="text-gray-500 text-sm mt-2">Read-only comprehensive view of all seller listings</p>
      </div>

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
        animationDelay: '0.2s',
      }}
    >
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Select Listings to Optimize
            </h2>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <div className="text-gray-600 mt-1 text-sm">
                Selected: <span className="font-bold text-blue-600">{selectedListings.size} of {rawResourceData.filter(item => {
                  const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
                  const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
                  const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
                  const isCompleted = endTime && endTime.trim() !== '';
                  const claimedStatus = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
                  const isClaimed = claimedStatus === 'Claimed';
                  
                  return !isCompleted && (!isClaimed || isClaimedByUser);
                }).length}</span> available listings
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 font-medium">
                  <User className="h-4 w-4 inline mr-1" />
                  {userEmail}
                </span>
                <span className="text-gray-500">|</span>
                <span className="text-gray-700">
                  Active Claims: <span className="font-bold text-green-600">{userActiveClaimCount}/10</span>
                </span>
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Selected listings will be claimed exclusively for you (max 10 active claims per user)
            </p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-md">
              <Database className="h-3 w-3" />
              <span>Table: {formatTableName(TABLE_SOURCES.TABLE_2)}</span>
            </div>
            <div className="text-xs text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
              {TABLE_SOURCES.TABLE_2}
            </div>
          </div>
        </div>
      </div>

      {rawResourceData.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-gray-500">No resource allocation data available for the selected store.</p>
        </div>
      ) : (
        <>
          {alreadyClaimedListings.length > 0 && (
            <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    {alreadyClaimedListings.length} listing(s) are already claimed
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    These listings are locked and cannot be selected. You can only claim available listings.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    {/* Checkbox column header */}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">
                    STORE NAME
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ASIN
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LISTING ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    STATUS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                    CLAIMED STATUS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CLAIMED BY
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                    Last Claim (IST)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                    Start Time (IST)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                    End Time (IST)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completion Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rawResourceData.map((item, rowIndex) => {
                  const listingId = getColumnValue(item, ['listing-id', 'listing_id', 'listingId']);
                  const claimedStatus = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
                  const isClaimed = claimedStatus === 'Claimed';
                  const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
                  const isClaimedByUser = claimedBy.toLowerCase() === userEmail.toLowerCase();
                  const isSelected = listingId ? selectedListings.has(listingId) : false;
                  
                  const lastClaimTime = formatTimestamp(
                    getColumnValue(item, ['Last_Claim_Timestamp', 'last_claim_timestamp'])
                  );
                  
                  const startTime = formatTimestamp(
                    getColumnValue(item, ['Start_Time', 'start_time'])
                  );
                  
                  const endTime = formatTimestamp(
                    getColumnValue(item, ['End_Time', 'end_time'])
                  );
                  
                  const isCompleted = endTime && endTime !== '-';
                  const isEditable = isClaimedByUser && !isCompleted;
                 
                  const rowClass = isCompleted 
                    ? 'bg-green-50 hover:bg-green-100' 
                    : isClaimedByUser 
                      ? 'bg-blue-50 hover:bg-blue-100' 
                      : 'hover:bg-gray-50';
                 
                  return (
                    <tr key={rowIndex} className={`${rowClass} transition-colors duration-200`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {listingId && !isCompleted && (
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleListingSelection(listingId)}
                              className={`h-4 w-4 ${isClaimed && !isClaimedByUser ? 'bg-gray-300 cursor-not-allowed' : 'text-blue-600 border-gray-300'} rounded focus:ring-blue-500`}
                              disabled={isClaimed && !isClaimedByUser}
                              title={isClaimed && !isClaimedByUser ? `Claimed by another user` : ''}
                            />
                          </div>
                        )}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getColumnValue(item, ['store_name', 'storeName', 'Store Name']) || '-'}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {getColumnValue(item, ['asin1', 'asin', 'ASIN']) || '-'}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {listingId || '-'}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {getStatusBadge(getColumnValue(item, ['status', 'Status']))}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {getClaimedStatusBadge(listingId, isClaimed, claimedBy, getColumnValue(item, ['End_Time', 'end_time']))}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {isClaimedByUser ? (
                          <span className="text-blue-600 font-medium">You</span>
                        ) : isClaimed ? (
                          <span className="text-gray-600">Another user</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 min-w-[180px]">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 text-gray-400 mr-1 flex-shrink-0" />
                          <span className="truncate">{lastClaimTime}</span>
                        </div>
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 min-w-[180px]">
                        <div className="flex items-center">
                          <Timer className="h-3 w-3 text-blue-400 mr-1 flex-shrink-0" />
                          <span className="truncate">{startTime}</span>
                        </div>
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 min-w-[180px]">
                        <div className="flex items-center">
                          <CheckCircle className="h-3 w-3 text-purple-400 mr-1 flex-shrink-0" />
                          <span className="truncate">{endTime}</span>
                        </div>
                      </td>
                     
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {getCompletionBadge(getColumnValue(item, ['End_Time', 'end_time']))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">Select Seller Data</h1>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              Search and select by Store Name or Seller ID to load listing data and begin the optimization process.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="max-w-2xl mx-auto">
              <label htmlFor="seller-select" className="block text-sm font-medium text-gray-700 mb-2">
                Search Store or Seller
              </label>
             
              <div className="relative">
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

                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
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

                    {filteredOptions.length > 0 && (
                      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
                        {filteredOptions.length} result{filteredOptions.length !== 1 ? 's' : ''} found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedSeller && (
                <div className="mt-3 p-3 bg-blue-50 rounded-md">
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">Selected: </span>
                    {getSelectedDisplayName()}
                  </div>
                  {alreadyClaimedListings.length > 0 && (
                    <div className="mt-2 text-xs text-amber-700">
                      <span className="font-medium">Note: </span>
                      {alreadyClaimedListings.length} listing(s) in this store are already claimed
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-900">Loading Product Data</h3>
                  <p className="text-gray-600">Fetching data for {getSelectedDisplayName()}...</p>
                </div>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-red-900">Error Loading Data</h3>
                <p className="text-red-700 mt-2">{error}</p>
                <button
                  onClick={() => {
                    const selectedOption = availableOptions.find(option => option.id === selectedSeller);
                    if (selectedOption) {
                      handleSellerChange(selectedSeller, selectedOption.storeName);
                    }
                  }}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {rawFilteredData && !isLoading && (
            <>
              {renderFirstTable()}

              <div className="mt-8">
                {renderSecondTable()}
               
                {selectionError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      <p className="text-red-700 text-sm font-medium">{selectionError}</p>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      <p className="text-red-700 text-sm font-medium">{submitError}</p>
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="fixed top-4 right-4 bg-green-50 border border-green-300 rounded-lg p-4 shadow-lg max-w-sm z-50 animate-pulse">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <p className="text-green-800 font-medium">{successMessage}</p>
                    </div>
                  </div>
                )}
               
                <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      {selectedListings.size === 0 ? (
                        <div>
                          <p className="font-medium">
                            You have <span className="text-green-600">{userActiveClaimCount} active claims</span> out of 10 allowed
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Select available listings to claim for optimization (max {10 - userActiveClaimCount} more)
                          </p>
                          {alreadyClaimedListings.length > 0 && (
                            <p className="text-amber-600 text-xs mt-1">
                              ⚠ {alreadyClaimedListings.length} listing(s) are already claimed and cannot be selected
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium">Ready to optimize {selectedListings.size} listing(s)</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {userActiveClaimCount} active claims + {selectedListings.size} new selections
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleCreateNew}
                        disabled={!selectedSeller || selectedListings.size > 0}
                        className={`flex items-center justify-center space-x-2 px-6 py-2 rounded-md font-medium ${
                          !selectedSeller || selectedListings.size > 0
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                        }`}
                      >
                        <Plus className="h-4 w-4" />
                        <span>Create New Product Listing</span>
                      </button>

                      <button
                        onClick={handleEditExisting}
                        disabled={(selectedListings.size === 0 && userActiveClaimCount === 0) || isSubmittingClaims}
                        className={`flex items-center justify-center space-x-2 px-6 py-2 rounded-md font-medium ${
                          (selectedListings.size === 0 && userActiveClaimCount === 0) || isSubmittingClaims
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                      >
                        {isSubmittingClaims ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Claiming & Loading...</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-4 w-4" />
                            <span>Edit Existing Listing</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

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