import { useState, useCallback } from 'react';
import { api } from '../api/apiService';
import { getColumnValue } from '../utils/dataUtils';

export const useListingSelection = (userEmail, rawResourceData, onClaimsUpdated) => {
  const [selectedListings, setSelectedListings] = useState(new Set());
  const [isSubmittingClaims, setIsSubmittingClaims] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectionError, setSelectionError] = useState(null);

  const toggleListingSelection = useCallback((listingId) => {
    if (!listingId) return;
    
    const item = rawResourceData.find(i => i['listing-id'] === listingId);
    if (!item) return;

    const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
    if (endTime && endTime.trim() !== '') {
      setSelectionError('This listing has been completed and cannot be selected');
      setTimeout(() => setSelectionError(null), 3000);
      return;
    }

    const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
    const isClaimedByUser = claimedBy.toLowerCase() === (userEmail || '').toLowerCase();
    const claimedStatus = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
    const isClaimed = claimedStatus === 'Claimed' || claimedStatus === 'In Progress';

    if (isClaimed && !isClaimedByUser) {
      setSelectionError('This listing is already claimed');
      setTimeout(() => setSelectionError(null), 3000);
      return;
    }

    setSelectedListings(prev => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
  }, [rawResourceData, userEmail]);

  const claimSelectedListings = useCallback(async (selectedSeller, availableOptions) => {
    if (!selectedSeller || selectedListings.size === 0) {
      setSubmitError('Please select at least one listing');
      return;
    }

    const alreadyClaimedByOthers = rawResourceData.filter(item => {
      if (!selectedListings.has(item['listing-id'])) return false;
      const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
      const isClaimedByUser = claimedBy.toLowerCase() === (userEmail || '').toLowerCase();
      const status = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
      const isClaimed = status === 'Claimed' || status === 'In Progress';
      const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
      return isClaimed && !isClaimedByUser && (!endTime || endTime.trim() === '');
    });

    if (alreadyClaimedByOthers.length > 0) {
      setSubmitError(`${alreadyClaimedByOthers.length} listing(s) are already claimed by others.`);
      return;
    }

    setIsSubmittingClaims(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const selectedRows = rawResourceData.filter(item => {
        const listingId = item['listing-id'];
        const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
        const isClaimedByUser = claimedBy.toLowerCase() === (userEmail || '').toLowerCase();
        const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
        return listingId && selectedListings.has(listingId) && !isClaimedByUser && (!endTime || endTime.trim() === '');
      });

      if (selectedRows.length === 0) return { alreadyClaimed: true };

      const claimResult = await api.claims.submitClaim({
        sellerId: selectedSeller,
        listings: selectedRows.map(item => ({
          'listing-id': item['listing-id'],
          asin1: item.asin1,
          store_name: getColumnValue(item, ['store_name', 'storeName', 'Store Name']),
          seller_id: getColumnValue(item, ['seller_id', 'sellerId', 'Seller_ID']),
          'item-name': getColumnValue(item, ['item-name', 'item_name', 'itemName', 'Item Name']),
        })),
        userEmail: userEmail,
        claimedAt: new Date().toISOString(),
      });

      if (claimResult.success) {
        setSuccessMessage(`✅ Successfully claimed ${claimResult.claimedCount || selectedRows.length} listing(s).`);
        if (onClaimsUpdated) onClaimsUpdated(claimResult.currentActiveClaims);
        return { success: true };
      } else {
        throw new Error(claimResult.error || 'Failed to claim listings');
      }
    } catch (err) {
      setSubmitError(err.message);
      throw err;
    } finally {
      setIsSubmittingClaims(false);
    }
  }, [selectedListings, rawResourceData, userEmail, onClaimsUpdated]);

  return {
    selectedListings, setSelectedListings,
    toggleListingSelection,
    claimSelectedListings,
    isSubmittingClaims,
    submitError, setSubmitError,
    successMessage, setSuccessMessage,
    selectionError, setSelectionError
  };
};
