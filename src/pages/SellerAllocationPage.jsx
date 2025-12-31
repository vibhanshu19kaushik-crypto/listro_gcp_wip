// src/pages/SellerAllocationPage.jsx

import { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle, UserPlus, Search, X, Users, Save, Mail, User, Filter, Download, Eye, EyeOff, Plus, Trash2, Clock } from 'lucide-react';
import { fetchSheetData, fetchEmailDataFromSheet } from '../api/api';
import {
  allocateAssignmentsToSheet,
  fetchExistingAllocationsFromSheet
} from "@/api/frontendApi";

// Import the API config
import { NODE_API_BASE_URL } from '../api/config';

const SellerAllocationPage = () => {
 const [dbAllocations, setDbAllocations] = useState([]);
 const [sellers, setSellers] = useState([]);
 const [allocations, setAllocations] = useState({});
 const [emails, setEmails] = useState([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isLoadingEmails, setIsLoadingEmails] = useState(true);
 const [isSaving, setIsSaving] = useState(false);
 const [saveStatus, setSaveStatus] = useState(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [emailSearchTerm, setEmailSearchTerm] = useState('');
 const [error, setError] = useState(null);
 const [selectedEmails, setSelectedEmails] = useState({}); // {sellerId: [email1, email2]}
 const [emailFilter, setEmailFilter] = useState('all'); // 'all', 'assigned', 'unassigned'
 const [expandedSeller, setExpandedSeller] = useState(null);
 const [dashboardView, setDashboardView] = useState('sellers'); // 'sellers' or 'emails'
 const [showEmailDashboard, setShowEmailDashboard] = useState(true);
 const [currentUserEmail, setCurrentUserEmail] = useState(''); // Current user email from Navbar
 // Success banner state
 const [showSuccess, setShowSuccess] = useState(false);
 const [successMessage, setSuccessMessage] = useState("");

 // --- Claimed ASINs (new dashboard) ---
 const [claimedListings, setClaimedListings] = useState([]);
 const [isLoadingClaimedListings, setIsLoadingClaimedListings] = useState(false);
 const [claimedSearch, setClaimedSearch] = useState('');
 const [claimedFilter, setClaimedFilter] = useState('all'); // show all by default
 const [unclaimingListingId, setUnclaimingListingId] = useState(null);
 const [showClaimedDashboard, setShowClaimedDashboard] = useState(true);

 // Helper to detect Lead/Admin from existing session object in localStorage
 const isLeadOrAdmin = () => {
   try {
     const userRaw = localStorage.getItem('user');
     if (!userRaw) return false;
     const u = JSON.parse(userRaw);
     if (!u) return false;
     if (u.role && (u.role.toString().toLowerCase().includes('lead') || u.role.toString().toLowerCase().includes('admin'))) return true;
     if (u.roles && Array.isArray(u.roles) && u.roles.some(r => r.toString().toLowerCase().includes('lead') || r.toString().toLowerCase().includes('admin'))) return true;
     if (u.isLead || u.isAdmin) return true;
     return false;
   } catch (e) {
     return false;
   }
 };

 // Fetch claimed listings from the Table 2 - KAM sheet
 const fetchClaimedListings = async () => {
  setIsLoadingClaimedListings(true);
  try {
    // Use the NODE_API_BASE_URL from config (works for both local and Cloud Run)
    const res = await fetch(`${NODE_API_BASE_URL}/api/claimed-listings`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    
    if (data && data.success && Array.isArray(data.listings)) {
      // Load ALL listings (don't filter here - let the filter dropdown control what's shown)
      setClaimedListings(data.listings);
      console.log(`✅ Loaded ${data.listings.length} total listings from sheet`);
    } else {
      setClaimedListings([]);
      console.error('claimed-listings: unexpected response', data);
    }
  } catch (err) {
    console.error('Error fetching claimed listings', err);
    setClaimedListings([]);
  } finally {
    setIsLoadingClaimedListings(false);
  }
};

 // Fetch claimed listings after current user is loaded (so isLeadOrAdmin sees the correct user)
 useEffect(() => {
   // Fetch once on mount if current user is Lead/Admin
   if (isLeadOrAdmin()) {
     fetchClaimedListings();
   }

   // Also listen for changes to the 'user' in localStorage (e.g. Navbar login), re-fetch if role becomes Lead/Admin
   const onStorage = (e) => {
     if (e.key === 'user') {
       // slight debounce to allow storage to settle
       setTimeout(() => {
         if (isLeadOrAdmin()) fetchClaimedListings();
       }, 50);
     }
   };
   window.addEventListener('storage', onStorage);
   return () => window.removeEventListener('storage', onStorage);
 }, []);


 // Unclaim action - updates the sheet via backend and removes row locally
 const handleUnclaimListing = async (listingId) => {
   if (!listingId) return;
   if (!isLeadOrAdmin()) {
     setSaveStatus({ type: 'error', message: 'Unauthorized' });
     return;
   }
   if (!currentUserEmail) {
     setSaveStatus({ type: 'error', message: 'User email not available' });
     return;
   }

   const confirmed = window.confirm(`Mark listing ${listingId} as Unclaimed?`);
   if (!confirmed) return;

   try {
     setUnclaimingListingId(listingId);
     setSaveStatus({ type: 'info', message: `Unclaiming ${listingId}...` });

     // Use the NODE_API_BASE_URL from config
     const res = await fetch(`${NODE_API_BASE_URL}/api/unclaim-listing`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ listingId, unclaimedBy: currentUserEmail })
     });

     // Check if response is OK before parsing JSON
     if (!res.ok) {
       const text = await res.text();
       throw new Error(`HTTP ${res.status}: ${res.statusText}. Response: ${text.substring(0, 200)}`);
     }

     const data = await res.json();
     if (data && data.success && data.updated) {
       // remove from local list (dashboard shows only Claimed rows)
       setClaimedListings(prev => prev.filter(r => (r['listing-id']||'').toString().trim() !== listingId.toString().trim()));
       setSaveStatus({ type: 'success', message: `Unclaimed ${listingId}` });
       
       // Refresh the data after a short delay
       setTimeout(() => {
         fetchClaimedListings();
       }, 1000);
     } else {
       setSaveStatus({ type: 'error', message: data.message || data.error || 'Failed to unclaim' });
     }
   } catch (err) {
     console.error('Unclaim error', err);
     setSaveStatus({ type: 'error', message: err.message || 'Failed to unclaim' });
   } finally {
     setUnclaimingListingId(null);
     setTimeout(() => setSaveStatus(null), 5000);
   }
 };

 // Filtered view for dashboard
 const filteredClaimedListings = (claimedListings || [])
   .filter(row => {
     // Filter by status based on dropdown selection
     if (claimedFilter === 'all') return true; // Show all statuses
     
     const status = (row.Claimed_Status || '').toString().toLowerCase();
     
     if (claimedFilter === 'claimed') return status === 'claimed';
     if (claimedFilter === 'in progress') return status === 'in progress';
     if (claimedFilter === 'completed') return status === 'completed';
     if (claimedFilter === 'unclaimed') return status === 'unclaimed';
     
     return true; // Default: show all
   })
   .filter(row => {
     const q = (claimedSearch || '').toString().trim().toLowerCase();
     if (!q) return true;
     return (
       ((row['listing-id']||'') + ' ' + (row.asin1||'') + ' ' + (row.store_name||'') + ' ' + (row.Email_id||'')).toString().toLowerCase().includes(q)
     );
   });

 // Export claimed dashboard to CSV (keeps only displayed columns)
 const exportClaimedToCSV = () => {
   const headers = ['listing-id','asin1','store_name','Claimed_Status','Last_Claim_Timestamp','Email_id','Start_Time','End_Time'];
   const rows = [headers];
   filteredClaimedListings.forEach(r => {
     rows.push([
       r['listing-id'] || '',
       r.asin1 || '',
       r.store_name || '',
       r.Claimed_Status || '',
       r.Last_Claim_Timestamp || '',
       r.Email_id || '',
       r.Start_Time || '',
       r.End_Time || ''
     ]);
   });
   const csv = rows.map(r => r.map(c => `"${(c||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
   const blob = new Blob([csv], { type: 'text/csv' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `claimed_asins_${new Date().toISOString().slice(0,10)}.csv`;
   a.click();
   URL.revokeObjectURL(url);
 };

 // Get current user email from localStorage (from Navbar)
 useEffect(() => {
   const loadCurrentUser = () => {
     try {
       const userData = localStorage.getItem('user');
       if (userData) {
         const parsedUser = JSON.parse(userData);
         setCurrentUserEmail(parsedUser.email || '');
       }
     } catch (e) {
       console.error('Error parsing user data:', e);
     }
   };


   loadCurrentUser();
  
   // Listen for user updates
   const handleStorageChange = (e) => {
     if (e.key === 'user') {
       setTimeout(loadCurrentUser, 100);
     }
   };


   window.addEventListener('storage', handleStorageChange);
   return () => window.removeEventListener('storage', handleStorageChange);
 }, []);


 // Fetch sellers data from GCP on component mount
 useEffect(() => {
   const fetchSellersData = async () => {
     setIsLoading(true);
     setError(null);
    
     try {
       // Fetch sellers from GCP BigQuery
       const sheetData = await fetchSheetData();
      
       if (!sheetData.success || !sheetData.data) {
         throw new Error('Failed to fetch sellers from GCP');
       }


       // Extract unique sellers from GCP data
       const sellerMap = new Map();
      
       sheetData.data.forEach(item => {
         const sellerId = item.seller_id;
         const storeName = item.store_name;
        
         if (sellerId && storeName) {
           const key = `${sellerId}-${storeName}`;
           if (!sellerMap.has(key)) {
             sellerMap.set(key, {
               id: sellerId,
               name: storeName,
               storeName: storeName,
               totalListings: item.totalListings || 0,
               category: item.category || 'Unknown',
               status: item.status || 'Active'
             });
           }
         }
       });


       const uniqueSellers = Array.from(sellerMap.values());
      
       // Load existing allocations from localStorage
       const savedAllocations = JSON.parse(localStorage.getItem('seller_allocations') || '{}');
       const savedSelectedEmails = JSON.parse(localStorage.getItem('seller_email_allocations') || '{}');
      
       setSellers(uniqueSellers);
       setAllocations(savedAllocations);
       setSelectedEmails(savedSelectedEmails);
      
       console.log(`✅ Loaded ${uniqueSellers.length} sellers from GCP`);
     } catch (error) {
       console.error('Failed to fetch sellers from GCP:', error);
       setError(`Failed to load sellers: ${error.message}`);
      
       // Fallback to mock data if GCP fails
       const mockSellers = [
         { id: 'SELL001', name: 'TechGadgets Inc', storeName: 'TechGadgets Store', category: 'Electronics', status: 'Active' },
         { id: 'SELL002', name: 'FashionHub', storeName: 'FashionHub Boutique', category: 'Fashion', status: 'Active' },
         { id: 'SELL003', name: 'HomeEssentials', storeName: 'Home & Living', category: 'Home', status: 'Active' },
         { id: 'SELL004', name: 'SportsGear Pro', storeName: 'Sports Equipment', category: 'Sports', status: 'Active' },
       ];
      
       setSellers(mockSellers);
     } finally {
       setIsLoading(false);
     }
   };


   fetchSellersData();
 }, []);


 // Fetch emails from Google Sheets
 useEffect(() => {
   const fetchEmails = async () => {
     setIsLoadingEmails(true);
     try {
       const emailData = await fetchEmailDataFromSheet();
       setEmails(emailData);
       console.log(`✅ Loaded ${emailData.length} emails from Google Sheets`);
     } catch (error) {
       console.error('Failed to fetch emails:', error);
       // Fallback to mock emails
       const mockEmails = [
         { email: 'vibhanshu@example.com', fullName: 'Vibhanshu' },
         { email: 'ashutosh@example.com', fullName: 'Ashutosh' },
         { email: 'rudra@example.com', fullName: 'Rudra' },
         { email: 'shubham@example.com', fullName: 'Shubham' },
         { email: 'karan@example.com', fullName: 'Karan' },
         { email: 'sai@example.com', fullName: 'Sai' },
       ];
       setEmails(mockEmails);
     } finally {
       setIsLoadingEmails(false);
     }
   };


   fetchEmails();
 }, []);


  
  // Load existing allocations from the Google Sheet (system of record)
  useEffect(() => {
    async function loadDbAllocations() {
      try {
        const result = await fetchExistingAllocationsFromSheet();
        if (result && result.data) {
          setDbAllocations(result.data);
        } else {
          setDbAllocations([]);
        }
      } catch (e) {
        console.error('Error loading DB allocations from sheet', e);
        setDbAllocations([]);
      }
    }

    loadDbAllocations();
  }, []);


  // When dbAllocations (sheet) changes, sync selectedEmails state so UI reflects sheet
  useEffect(() => {
    try {
      const newSelected = {};
      (dbAllocations || []).forEach(row => {
        if ((row.Allocation_Status || '').toUpperCase().trim() !== 'ALLOCATED') return;
        const sellerId = row.Seller_ID || row.sellerId || '';
        const email = row.Resource_Email || row.resourceEmail || '';
        if (!sellerId || !email) return;
        if (!newSelected[sellerId]) newSelected[sellerId] = [];
        if (!newSelected[sellerId].includes(email)) newSelected[sellerId].push(email);
      });
      setSelectedEmails(prev => {
        // avoid unnecessary updates by shallow compare keys
        return newSelected;
      });
    } catch (e) {
      console.error('Error syncing selectedEmails from dbAllocations', e);
    }
  }, [dbAllocations]);


  // Helper: return allocated (live) emails for a seller from the sheet (deduped)
  const getAllocatedEmailsForSeller = (sellerId) => {
    try {
      const emails = (dbAllocations || [])
        .filter(r => {
          if (!r) return false;
          const status = (r.Allocation_Status || r.allocation_status || '').toString().toUpperCase().trim();
          return status === 'ALLOCATED' && (r.Seller_ID == sellerId || r.sellerId == sellerId);
        })
        .map(r => r.Resource_Email || r.resourceEmail || '')
        .filter(Boolean);

      // dedupe
      return Array.from(new Set(emails));
    } catch (e) {
      console.error('getAllocatedEmailsForSeller error', e);
      return [];
    }
  };










 // Handle email selection for a seller
 const handleEmailSelection = (sellerId, email) => {
  // Ensure there is a selection array for this seller
  const currentSelected = selectedEmails[sellerId] || [];

  if (currentSelected.includes(email)) {
    // Remove email if already selected
    const updated = currentSelected.filter(e => e !== email);
    setSelectedEmails({
      ...selectedEmails,
      [sellerId]: updated
    });
  } else {
    // Add email if not selected
    setSelectedEmails({
      ...selectedEmails,
      [sellerId]: [...currentSelected, email]
    });
  }
 };


 // Handle select/deselect all emails for a seller
 const handleSelectAllEmails = (sellerId) => {
   const allEmailAddresses = filteredEmails.map(e => e.email);
   const currentSelected = selectedEmails[sellerId] || [];
  
   if (currentSelected.length === allEmailAddresses.length) {
     // Deselect all
     setSelectedEmails({
       ...selectedEmails,
       [sellerId]: []
     });
   } else {
     // Select all
     setSelectedEmails({
       ...selectedEmails,
       [sellerId]: allEmailAddresses
     });
   }
 };




  const totalSelectedEmails =
    Object.values(selectedEmails).reduce((sum, arr) => sum + (arr?.length || 0), 0);




 // Handle allocate all button (NEW - Allocate one random email to all unallocated sellers)
 const handleAllocateAll = async () => {
 try {
   setIsSaving(true);
   setSaveStatus({ type: "info", message: "Allocating..." });


   // IST timestamp
   const ist = new Date(Date.now() + 19800000)
     .toISOString()
     .replace("T", " ")
     .split(".")[0];


   // Build selected pairs from UI (user intent from checkboxes)
   const selectedKeys = new Set();
   sellers.forEach(seller => {
     (selectedEmails[seller.id] || []).forEach(email => {
       selectedKeys.add(`${seller.id}::${email}`);
     });
   });


   // Build CURRENTLY ALLOCATED pairs from DB (live state)
   const currentAllocatedKeys = new Set(
     dbAllocations
       .filter(a => (a.Allocation_Status || "").toUpperCase().trim() === "ALLOCATED")
       .map(a => `${a.Seller_ID}::${a.Resource_Email}`)
   );


   // New allocations: in selectedKeys but NOT in currentAllocatedKeys
   const toAllocate = [];
   selectedKeys.forEach(key => {
     if (!currentAllocatedKeys.has(key)) {
       const [Seller_ID, Resource_Email] = key.split("::");
       const seller = sellers.find(s => s.id === Seller_ID);


        toAllocate.push({
         Seller_ID,
         Seller_name: seller?.name || seller?.storeName || "",
         Resource_Email,
         Assigned_by: currentUserEmail,
         Allocation_Status: "ALLOCATED",
         Assigned_Timestamp: ist
       });
     }
   });


   // Deallocations: ONLY deallocate if user explicitly unchecked a box
   // (i.e., email is currently allocated AND explicitly deselected by user)
   // Preserve all allocations NOT touched in selectedEmails
   const toUnallocate = [];
   (dbAllocations || []).forEach(row => {
     if ((row.Allocation_Status || "").toUpperCase().trim() !== "ALLOCATED") return;
     const Seller_ID = row.Seller_ID || row.sellerId;
     const Resource_Email = row.Resource_Email || row.resourceEmail;
     const key = `${Seller_ID}::${Resource_Email}`;
     
     // Only unallocate if: the user has explicitly set selectedEmails[Seller_ID]
     // AND this allocation is NOT in the user's current selection (was checked, now unchecked)
     if (selectedEmails[Seller_ID] !== undefined && !selectedKeys.has(key)) {
       // The user opened this seller and explicitly deselected this email
       toUnallocate.push({
         Seller_ID,
         Resource_Email,
         Allocation_Status: "UNALLOCATED",
         Unassigned_Timestamp: ist
       });
     }
   });




  // No changes?
  if (toAllocate.length === 0 && toUnallocate.length === 0) {
    setSaveStatus({ type: "info", message: "No changes to apply." });
    setIsSaving(false);
    return;
  }

  // Send to backend (this writes to Google Sheet)
  const result = await allocateAssignmentsToSheet({ toAllocate, toUnallocate });

  // Reload allocations from sheet (system of record)
  const db = await fetchExistingAllocationsFromSheet();
  setDbAllocations(db.data || []);

  // Rebuild UI state from DB
  const newSelected = {};
  (db.data || [])
    .filter(a => (a.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED')
    .forEach(row => {
      if (!newSelected[row.Seller_ID]) newSelected[row.Seller_ID] = [];
      if (!newSelected[row.Seller_ID].includes(row.Resource_Email)) {
        newSelected[row.Seller_ID].push(row.Resource_Email);
      }
    });

  setSelectedEmails(newSelected);

  setSaveStatus({
    type: "success",
    message: `Allocated: ${result.allocated} | Unallocated: ${result.unallocated}`
  });

  // Refresh the page automatically shortly so the user sees fresh live data
  setTimeout(() => {
    try {
      window.location.reload();
    } catch (e) {
      // fallback: re-fetch allocations
      (async () => {
        const refreshed = await fetchExistingAllocationsFromSheet();
        setDbAllocations(refreshed.data || []);
      })();
    }
  }, 900);


 } catch (err) {
   console.error("Allocation Error:", err);
   setSaveStatus({ type: "error", message: err.message });
 } finally {
   setIsSaving(false);
 }
};




 // Handle clear all allocations
 const handleClearAll = () => {
   const clearedEmails = {};
   sellers.forEach(seller => {
     clearedEmails[seller.id] = [];
   });
   setSelectedEmails(clearedEmails);
   setSaveStatus({
     type: 'info',
     message: 'All email allocations have been cleared.'
   });
 };


 // Handle save allocations


 const hasPendingChanges = () => {
   const selectedKeys = new Set();
   sellers.forEach(seller => {
     (selectedEmails[seller.id] || []).forEach(email => {
       selectedKeys.add(`${seller.id}::${email}`);
     });
   });


   const existingKeys = new Set(
     dbAllocations
       .filter(row => row.Allocation_Status === "ALLOCATED")
       .map(row => `${row.Seller_ID}::${row.Resource_Email}`)
   );




   if (selectedKeys.size !== existingKeys.size) return true;


   for (let key of selectedKeys) {
     if (!existingKeys.has(key)) return true;
   }


   return false;
 };




 // Filter sellers based on search term
 const filteredSellers = sellers.filter(seller =>
   seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
   seller.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
   seller.storeName.toLowerCase().includes(searchTerm.toLowerCase())
 );


 // Filter emails based on search term
 const filteredEmails = emails.filter((emailObj) =>
   emailObj.email.toLowerCase().includes(emailSearchTerm.toLowerCase()) ||
   (emailObj.fullName && emailObj.fullName.toLowerCase().includes(emailSearchTerm.toLowerCase()))
 );


 // Filter sellers by email allocation status
 const filteredByEmailStatus = filteredSellers.filter(seller => {
  // Use sheet-backed live allocations to determine assigned/unassigned status
  const sellerEmails = getAllocatedEmailsForSeller(seller.id) || [];
  if (emailFilter === 'assigned') return sellerEmails.length > 0;
  if (emailFilter === 'unassigned') return sellerEmails.length === 0;
   return true; // 'all'
 });


  // Count allocations derived from sheet (live state)
  const allocatedCount = sellers.filter(s => getAllocatedEmailsForSeller(s.id).length > 0).length;
  const unallocatedCount = sellers.length - allocatedCount;


  // Calculate email distribution statistics from sheet (live ALLOCATED rows)
  const emailDistribution = emails.map(emailObj => {
    const assignedSellers = sellers.filter(seller => {
      const allocated = getAllocatedEmailsForSeller(seller.id);
      return allocated.includes(emailObj.email);
    });

    return {
      ...emailObj,
      assignedCount: assignedSellers.length,
      assignedSellers: assignedSellers
    };
  });

  // Calculate actual assignment statistics from the Google Sheet (dbAllocations)
  const totalAssignments = dbAllocations.filter(r => 
    (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED'
  ).length;
  
  const avgAssignmentsPerSeller = allocatedCount > 0 
    ? (totalAssignments / allocatedCount).toFixed(1) 
    : '0.0';


 // Build allocations table data from the Google Sheet allocations (only ALLOCATED rows)
 const getAllocationsTableData = () => {
   const tableData = [];

   dbAllocations
     .filter(r => (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED')
     .forEach(row => {
       tableData.push({
         sellerName: row.Seller_name || row.sellerName || '',
         sellerId: row.Seller_ID || row.sellerId || '',
         assignedEmail: row.Resource_Email || row.resourceEmail || '',
         allocationStatus: 'ALLOCATED',
         assignedBy: row.Assigned_by || row.Assigned_by || currentUserEmail || 'Not specified',
         storeName: ''
       });
     });

   return tableData.sort((a, b) => {
     if (a.sellerName !== b.sellerName) return a.sellerName.localeCompare(b.sellerName);
     return (a.assignedEmail || '').localeCompare(b.assignedEmail || '');
   });
 };


 // Export allocations to CSV
 const exportToCSV = () => {
   const csvRows = [];
  
   // Header
   csvRows.push(['Seller ID', 'Seller Name', 'Assigned Email', 'Assigned By', 'Store Name']);
  
   // Data rows - one row per email (only for sellers with emails)
  // Use sheet-backed live allocations (deduped) instead of local selectedEmails
  sellers.forEach(seller => {
    const sellerEmails = getAllocatedEmailsForSeller(seller.id) || [];

    sellerEmails.forEach(email => {
      csvRows.push([
        seller.id,
        seller.name,
        email,
        currentUserEmail || 'Not specified',
        seller.storeName
      ]);
    });
  });
  
   const csvContent = csvRows.map(row => row.join(',')).join('\n');
   const blob = new Blob([csvContent], { type: 'text/csv' });
   const url = window.URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `seller_email_allocations_${new Date().toISOString().split('T')[0]}.csv`;
   a.click();
   window.URL.revokeObjectURL(url);
 };


 // Export dashboard to CSV
 const exportDashboardToCSV = () => {
   const csvRows = [];
  
   // Header
   csvRows.push(['Seller Name', 'Seller ID', 'Assigned Email', 'Assigned By', 'Store Name']);
  
   // Data rows - one row per email (only for sellers with emails)
   getAllocationsTableData().forEach(row => {
     csvRows.push([
       row.sellerName,
       row.sellerId,
       row.assignedEmail,
       row.assignedBy,
       row.storeName
     ]);
   });
  
   const csvContent = csvRows.map(row => row.join(',')).join('\n');
   const blob = new Blob([csvContent], { type: 'text/csv' });
   const url = window.URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = `email_distribution_dashboard_${new Date().toISOString().split('T')[0]}.csv`;
   a.click();
   window.URL.revokeObjectURL(url);
 };


 return (
   <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
       <div className="space-y-8">
         {/* Header */}
         <div className="text-center space-y-4">
           <h1 className="text-3xl font-bold text-gray-900">Seller Allocation Dashboard</h1>
           <p className="text-gray-600 max-w-2xl mx-auto">
             Assign sellers to KAM resources
             {currentUserEmail && (
               <span className="block text-sm text-blue-600 mt-1">
                 Currently logged in as: <strong>{currentUserEmail}</strong>
               </span>
             )}
           </p>
         </div>


         {/* Error State */}
         {error && (
           <div className="bg-red-50 border border-red-200 rounded-xl p-4">
             <div className="flex items-center">
               <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
               <p className="text-red-800 text-sm">{error}</p>
             </div>
           </div>
         )}


         {/* Stats Cards */}
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-gray-600">Total Sellers</p>
                 <p className="text-3xl font-bold text-gray-900 mt-2">{sellers.length}</p>
                 <p className="text-xs text-gray-500 mt-1">From GCP BigQuery</p>
               </div>
               <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                 <UserPlus className="h-7 w-7 text-blue-600" />
               </div>
             </div>
           </div>


           <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-gray-600">Available Emails</p>
                 <p className="text-3xl font-bold text-purple-600 mt-2">{emails.length}</p>
                 <p className="text-xs text-gray-500 mt-1">From Google Sheets</p>
               </div>
               <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                 <Mail className="h-7 w-7 text-purple-600" />
               </div>
             </div>
           </div>


           <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-gray-600">Allocated Sellers</p>
                 <p className="text-3xl font-bold text-green-600 mt-2">{allocatedCount}</p>
                 <p className="text-xs text-gray-500 mt-1">
                   {allocatedCount > 0 ? `${Math.round((allocatedCount / sellers.length) * 100)}% complete` : 'Not started'}
                 </p>
               </div>
               <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                 <Check className="h-7 w-7 text-green-600" />
               </div>
             </div>
           </div>


           <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
             <div className="flex items-center justify-between">
               <div>
                 <p className="text-sm font-medium text-gray-600">Unallocated</p>
                 <p className="text-3xl font-bold text-orange-600 mt-2">{unallocatedCount}</p>
                 <p className="text-xs text-gray-500 mt-1">
                   {unallocatedCount > 0 ? 'Needs attention' : 'All allocated'}
                 </p>
               </div>
               <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                 <AlertCircle className="h-7 w-7 text-orange-600" />
               </div>
             </div>
           </div>
         </div>


         {/* Search and Bulk Actions */}
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
           <div className="flex flex-col space-y-4">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex-1">
                 <div className="relative max-w-md">
                   <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                   <input
                     type="text"
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Search sellers by name, ID, or store..."
                     className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                   />
                   {searchTerm && (
                     <button
                       onClick={() => setSearchTerm('')}
                       className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                     >
                       <X className="h-5 w-5" />
                     </button>
                   )}
                 </div>
               </div>
              
               <div className="flex flex-wrap gap-3">
                 <button
                   onClick={handleClearAll}
                   disabled={allocatedCount === 0}
                   className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Clear All
                 </button>
                 <button
                   onClick={exportToCSV}
                   className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                 >
                   <Download className="h-4 w-4" />
                   Export CSV
                 </button>
               </div>
             </div>
            
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center space-x-4">
                 <div className="flex items-center space-x-2">
                   <Filter className="h-5 w-5 text-gray-400" />
                   <span className="text-sm text-gray-600">Filter by:</span>
                 </div>
                 <div className="flex space-x-2">
                   <button
                     onClick={() => setEmailFilter('all')}
                     className={`px-3 py-1 rounded-full text-sm ${emailFilter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                   >
                     All ({sellers.length})
                   </button>
                   <button
                     onClick={() => setEmailFilter('assigned')}
                     className={`px-3 py-1 rounded-full text-sm ${emailFilter === 'assigned' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                   >
                     Assigned ({allocatedCount})
                   </button>
                   <button
                     onClick={() => setEmailFilter('unassigned')}
                     className={`px-3 py-1 rounded-full text-sm ${emailFilter === 'unassigned' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                   >
                     Unassigned ({unallocatedCount})
                   </button>
                 </div>
               </div>
              
               {/* <div className="flex items-center space-x-2 text-sm text-gray-600">
                 <div className="flex items-center space-x-1">
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   <span>Has emails</span>
                 </div>
                 <div className="flex items-center space-x-1">
                   <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                   <span>No emails</span>
                 </div>
               </div> */}
             </div>
           </div>
         </div>


         {/* Save Status Message */}
         {saveStatus && (
           <div className={`rounded-xl p-4 ${
             saveStatus.type === 'success' ? 'bg-green-50 border border-green-200' :
             saveStatus.type === 'error' ? 'bg-red-50 border border-red-200' :
             'bg-blue-50 border border-blue-200'
           }`}>
             <div className="flex items-center">
               {saveStatus.type === 'success' ? (
                 <Check className="h-5 w-5 text-green-600 mr-3" />
               ) : saveStatus.type === 'error' ? (
                 <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
               ) : (
                 <AlertCircle className="h-5 w-5 text-blue-600 mr-3" />
               )}
               <p className={`text-sm ${
                 saveStatus.type === 'success' ? 'text-green-800' :
                 saveStatus.type === 'error' ? 'text-red-800' :
                 'text-blue-800'
               }`}>
                 {saveStatus.message}
               </p>
             </div>
           </div>
         )}


         {/* Main Table - COMPACT SCROLL FORMAT */}
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
           {/* Table Header */}
           <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
             <div className="flex items-center justify-between">
               <div>
                 <h2 className="text-lg font-semibold text-gray-900">KAM Seller Allocation</h2>
                 <p className="text-gray-600 text-xs mt-1">
                   Click on a seller to assign multiple emails
                 </p>
               </div>
              
             </div>
           </div>


           {/* Loading State */}
           {isLoading ? (
             <div className="p-6">
               <div className="flex flex-col items-center justify-center space-y-3">
                 <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                 <p className="text-gray-600 text-sm">Loading sellers data from GCP...</p>
                 <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                   <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }}></div>
                 </div>
               </div>
             </div>
           ) : (
             <>
               {/* Compact Scrollable Table */}
               <div className="overflow-x-auto">
                 <div className="min-w-full">
                   <div className="border-b border-gray-200">
                     <div className="grid grid-cols-12 gap-1 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                       <div className="col-span-5">Seller Details</div>
                       <div className="col-span-2">Status</div>
                       <div className="col-span-4">Assigned Emails</div>
                       <div className="col-span-1">Actions</div>
                     </div>
                   </div>
                   <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                     {filteredByEmailStatus.length === 0 ? (
                       <div className="px-4 py-8 text-center">
                         <div className="flex flex-col items-center space-y-2">
                           <Search className="h-8 w-8 text-gray-300" />
                           <p className="text-gray-500 text-sm">No sellers found matching your criteria.</p>
                           <button
                             onClick={() => {setSearchTerm(''); setEmailFilter('all');}}
                             className="text-xs text-blue-600 hover:text-blue-800"
                           >
                             Clear filters
                           </button>
                         </div>
                       </div>
                     ) : (
                       filteredByEmailStatus.map((seller) => {
                         const displaySellerEmails = getAllocatedEmailsForSeller(seller.id);
                         const selectedForSeller = selectedEmails[seller.id] || [];
                         const isExpanded = expandedSeller === seller.id;
                        
                         return (
                           <div key={seller.id}>
                             {/* Compact Seller Row */}
                             <div
                               className={`grid grid-cols-12 gap-1 px-4 py-2 items-center hover:bg-gray-50 transition-colors cursor-pointer ${
                                 displaySellerEmails.length > 0 ? 'bg-green-50 hover:bg-green-100' : ''
                               }`}
                               onClick={() => {
                                 // initialize selection state for this seller when user expands
                                 if (!isExpanded) {
                                   if (!Object.prototype.hasOwnProperty.call(selectedEmails, seller.id)) {
                                     setSelectedEmails(prev => ({
                                       ...prev,
                                       [seller.id]: getAllocatedEmailsForSeller(seller.id)
                                     }));
                                   }
                                 }
                                 setExpandedSeller(isExpanded ? null : seller.id);
                               }}
                             >
                               <div className="col-span-5">
                                 <div className="flex items-center space-x-2">
                                   <div className="flex-shrink-0">
                                     <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                                       displaySellerEmails.length > 0 ? 'bg-green-100' : 'bg-gray-100'
                                     }`}>
                                         <Users className={`h-3 w-3 ${
                                           displaySellerEmails.length > 0 ? 'text-green-600' : 'text-gray-600'
                                         }`} />
                                     </div>
                                   </div>
                                   <div className="min-w-0 flex-1">
                                     <div className="text-xs font-medium text-gray-900 truncate">{seller.name}</div>
                                     <div className="text-xs text-gray-500 truncate">
                                       ID: {seller.id}
                                     </div>
                                   </div>
                                 </div>
                               </div>
                               
                               <div className="col-span-2">
                                 <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                   displaySellerEmails.length > 0
                                     ? 'bg-green-100 text-green-800'
                                     : 'bg-gray-100 text-gray-800'
                                 }`}>
                                   {displaySellerEmails.length > 0 ? (
                                     `${displaySellerEmails.length} email${displaySellerEmails.length !== 1 ? 's' : ''}`
                                   ) : (
                                     'No emails'
                                   )}
                                 </span>
                               </div>
                              
                               <div className="col-span-4">
                                 <div className="flex flex-wrap gap-0.5">
                                   {displaySellerEmails.slice(0, 2).map(email => (
                                     <span key={email} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                       <Mail className="h-2.5 w-2.5 mr-0.5" />
                                       {email.split('@')[0]}
                                     </span>
                                   ))}
                                   {displaySellerEmails.length > 2 && (
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                       +{displaySellerEmails.length - 2}
                                     </span>
                                   )}
                                   {displaySellerEmails.length === 0 && (
                                     <span className="text-xs text-gray-400 italic">Click to assign</span>
                                   )}
                                 </div>
                               </div>
                              
                               <div className="col-span-1 text-right">
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     // initialize selection state when toggling from collapsed -> expanded
                                     if (!isExpanded) {
                                       if (!Object.prototype.hasOwnProperty.call(selectedEmails, seller.id)) {
                                         setSelectedEmails(prev => ({
                                           ...prev,
                                           [seller.id]: getAllocatedEmailsForSeller(seller.id)
                                         }));
                                       }
                                     }
                                     setExpandedSeller(isExpanded ? null : seller.id);
                                   }}
                                   className="text-xs text-blue-600 hover:text-blue-800"
                                 >
                                   {isExpanded ? '▲' : '▼'}
                                 </button>
                               </div>
                             </div>
                            
                             {/* Expanded Email Selection - Compact */}
                             {isExpanded && (
                               <div className="bg-blue-50 px-4 py-3 border-t border-blue-100">
                                 <div className="space-y-2">
                                   <div className="flex items-center justify-between">
                                     <div>
                                           <h4 className="text-xs font-medium text-gray-900">
                                             Select emails for {seller.name}
                                           </h4>
                                           <p className="text-xs text-gray-500 mt-0.5">
                                             Selected: {selectedForSeller.length} email{selectedForSeller.length !== 1 ? 's' : ''}
                                           </p>
                                     </div>
                                     <button
                                           onClick={() => handleSelectAllEmails(seller.id)}
                                       className="text-xs text-blue-600 hover:text-blue-800"
                                     >
                                          {selectedForSeller.length === filteredEmails.length ? 'Deselect All' : 'Select All'}
                                     </button>
                                   </div>
                                  
                                   {isLoadingEmails ? (
                                     <div className="flex items-center justify-center py-4">
                                       <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                     </div>
                                   ) : (
                                     <>
                                       <div className="relative">
                                         <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                                         <input
                                           type="text"
                                           value={emailSearchTerm}
                                           onChange={(e) => setEmailSearchTerm(e.target.value)}
                                           placeholder="Search emails..."
                                           className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded text-xs"
                                           onClick={(e) => e.stopPropagation()}
                                         />
                                       </div>
                                      
                                       <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto p-1">
                                         {filteredEmails.map((emailObj) => {
                                           // Check both: (1) user selection state, (2) live sheet allocations
                                           // If already allocated on sheet, keep it checked unless explicitly deselected by user
                                           const isSelectedByUser = selectedForSeller.includes(emailObj.email);
                                           const isAllocatedOnSheet = displaySellerEmails.includes(emailObj.email);
                                           const hasUserLoadedSeller = Object.prototype.hasOwnProperty.call(selectedEmails, seller.id);
                                           const isChecked = hasUserLoadedSeller ? isSelectedByUser : isAllocatedOnSheet;
                                           
                                           return (
                                             <label
                                               key={emailObj.email}
                                               className={`flex items-center space-x-1 p-1.5 rounded border cursor-pointer transition-colors text-xs ${
                                                 isChecked
                                                   ? 'bg-blue-50 border-blue-300'
                                                   : 'bg-white border-gray-200 hover:bg-gray-50'
                                               }`}
                                               onClick={(e) => e.stopPropagation()}
                                             >
                                               <input
                                                 type="checkbox"
                                                 checked={isChecked}
                                                 onChange={() => handleEmailSelection(seller.id, emailObj.email)}
                                                 className="h-3 w-3 text-blue-600 rounded focus:ring-blue-500"
                                               />
                                               <div className="flex-1 min-w-0">
                                                 <div className="font-medium text-gray-900 truncate">
                                                   {emailObj.fullName || emailObj.email.split('@')[0]}
                                                 </div>
                                                 <div className="text-gray-500 truncate text-xs">
                                                   {emailObj.email}
                                                 </div>
                                               </div>
                                               <Mail className={`h-3 w-3 ${
                                                 isChecked ? 'text-blue-600' : 'text-gray-400'
                                               }`} />
                                             </label>
                                           );
                                         })}
                                       </div>
                                      
                                       {filteredEmails.length === 0 && (
                                         <div className="text-center py-2 text-gray-500 text-xs">
                                           No emails found matching your search.
                                         </div>
                                       )}
                                     </>
                                   )}
                                 </div>
                               </div>
                             )}
                           </div>
                         );
                       })
                     )}
                   </div>
                 </div>
               </div>


               {/* Compact Table Footer */}
               <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                   <div className="text-xs text-gray-600">
                     Showing <span className="font-medium">{filteredByEmailStatus.length}</span> of <span className="font-medium">{sellers.length}</span> sellers
                     {searchTerm && ` (filtered)`}
                   </div>
                 </div>
               </div>
             </>
           )}
         </div>


         {/* Email Distribution Dashboard - COMPACT SCROLL FORMAT */}
         <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
           <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
             <div className="flex items-center justify-between">
               <div className="flex items-center space-x-3">
                 <div>
                   <h2 className="text-lg font-semibold text-gray-900">Seller Distribution Dashboard</h2>
                   <p className="text-gray-600 text-xs mt-1">
                     View all seller allocations 
                   </p>
                 </div>
                 <button
                   onClick={() => setShowEmailDashboard(!showEmailDashboard)}
                   className="flex items-center space-x-1 px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs"
                 >
                   {showEmailDashboard ? (
                     <>
                       <EyeOff className="h-3 w-3" />
                       <span>Hide</span>
                     </>
                   ) : (
                     <>
                       <Eye className="h-3 w-3" />
                       <span>Show</span>
                     </>
                   )}
                 </button>
               </div>
               <button
                 onClick={exportDashboardToCSV}
                 className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
               >
                 <Download className="h-3 w-3" />
                 <span>Export</span>
               </button>
             </div>
           </div>
          
           {showEmailDashboard && (
             <div className="p-4">
               {isLoading || isLoadingEmails ? (
                 <div className="flex items-center justify-center py-6">
                   <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                 </div>
               ) : (
                 <div className="space-y-4">
                   {/* Compact Dashboard Stats */}
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                     <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
                       <p className="text-xs font-medium text-blue-800">Total Sellers</p>
                       <p className="text-xl font-bold text-blue-900 mt-1">{sellers.length}</p>
                     </div>
                     <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
                       <p className="text-xs font-medium text-green-800">Allocated</p>
                       <p className="text-xl font-bold text-green-900 mt-1">{allocatedCount}</p>
                       <p className="text-xs text-green-700 mt-0.5">
                         {sellers.length > 0 ? `${Math.round((allocatedCount / sellers.length) * 100)}%` : '0%'}
                       </p>
                     </div>
                     <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
                       <p className="text-xs font-medium text-purple-800">Assignments</p>
                       <p className="text-xl font-bold text-purple-900 mt-1">
                         {totalAssignments}
                       </p>
                     </div>
                     <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3">
                       <p className="text-xs font-medium text-orange-800">Avg/Seller</p>
                       <p className="text-xl font-bold text-orange-900 mt-1">
                         {avgAssignmentsPerSeller}
                       </p>
                     </div>
                   </div>
                  
                   {/* "Allocate All" Button */}
                   <div className="flex justify-center">
                    <button
                      onClick={handleAllocateAll}
                      disabled={!hasPendingChanges() || isSaving}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="font-medium">Allocating...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          <span className="font-medium">Allocate</span>
                        </>
                      )}
                    </button>
                   </div>
                  
                   {/* Compact Dashboard Table - ONE ROW PER EMAIL (Only for sellers with emails) */}
                   <div className="bg-gray-50 rounded-lg">
                     <div className="flex items-center justify-between px-3 py-2">
                       <h3 className="text-sm font-semibold text-gray-900">Seller Allocation Details</h3>
                       <div className="text-xs text-gray-600">
                         {getAllocationsTableData().length} assignments
                       </div>
                     </div>
                    
                     <div className="overflow-x-auto">
                       <div className="min-w-full">
                         <div className="border-b border-gray-200">
                           <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-white">
                             <div>Seller Name</div>
                             <div>Seller ID</div>
                             <div>Assigned Email</div>
                             <div>Assigned By</div>
                           </div>
                         </div>
                         <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                           {getAllocationsTableData().length === 0 ? (
                             <div className="px-3 py-6 text-center">
                               <div className="flex flex-col items-center space-y-2">
                                 <Mail className="h-8 w-8 text-gray-300" />
                                 <p className="text-gray-500 text-sm">No email assignments found.</p>
                                 <p className="text-xs text-gray-400">
                                   Assign emails to sellers to see them in the dashboard.
                                 </p>
                               </div>
                             </div>
                           ) : (
                             getAllocationsTableData().map((row, index) => (
                               <div
                                 key={`${row.sellerId}-${row.assignedEmail}-${index}`}
                                 className="grid grid-cols-4 gap-2 px-3 py-2 items-center hover:bg-white transition-colors text-xs"
                               >
                                 <div className="flex items-center space-x-1.5">
                                   <div className="flex-shrink-0">
                                     <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                                       <Users className="h-2.5 w-2.5 text-blue-600" />
                                     </div>
                                   </div>
                                   <div className="font-medium text-gray-900 truncate">
                                     {row.sellerName}
                                   </div>
                                 </div>
                                 <div className="font-mono text-gray-900 truncate">
                                   {row.sellerId}
                                 </div>
                                 <div className="flex items-center space-x-1">
                                   <Mail className="h-3 w-3 text-blue-500 flex-shrink-0" />
                                   <span className="text-gray-700 truncate">{row.assignedEmail}</span>
                                 </div>
                                 <div className="flex items-center space-x-1">
                                   <User className="h-3 w-3 text-green-500 flex-shrink-0" />
                                   <span className="text-green-700 font-medium truncate">
                                     {row.assignedBy}
                                   </span>
                                 </div>
                               </div>
                             ))
                           )}
                         </div>
                       </div>
                     </div>
                    
                     {/* Compact Table Summary */}
                     {getAllocationsTableData().length > 0 && (
                       <div className="mt-2 pt-2 border-t border-gray-200 px-3 py-2">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-600">
                           <div>
                             {getAllocationsTableData().length} assigned • {allocatedCount} sellers
                           </div>
                           {/* <div className="mt-1 sm:mt-0">
                             Assigned by: <span className="font-medium text-green-700">{currentUserEmail || 'Not specified'}</span>
                           </div> */}
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               )}
             </div>
           )}
         </div>


         {/* Claimed ASINs Management - COMPACT SCROLL FORMAT */}
         {isLeadOrAdmin() && (
           <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
             <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
               <div className="flex items-center justify-between">
                 <div>
                   <h2 className="text-lg font-semibold text-gray-900">Claimed ASINs Management</h2>
                   <p className="text-gray-600 text-xs mt-1">
                     Shows claimed listings from "Table 2 - KAM". Leads/Admins can unclaim listings.
                   </p>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="flex items-center border rounded px-2 py-1 bg-white">
                     <Search className="h-4 w-4 text-gray-400 mr-2" />
                     <input value={claimedSearch} onChange={e => setClaimedSearch(e.target.value)} placeholder="Search listing / ASIN / store / email" className="text-xs outline-none" />
                   </div>
                   <select value={claimedFilter} onChange={e => setClaimedFilter(e.target.value)} className="border px-2 py-1 rounded text-xs">
                     <option value="all">All</option>
                     <option value="claimed">Claimed</option>
                     <option value="in progress">In Progress</option>
                     <option value="completed">Completed</option>
                     <option value="unclaimed">Unclaimed</option>
                   </select>
                   <button onClick={() => { fetchClaimedListings(); }} title="Refresh" className="px-2 py-1 bg-gray-100 rounded text-xs">Refresh</button>
                   <button
                     onClick={exportClaimedToCSV}
                     className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs"
                   >
                     <Download className="h-3 w-3" />
                     <span>Export</span>
                   </button>
                 </div>
               </div>
             </div>
            
             <div className="p-4">
               {isLoadingClaimedListings ? (
                 <div className="flex items-center justify-center py-6">
                   <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div className="bg-gray-50 rounded-lg">
                     <div className="overflow-x-auto">
                       <div className="min-w-full">
                         <div className="border-b border-gray-200">
                           <div className="grid grid-cols-8 gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase bg-white">
                             <div>Listing ID</div>
                             <div>ASIN</div>
                             <div className="col-span-2">Store Name</div>
                             <div>Status</div>
                             <div>Claimed By</div>
                             <div>Claimed At</div>
                             <div>Action</div>
                           </div>
                         </div>

                         <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
                           {filteredClaimedListings.length === 0 ? (
                             <div className="p-6 text-center text-sm text-gray-500">
                               <Clock className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                               No claimed listings found.
                             </div>
                           ) : (
                             filteredClaimedListings.map(item => {
                               const canUnclaim = (item.Claimed_Status || '').toString().toLowerCase() === 'claimed' && !(item.End_Time);
                               return (
                                 <div key={(item['listing-id']||'') + (item.rowIndex||'')} className="grid grid-cols-8 gap-2 px-3 py-2 items-center text-xs hover:bg-white">
                                   <div className="font-mono truncate">{item['listing-id'] || '-'}</div>
                                   <div className="truncate">{item.asin1 || '-'}</div>
                                   <div className="col-span-2 truncate">{item.store_name || '-'}</div>
                                   <div><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">{item.Claimed_Status || 'Claimed'}</span></div>
                                   <div className="truncate">{item.Email_id || '-'}</div>
                                   <div className="truncate text-xs text-gray-600">{item.Last_Claim_Timestamp || '-'}</div>
                                   <div className="text-right">
                                     {canUnclaim ? (
                                       <button
                                         onClick={() => handleUnclaimListing(item['listing-id'])}
                                         disabled={unclaimingListingId === item['listing-id']}
                                         className="inline-flex items-center space-x-1 px-2 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-50"
                                       >
                                         {unclaimingListingId === item['listing-id'] ? (<Loader2 className="h-3 w-3 animate-spin" />) : (<Trash2 className="h-3 w-3" />)}
                                         <span>Unclaim</span>
                                       </button>
                                     ) : (
                                       <span className="text-xs text-gray-400 italic">{item.End_Time ? 'Completed' : 'N/A'}</span>
                                     )}
                                   </div>
                                 </div>
                               );
                             })
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           </div>
         )}
       </div>
     </div>
   </div>
 );
};


export default SellerAllocationPage;

