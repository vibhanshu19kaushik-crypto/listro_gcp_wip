import { useState, useCallback, useMemo } from 'react';
import { getColumnValue } from '../utils/dataUtils';

export const useResourceTableState = (rawResourceData) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredData = useMemo(() => {
    let filtered = rawResourceData.filter(item => {
      if (!searchTerm || searchTerm.trim() === '') return true;
      
      const s = searchTerm.trim().toUpperCase();
      const asin = String(getColumnValue(item, ['ASIN', 'asin', 'Asin', 'asin1']) || '').trim().toUpperCase();
      const listingId = String(getColumnValue(item, ['listing-id', 'listing_id', 'listingId']) || '').trim().toUpperCase();
      const storeName = String(getColumnValue(item, ['Store_Name', 'store_name', 'Store Name', 'store']) || '').trim().toUpperCase();
      const claimedBy = String(getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '').trim().toUpperCase();
      const itemName = String(getColumnValue(item, ['item-name', 'item_name', 'itemName', 'Item Name']) || '').trim().toUpperCase();
      
      return asin.includes(s) || listingId.includes(s) || storeName.includes(s) || claimedBy.includes(s) || itemName.includes(s);
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = '';
        let bVal = '';

        switch (sortConfig.key) {
          case 'asin':
            aVal = getColumnValue(a, ['ASIN', 'asin', 'Asin', 'asin1']) || '';
            bVal = getColumnValue(b, ['ASIN', 'asin', 'Asin', 'asin1']) || '';
            break;
          case 'listing-id':
            aVal = getColumnValue(a, ['listing-id', 'listing_id', 'listingId']) || '';
            bVal = getColumnValue(b, ['listing-id', 'listing_id', 'listingId']) || '';
            break;
          case 'store-name':
            aVal = getColumnValue(a, ['Store_Name', 'store_name', 'Store Name', 'store']) || '';
            bVal = getColumnValue(b, ['Store_Name', 'store_name', 'Store Name', 'store']) || '';
            break;
          case 'status':
            aVal = getColumnValue(a, ['Status', 'status']) || '';
            bVal = getColumnValue(b, ['Status', 'status']) || '';
            break;
          case 'claimed-by':
            aVal = getColumnValue(a, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
            bVal = getColumnValue(b, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
            break;
          case 'last-claim':
            const aTime = new Date(getColumnValue(a, ['Last_Claim_Timestamp', 'last_claim_timestamp']) || 0).getTime();
            const bTime = new Date(getColumnValue(b, ['Last_Claim_Timestamp', 'last_claim_timestamp']) || 0).getTime();
            return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
          default:
            return 0;
        }

        if (typeof aVal === 'string') {
          aVal = aVal.toUpperCase();
          bVal = bVal.toUpperCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [rawResourceData, searchTerm, sortConfig]);

  return {
    searchTerm, setSearchTerm,
    sortConfig, setSortConfig,
    isSortDropdownOpen, setIsSortDropdownOpen,
    handleSort,
    sortedAndFilteredData
  };
};
