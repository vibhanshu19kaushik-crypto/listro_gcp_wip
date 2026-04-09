import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/apiService';
import { getISTTimestamp } from '../utils/allocationUtils';

export const useSellerAllocationManager = (currentUserEmail) => {
  const [sellers, setSellers] = useState([]);
  const [emails, setEmails] = useState([]);
  const [dbAllocations, setDbAllocations] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // 1. Initial Data Fetching
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sheetData, emailData, existingAlloc] = await Promise.all([
        api.sellers.getAll(),
        api.sellers.getEmails(),
        api.sellers.getAllocations()
      ]);

      if (sheetData.success) {
        const sellerMap = new Map();
        sheetData.data.forEach(item => {
          const sId = item.seller_id || item.sellerId;
          const sName = item.store_name || item.sellerName;
          const key = `${sId}-${sName}`;
          if (!sellerMap.has(key)) {
            sellerMap.set(key, {
              id: sId,
              name: sName,
              storeName: sName,
              totalListings: item.totalListings || 0,
              category: item.category || 'Unknown',
              sub_category: item.sub_category || 'Unknown',
              status: item.status || 'Active'
            });
          }
        });
        setSellers(Array.from(sellerMap.values()));
      }

      setEmails(emailData || []);
      setDbAllocations(existingAlloc?.data || []);

      // Sync UI state from live DB allocations
      const initialSelected = {};
      (existingAlloc?.data || []).forEach(row => {
        if ((row.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED') {
          const sId = row.Seller_ID || row.sellerId;
          const email = row.Resource_Email || row.resourceEmail;
          if (!initialSelected[sId]) initialSelected[sId] = [];
          if (!initialSelected[sId].includes(email)) initialSelected[sId].push(email);
        }
      });
      setSelectedEmails(initialSelected);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 2. Selection State logic
  const handleEmailSelection = (sellerId, email) => {
    setSelectedEmails(prev => {
      const current = prev[sellerId] || [];
      const updated = current.includes(email) ? current.filter(e => e !== email) : [...current, email];
      return { ...prev, [sellerId]: updated };
    });
  };

  const handleSelectAllForSeller = (sellerId, allFilteredEmails) => {
    const current = selectedEmails[sellerId] || [];
    const updated = current.length === allFilteredEmails.length ? [] : allFilteredEmails.map(e => e.email);
    setSelectedEmails(prev => ({ ...prev, [sellerId]: updated }));
  };

  // 3. Sync to Backend logic
  const handleSyncToSheet = async () => {
    setIsSaving(true);
    try {
      const ist = getISTTimestamp();
      const selectedKeys = new Set();
      sellers.forEach(s => (selectedEmails[s.id] || []).forEach(e => selectedKeys.add(`${s.id}::${e}`)));

      const currentAllocatedKeys = new Set(
        dbAllocations.filter(a => (a.Allocation_Status || "").toUpperCase().trim() === "ALLOCATED")
          .map(a => `${a.Seller_ID || a.sellerId}::${a.Resource_Email || a.resourceEmail}`)
      );

      const toAllocate = [];
      selectedKeys.forEach(key => {
        if (!currentAllocatedKeys.has(key)) {
          const [Seller_ID, Resource_Email] = key.split("::");
          toAllocate.push({
            Seller_ID,
            Seller_name: sellers.find(s => s.id === Seller_ID)?.name || "",
            Resource_Email,
            Assigned_by: currentUserEmail,
            Allocation_Status: "ALLOCATED",
            Assigned_Timestamp: ist
          });
        }
      });

      const toUnallocate = [];
      dbAllocations.forEach(row => {
        if ((row.Allocation_Status || "").toUpperCase().trim() !== "ALLOCATED") return;
        const sId = row.Seller_ID || row.sellerId;
        const resEmail = row.Resource_Email || row.resourceEmail;
        const key = `${sId}::${resEmail}`;
        
        if (selectedEmails[sId] !== undefined && !selectedKeys.has(key)) {
          toUnallocate.push({
            Seller_ID: sId,
            Resource_Email: resEmail,
            Allocation_Status: "UNALLOCATED",
            Unassigned_Timestamp: ist
          });
        }
      });

      if (toAllocate.length === 0 && toUnallocate.length === 0) return { success: true, changes: false };

      const result = await api.sellers.syncAllocations({ toAllocate, toUnallocate });
      await loadData(); // Refresh system of record
      return { success: true, changes: true, ...result };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setIsSaving(false);
    }
  };

  return {
    sellers, emails, dbAllocations, selectedEmails, setSelectedEmails,
    isLoading, isSaving, error,
    handleEmailSelection, handleSelectAllForSeller, handleSyncToSheet
  };
};
