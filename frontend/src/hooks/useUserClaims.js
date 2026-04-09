import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/apiService';

export const useUserClaims = (initialEmail = '') => {
  const [userEmail, setUserEmail] = useState(initialEmail);
  const [userClaimedListings, setUserClaimedListings] = useState([]);
  const [userActiveClaimCount, setUserActiveClaimCount] = useState(0);

  const loadUserClaimedListings = useCallback(async (email) => {
    if (!email) return;
    try {
      const data = await api.claims.getActive(email);
      if (data.success) {
        setUserClaimedListings(data.claimedAsins || []);
        const activeClaims = (data.claimedAsins || []).filter(asin => 
          asin.status === 'Claimed' || asin.status === 'In Progress'
        ).length;
        setUserActiveClaimCount(activeClaims);
      }
    } catch (error) {
      console.error('Error loading user claimed listings:', error);
    }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        if (user.email) {
          setUserEmail(user.email);
          loadUserClaimedListings(user.email);
        }
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, [loadUserClaimedListings]);

  return {
    userEmail,
    userClaimedListings,
    userActiveClaimCount,
    setUserActiveClaimCount,
    loadUserClaimedListings
  };
};
