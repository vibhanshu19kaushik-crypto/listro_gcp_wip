import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Edit3, Plus, AlertCircle, XCircle, CheckCircle } from 'lucide-react';

// --- Custom Hooks ---
import { useUserClaims } from '../hooks/useUserClaims';
import { useSellerManager } from '../hooks/useSellerManager';
import { useListingSelection } from '../hooks/useListingSelection';
import { useResourceTableState } from '../hooks/useResourceTableState';

// --- Components ---
import SellerDropdown from '../components/DataSelection/SellerDropdown';
import ListingClaimTable from '../components/DataSelection/ListingClaimTable';
import SimpleDataTable from '../components/DataSelection/SimpleDataTable';

// --- Utilities & API ---
import { downloadListingCsv } from '../utils/dataUtils';

const TABLE_SOURCES = {
  TABLE_1: 'ops-excellence.amazon_sp_data.GET_MERCHANT_LISTINGS_ALL_DATA',
  TABLE_2: 'ops-excellence.Listro_Listing.Resource_Allocation'
};

const DataSelectionPage = () => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Hooks Setup
  const { 
    userEmail, userActiveClaimCount, setUserActiveClaimCount 
  } = useUserClaims();

  const onClaimsLoaded = useCallback((count) => {
    setUserActiveClaimCount(count);
  }, [setUserActiveClaimCount]);

  const sellerState = useSellerManager(userEmail, onClaimsLoaded);

  const listingState = useListingSelection(
    userEmail, 
    sellerState.rawResourceData, 
    onClaimsLoaded
  );

  const tableState = useResourceTableState(sellerState.rawResourceData);

  // 2. Auth Guard
  useEffect(() => {
    if (!localStorage.getItem("user")) navigate("/login", { replace: true });
  }, [navigate]);

  // 3. Handlers
  const getSelectedDisplayName = useCallback(() => {
    if (!sellerState.selectedSeller) return '';
    const option = sellerState.availableOptions.find(o => o.id === sellerState.selectedSeller);
    return option ? option.displayName : sellerState.selectedSeller;
  }, [sellerState.selectedSeller, sellerState.availableOptions]);

  const handleSellerChange = async (sellerId, storeName) => {
    setIsDropdownOpen(false);
    setSearchTerm('');
    try {
      const result = await sellerState.handleSellerChange(sellerId, storeName, userEmail);
      if (result.userClaimedIds) {
        listingState.setSelectedListings(new Set(result.userClaimedIds));
      }
    } catch (err) {
      console.error('Failed to change seller:', err);
    }
  };

  const onEditExisting = async () => {
    const success = await listingState.claimSelectedListings(
      sellerState.selectedSeller, 
      sellerState.availableOptions
    );
    
    if (success) {
      const selectedAsins = sellerState.rawResourceData
        .filter(item => listingState.selectedListings.has(item['listing-id']))
        .map(item => item.asin1)
        .filter(Boolean);
      
      localStorage.setItem('selectedAsins', JSON.stringify(selectedAsins));
      localStorage.setItem('actionType', 'edit');
      
      setTimeout(() => navigate(`/setup/${sellerState.selectedSeller}`), 2000);
    }
  };

  const onCreateNew = () => {
    localStorage.removeItem('selectedAsins');
    localStorage.setItem('actionType', 'new');
    navigate(sellerState.selectedSeller ? `/setup/${sellerState.selectedSeller}` : '/setup/new');
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeInUp">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">Select Seller Data</h1>
            <p className="text-gray-600 text-sm">Follow these simple steps to optimize your Amazon product listings</p>
            <p className="text-base text-gray-600 max-w-2xl mx-auto mt-2">
              {sellerState.userHasAllocations 
                ? "Search and select your allocated sellers to load listing data and begin the optimization process."
                : "You don't have any sellers allocated. You can create new product listings."}
            </p>
          </div>

          <SellerDropdown 
            {...sellerState}
            isDropdownOpen={isDropdownOpen}
            setIsDropdownOpen={setIsDropdownOpen}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            onSellerChange={handleSellerChange}
            getSelectedDisplayName={getSelectedDisplayName}
          />

          {!sellerState.userHasAllocations && !sellerState.isLoadingDropdown && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-3">
              <AlertCircle className="text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">No Sellers Allocated</p>
                <p className="text-xs text-amber-700">Contact admin or use "Create New Product Listing" below.</p>
              </div>
            </div>
          )}

          {sellerState.isLoading && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600">Fetching data for {getSelectedDisplayName()}...</p>
            </div>
          )}

          {sellerState.rawFilteredData && !sellerState.isLoading && (
            <>
              <SimpleDataTable 
                data={sellerState.rawFilteredData}
                headers={sellerState.tableHeaders}
                tableName={TABLE_SOURCES.TABLE_1}
                getSelectedDisplayName={getSelectedDisplayName}
                onDownload={() => downloadListingCsv(sellerState.rawFilteredData, sellerState.tableHeaders, sellerState.selectedSeller)}
              />

              <div className="mt-8">
                <ListingClaimTable 
                  {...listingState}
                  {...tableState}
                  rawResourceData={sellerState.rawResourceData}
                  userEmail={userEmail}
                  TABLE_2_NAME={TABLE_SOURCES.TABLE_2}
                />
              
                {(listingState.selectionError || listingState.submitError) && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <XCircle className="text-red-500" />
                    <p className="text-red-700 text-sm">{listingState.selectionError || listingState.submitError}</p>
                  </div>
                )}

                {listingState.successMessage && (
                  <div className="fixed top-4 right-4 bg-green-50 border border-green-300 rounded-lg p-4 shadow-lg z-50 animate-bounce">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="text-green-600" />
                      <p className="text-green-800 font-medium">{listingState.successMessage}</p>
                    </div>
                  </div>
                )}
              
                <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">Active Claims: <span className="text-green-600">{userActiveClaimCount}</span></p>
                    <p className="text-xs text-gray-500">Selected for new claim: {listingState.selectedListings.size}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={onEditExisting}
                      disabled={!sellerState.selectedSeller || (listingState.selectedListings.size === 0 && !listingState.userHasClaimsForThisSeller) || listingState.isSubmittingClaims}
                      className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {listingState.isSubmittingClaims ? <Loader2 className="animate-spin" size={18}/> : <Edit3 size={18}/>}
                      <span>Edit Existing Listing</span>
                    </button>
                    <button
                      onClick={onCreateNew}
                      disabled={listingState.selectedListings.size > 0}
                      className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      <Plus size={18}/>
                      <span>Create New Product Listing</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* How It Works Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">How It Works</h2>
              <p className="text-gray-600 text-sm">Follow these simple steps to optimize your Amazon product listings</p>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { n: 1, c: 'blue', t: 'Select Data', d: 'Search and select by Store Name or Seller ID to load your listing data' },
                { n: 2, c: 'green', t: 'Compare & Setup', d: 'View the gold standard and decide whether to edit existing or create new listings' },
                { n: 3, c: 'purple', t: 'Optimization', d: 'Use Listro tools to enhance titles, descriptions, and generate better product listing images' },
                { n: 4, c: 'orange', t: 'Publish & Track', d: 'Review final changes and publish your optimized listings to Amazon' }
              ].map(s => (
                <div key={s.n} className={`text-center p-4 bg-${s.c}-50 rounded-lg`}>
                  <div className={`w-12 h-12 bg-${s.c}-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-lg font-bold`}>
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">{s.t}</h3>
                  <p className="text-gray-600 text-xs">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {isDropdownOpen && <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />}
    </div>
  );
};

export default DataSelectionPage;
