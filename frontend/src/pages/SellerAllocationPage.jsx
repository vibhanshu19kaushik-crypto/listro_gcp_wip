import { useState, useEffect } from 'react';
import { Loader2, Plus, AlertCircle, RefreshCw, LayoutDashboard, Database } from 'lucide-react';

// --- Custom Hooks ---
import { useSellerAllocationManager } from '../hooks/useSellerAllocationManager';
import { useClaimedListings } from '../hooks/useClaimedListings';

// --- UI Components ---
import AllocationStats from '../components/SellerAllocation/AllocationStats';
import SellerAllocationTable from '../components/SellerAllocation/SellerAllocationTable';
import DistributionDashboard from '../components/SellerAllocation/DistributionDashboard';
import ClaimedListingsDashboard from '../components/SellerAllocation/ClaimedListingsDashboard';

// --- Utilities ---
import { isLeadOrAdmin, calculateAllocationStats, exportToCSV } from '../utils/allocationUtils';

const SellerAllocationPage = () => {
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [activeTab, setActiveTab] = useState('allocation'); // 'allocation' or 'claimed'

  // Dashboard Filters (moved to orchestrator for better coordination)
  const [claimedSearch, setClaimedSearch] = useState('');
  const [claimedFilter, setClaimedFilter] = useState('all');

  // 1. Logic Hooks
  const allocation = useSellerAllocationManager(currentUserEmail);
  const claimed = useClaimedListings(currentUserEmail);

  // 2. Initial Setup
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user?.email) setCurrentUserEmail(user.email);
    if (isLeadOrAdmin()) claimed.fetchClaimedListings();
  }, []);

  // 3. Handlers
  const handleBulkSync = async () => {
    const res = await allocation.handleSyncToSheet();
    if (res.success) {
      if (res.changes) {
        alert(`✅ Success: ${res.allocated} allocated, ${res.unallocated} unallocated.`);
        window.location.reload();
      } else {
        alert('ℹ️ No changes to apply.');
      }
    } else {
      alert(`❌ Error: ${res.error}`);
    }
  };

  const onExportRegistry = () => {
    const tableData = allocation.dbAllocations
      .filter(r => (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED')
      .map(r => [
        r.Seller_name || r.sellerName || '',
        r.Seller_ID || r.sellerId || '',
        r.Resource_Email || r.resourceEmail || '',
        r.Assigned_by || 'Unknown'
      ]);
    exportToCSV(['Seller Name', 'Seller ID', 'Assigned Email', 'Assigned By'], tableData, 'kam_registry');
  };

  // 4. Filtered Data
  const stats = calculateAllocationStats(allocation.sellers, allocation.dbAllocations);
  
  const filteredClaimed = claimed.claimedListings.filter(row => {
    const q = claimedSearch.toLowerCase();
    const matchesSearch = !q || (
      (row['listing-id'] || '') + (row.asin1 || '') + (row.store_name || '') + (row.Email_id || '')
    ).toLowerCase().includes(q);
    
    const matchesFilter = claimedFilter === 'all' || (row.Claimed_Status || '').toLowerCase() === claimedFilter;
    return matchesSearch && matchesFilter;
  });

  if (allocation.isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 space-y-4">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        <p className="text-gray-500 font-medium">Synchronizing KAM Registry...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">System Administration</h1>
            <p className="text-gray-500 flex items-center gap-2">
              Resource Management & Security Monitoring 
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
              <span className="text-blue-600 font-bold">{currentUserEmail}</span>
            </p>
          </div>

          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
            <button 
              onClick={() => setActiveTab('allocation')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'allocation' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutDashboard size={18} /> KAM Allocation
            </button>
            <button 
              onClick={() => setActiveTab('claimed')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'claimed' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Database size={18} /> Claimed ASINs
            </button>
          </div>
        </div>

        {activeTab === 'allocation' ? (
          <div className="space-y-10">
            <AllocationStats 
              sellersCount={allocation.sellers.length}
              emailsCount={allocation.emails.length}
              {...stats}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 flex flex-col gap-8">
                <SellerAllocationTable 
                  sellers={allocation.sellers}
                  emails={allocation.emails}
                  dbAllocations={allocation.dbAllocations}
                  selectedEmails={allocation.selectedEmails}
                  onSelectEmail={allocation.handleEmailSelection}
                  onSelectAllForSeller={allocation.handleSelectAllForSeller}
                  isLoading={allocation.isLoading}
                />
              </div>

              <div className="lg:col-span-4 space-y-8">
                {/* Action Card */}
                <div className="bg-[#131921] text-white p-8 rounded-2xl shadow-2xl border-b-4 border-blue-500 sticky top-8">
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <RefreshCw className={allocation.isSaving ? 'animate-spin' : ''} />
                    Sync Status
                  </h3>
                  <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                    Changes made in the table are staged in memory. Click the button below to synchronize with Google Sheets.
                  </p>
                  <button
                    onClick={handleBulkSync}
                    disabled={allocation.isSaving}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-900/40 flex items-center justify-center gap-3"
                  >
                    {allocation.isSaving ? <Loader2 className="animate-spin" /> : <Plus size={24} />}
                    {allocation.isSaving ? 'Synchronizing...' : 'Apply All Changes'}
                  </button>
                </div>

                <DistributionDashboard 
                  data={allocation.dbAllocations.filter(r => (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED').map(r => ({
                    sellerName: r.Seller_name || r.sellerName || '',
                    sellerId: r.Seller_ID || r.sellerId || '',
                    assignedEmail: r.Resource_Email || r.resourceEmail || '',
                    assignedBy: r.Assigned_by || 'System'
                  }))}
                  onExport={onExportRegistry}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {isLeadOrAdmin() ? (
              <ClaimedListingsDashboard 
                listings={filteredClaimed}
                isLoading={claimed.isLoading}
                onUnclaim={claimed.handleUnclaim}
                unclaimingId={claimed.unclaimingId}
                onRefresh={claimed.fetchClaimedListings}
                onExport={() => claimed.exportToCSV_Dashboard(filteredClaimed)}
                search={claimedSearch}
                setSearch={setClaimedSearch}
                filter={claimedFilter}
                setFilter={setClaimedFilter}
              />
            ) : (
              <div className="bg-red-50 border-2 border-dashed border-red-200 p-20 rounded-3xl text-center">
                <AlertCircle className="h-20 w-20 text-red-600 mx-auto mb-6" />
                <h2 className="text-3xl font-black text-red-900 mb-2">Access Restricted</h2>
                <p className="text-red-700 max-w-md mx-auto">This dashboard is only available to Lead or Admin users. Please contact your supervisor for authorization.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerAllocationPage;
