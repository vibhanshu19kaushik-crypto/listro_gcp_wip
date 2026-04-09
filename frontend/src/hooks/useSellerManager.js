import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/apiService';
import { getColumnValue } from '../utils/dataUtils';

export const useSellerManager = (userEmail, onClaimsLoaded) => {
  const [availableOptions, setAvailableOptions] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState('');
  const [isLoadingDropdown, setIsLoadingDropdown] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [userHasAllocations, setUserHasAllocations] = useState(false);
  const [rawSheetData, setRawSheetData] = useState(null);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [rawFilteredData, setRawFilteredData] = useState(null);
  const [rawResourceData, setRawResourceData] = useState([]);
  const [alreadyClaimedListings, setAlreadyClaimedListings] = useState([]);

  const loadAvailableSellers = useCallback(async () => {
    setIsLoadingDropdown(true);
    try {
      const sheetData = await api.sellers.getAll();
      setRawSheetData(sheetData.data);
      if (sheetData.headers) setTableHeaders(sheetData.headers);

      let allowedSellerIds = new Set();
      let hasAllocations = false;
      let activeClaims = 0;

      try {
        const allocRes = await api.sellers.getAllocations();
        if (allocRes?.data && Array.isArray(allocRes.data)) {
          allocRes.data.forEach(a => {
            const email = (a.Resource_Email || a.resource_email || '').toString().toLowerCase();
            const status = (a.Allocation_Status || a.allocation_status || '').toString().toUpperCase();
            const sellerId = a.Seller_ID || a.seller_id || a.SellerId || a.sellerId;
            const endTime = a.End_Time || a.end_time || '';
            
            if (email && userEmail && email === userEmail.toLowerCase()) {
              hasAllocations = true;
              if (status === 'ALLOCATED' && (!endTime || endTime.trim() === '')) activeClaims++;
              if (status === 'ALLOCATED' && sellerId) allowedSellerIds.add(String(sellerId));
            }
          });
          setUserHasAllocations(hasAllocations);
          if (onClaimsLoaded) onClaimsLoaded(activeClaims, hasAllocations);
        }
      } catch (allocErr) {
        console.warn('Could not fetch allocations:', allocErr);
      }

      const storeMap = new Map();
      if (hasAllocations && allowedSellerIds.size > 0) {
        sheetData.data.forEach(item => {
          const sellerId = item.seller_id;
          const storeName = item.store_name;
          if (sellerId && storeName && allowedSellerIds.has(String(sellerId))) {
            const key = `${storeName}-${sellerId}`;
            if (!storeMap.has(key)) {
              storeMap.set(key, { id: sellerId, storeName, displayName: `${storeName} - (${sellerId})` });
            }
          }
        });
      }
      setAvailableOptions(Array.from(storeMap.values()));
    } catch (err) {
      console.error('Failed to load sellers:', err);
    } finally {
      setIsLoadingDropdown(false);
    }
  }, [userEmail, onClaimsLoaded]);

  const handleSellerChange = async (sellerId, storeName, currentEmail) => {
    if (!sellerId) {
      setSelectedSeller('');
      setRawFilteredData(null);
      setRawResourceData([]);
      setAlreadyClaimedListings([]);
      return;
    }

    setSelectedSeller(sellerId);
    setIsLoading(true);
    setRawFilteredData(null);
    setRawResourceData([]);
    setAlreadyClaimedListings([]);

    try {
      const sellerData = await api.sellers.getListings(sellerId);
      setRawFilteredData(sellerData.data);
      if (sellerData.headers) setTableHeaders(sellerData.headers);

      const resourceData = await api.sellers.getResourceAllocation(sellerId, storeName);
      
      const processedData = resourceData.data || [];
      const claimed = processedData.filter(item => {
        const status = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
        return status === 'Claimed' && item['listing-id'];
      }).map(item => ({
        listingId: item['listing-id'],
        claimedBy: getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || 'another user',
        claimedAt: getColumnValue(item, ['Last_Claim_Timestamp', 'last_claim_timestamp']) || 'recently',
        endTime: getColumnValue(item, ['End_Time', 'end_time']) || ''
      }));

      setAlreadyClaimedListings(claimed);
      setRawResourceData(processedData);
      
      // Auto-select listings if they belong to user and aren't completed
      const userClaimsListingIds = processedData.filter(item => {
        const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
        const isClaimedByUser = claimedBy.toLowerCase() === (currentEmail || '').toLowerCase();
        const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
        return item['listing-id'] && isClaimedByUser && (!endTime || endTime.trim() === '');
      }).map(item => item['listing-id']);
      
      return { resourceData: processedData, userClaimedIds: userClaimsListingIds };
    } catch (err) {
      console.error('Error in handleSellerChange:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) loadAvailableSellers();
  }, [userEmail, loadAvailableSellers]);

  return {
    availableOptions, selectedSeller, setSelectedSeller,
    isLoadingDropdown, isLoading, setIsLoading,
    userHasAllocations, rawFilteredData, tableHeaders,
    rawResourceData, alreadyClaimedListings, setAlreadyClaimedListings,
    handleSellerChange, loadAvailableSellers
  };
};
