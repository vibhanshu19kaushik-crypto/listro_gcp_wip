import { useState, useEffect, useCallback } from 'react';
import { NODE_API_BASE_URL } from '../api/config';

export const useClaimedAsins = () => {
  const [asinList, setAsinList] = useState([]);
  const [selectedAsin, setSelectedAsin] = useState('');
  const [asinDropdownOpen, setAsinDropdownOpen] = useState(false);
  const [isLoadingAsins, setIsLoadingAsins] = useState(false);
  const [asinCompletionStatus, setAsinCompletionStatus] = useState({});
  const [asinSearchQuery, setAsinSearchQuery] = useState('');

  const fetchSelectedAsins = useCallback(async () => {
    try {
      setIsLoadingAsins(true);
      const userData = localStorage.getItem('user');
      if (!userData) return;
     
      const { email: userEmail } = JSON.parse(userData);
      if (!userEmail) return;
     
      const response = await fetch(`${NODE_API_BASE_URL}/api/user-claimed-asins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
     
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
     
      if (data.success && data.claimedAsins) {
        const available = data.claimedAsins.filter(item =>
          item.status === 'Claimed' || item.status === 'In Progress'
        ).map(item => ({
          asin: item.asin,
          status: item.status,
          startTime: item.startTime,
          endTime: item.endTime,
          isCompleted: item.status === 'Completed',
          canEdit: item.canEdit
        }));
       
        setAsinList(available);
       
        const statusMap = {};
        available.forEach(item => {
          statusMap[item.asin] = {
            isCompleted: item.isCompleted,
            canEdit: item.canEdit,
            endTime: item.endTime
          };
        });
        setAsinCompletionStatus(statusMap);
       
        const actionType = localStorage.getItem('actionType');
        if (available.length > 0 && actionType === 'edit') {
          const firstAvailable = available.find(item => item.canEdit);
          if (firstAvailable) setSelectedAsin(firstAvailable.asin);
        }
      }
    } catch (error) {
      console.error('Error loading ASINs:', error);
    } finally {
      setIsLoadingAsins(false);
    }
  }, []);

  useEffect(() => {
    fetchSelectedAsins();
  }, [fetchSelectedAsins]);

  return {
    asinList, selectedAsin, setSelectedAsin,
    asinDropdownOpen, setAsinDropdownOpen,
    isLoadingAsins, asinCompletionStatus,
    asinSearchQuery, setAsinSearchQuery,
    fetchSelectedAsins
  };
};
