import { useState, useCallback } from 'react';
import { api } from '../api/apiService';
import { exportToCSV } from '../utils/allocationUtils';

export const useClaimedListings = (currentUserEmail) => {
  const [claimedListings, setClaimedListings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unclaimingId, setUnclaimingId] = useState(null);

  const fetchClaimedListings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.claims.getListings();
      if (data && data.success) {
        setClaimedListings(data.listings);
      }
    } catch (err) {
      console.error('Error fetching claimed listings', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUnclaim = useCallback(async (listingId) => {
    if (!window.confirm(`Mark listing ${listingId} as Unclaimed?`)) return;

    try {
      setUnclaimingId(listingId);
      const data = await api.claims.unclaim(listingId, currentUserEmail);
      if (data && data.success) {
        setClaimedListings(prev => prev.filter(r => (r['listing-id'] || '').toString().trim() !== listingId.toString().trim()));
        setTimeout(fetchClaimedListings, 1000);
      }
    } catch (err) {
      console.error('Unclaim error', err);
    } finally {
      setUnclaimingId(null);
    }
  }, [currentUserEmail, fetchClaimedListings]);

  const exportToCSV_Dashboard = useCallback((filteredListings) => {
    const headers = ['listing-id', 'asin1', 'store_name', 'Claimed_Status', 'Last_Claim_Timestamp', 'Email_id', 'Start_Time', 'End_Time'];
    const rows = filteredListings.map(r => [
      r['listing-id'] || '',
      r.asin1 || '',
      r.store_name || '',
      r.Claimed_Status || '',
      r.Last_Claim_Timestamp || '',
      r.Email_id || '',
      r.Start_Time || '',
      r.End_Time || ''
    ]);
    exportToCSV(headers, rows, 'claimed_asins');
  }, []);

  return {
    claimedListings,
    isLoading,
    unclaimingId,
    fetchClaimedListings,
    handleUnclaim,
    exportToCSV_Dashboard
  };
};
