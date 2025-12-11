// src/pages/SellerAllocationPage.jsx

import { useState, useEffect } from 'react';
import { Loader2, Check, AlertCircle, UserPlus, Search, X, Users, Save } from 'lucide-react';
import { fetchSheetData } from '../api/api'; // Use consolidated API

const SellerAllocationPage = () => {
  const [sellers, setSellers] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  // Team members for allocation (can be moved to config/DB later)
  const teamMembers = ['Vibhanshu', 'Ashutosh', 'Rudra', 'Shubham', 'Karan', 'Sai'];

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
                name: storeName, // Using store_name as seller name
                storeName: storeName
              });
            }
          }
        });

        const uniqueSellers = Array.from(sellerMap.values());
        
        // Load existing allocations from localStorage (or API)
        const savedAllocations = JSON.parse(localStorage.getItem('seller_allocations') || '{}');
        
        // Initialize allocations
        const initialAllocations = {};
        uniqueSellers.forEach(seller => {
          initialAllocations[seller.id] = savedAllocations[seller.id] || '';
        });

        setSellers(uniqueSellers);
        setAllocations(initialAllocations);
        
        console.log(`✅ Loaded ${uniqueSellers.length} sellers from GCP`);
      } catch (error) {
        console.error('Failed to fetch sellers from GCP:', error);
        setError(`Failed to load sellers: ${error.message}`);
        
        // Fallback to mock data if GCP fails
        const mockSellers = [
          { id: 'SELL001', name: 'TechGadgets Inc', storeName: 'TechGadgets Store' },
          { id: 'SELL002', name: 'FashionHub', storeName: 'FashionHub Boutique' },
          { id: 'SELL003', name: 'HomeEssentials', storeName: 'Home & Living' },
          { id: 'SELL004', name: 'SportsGear Pro', storeName: 'Sports Equipment' },
        ];
        
        setSellers(mockSellers);
        const initialAllocations = {};
        mockSellers.forEach(seller => {
          initialAllocations[seller.id] = '';
        });
        setAllocations(initialAllocations);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellersData();
  }, []);

  // Handle allocation change
  const handleAllocationChange = (sellerId, teamMember) => {
    const newAllocations = {
      ...allocations,
      [sellerId]: teamMember
    };
    setAllocations(newAllocations);
  };

  // Handle allocate all button
  const handleAllocateAll = () => {
    const updatedAllocations = { ...allocations };
    let memberIndex = 0;
    
    sellers.forEach(seller => {
      if (!updatedAllocations[seller.id]) {
        updatedAllocations[seller.id] = teamMembers[memberIndex % teamMembers.length];
        memberIndex++;
      }
    });
    
    setAllocations(updatedAllocations);
    setSaveStatus({ 
      type: 'info', 
      message: 'All unallocated sellers have been assigned team members.' 
    });
  };

  // Handle clear all allocations
  const handleClearAll = () => {
    const clearedAllocations = {};
    sellers.forEach(seller => {
      clearedAllocations[seller.id] = '';
    });
    setAllocations(clearedAllocations);
    setSaveStatus({ 
      type: 'info', 
      message: 'All allocations have been cleared.' 
    });
  };

  // Handle save allocations
  const handleSaveAllocations = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      // Save to localStorage (replace with API call to your backend)
      localStorage.setItem('seller_allocations', JSON.stringify(allocations));
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setSaveStatus({ 
        type: 'success', 
        message: 'Allocations saved successfully!' 
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus(null);
      }, 3000);
    } catch (error) {
      setSaveStatus({ 
        type: 'error', 
        message: 'Failed to save allocations. Please try again.' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter sellers based on search term
  const filteredSellers = sellers.filter(seller =>
    seller.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    seller.storeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Count allocations
  const allocatedCount = Object.values(allocations).filter(val => val !== '').length;
  const unallocatedCount = sellers.length - allocatedCount;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">Seller Allocation Dashboard Panel</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Assign team members to manage specific sellers. Data is fetched directly from GCP BigQuery.
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <p className="text-sm font-medium text-gray-600">Allocated</p>
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
                  onClick={handleAllocateAll}
                  disabled={unallocatedCount === 0}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Allocate All Remaining
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={allocatedCount === 0}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear All
                </button>
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

          {/* Main Table */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Seller Allocation</h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Assign team members from the dropdown in the "Assigned To" column
                  </p>
                </div>
                <button
                  onClick={handleSaveAllocations}
                  disabled={isSaving}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span className="font-medium">Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-gray-600">Loading sellers data from GCP...</p>
                  <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seller Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seller ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Store Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Assigned To
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredSellers.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center space-y-3">
                              <Search className="h-12 w-12 text-gray-300" />
                              <p className="text-gray-500">No sellers found matching your search.</p>
                              <button
                                onClick={() => setSearchTerm('')}
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                Clear search
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSellers.map((seller) => (
                          <tr 
                            key={seller.id} 
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0">
                                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-blue-600" />
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{seller.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 font-mono">{seller.id}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600">{seller.storeName}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="relative">
                                <select
                                  value={allocations[seller.id] || ''}
                                  onChange={(e) => handleAllocationChange(seller.id, e.target.value)}
                                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none ${
                                    allocations[seller.id] 
                                      ? 'border-green-300 bg-green-50 text-green-700' 
                                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                  }`}
                                >
                                  <option value="">-- Select Team Member --</option>
                                  {teamMembers.map((member) => (
                                    <option key={member} value={member}>
                                      {member}
                                    </option>
                                  ))}
                                </select>
                                {allocations[seller.id] ? (
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                    <Check className="h-4 w-4 text-green-600" />
                                  </div>
                                ) : (
                                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-medium">{filteredSellers.length}</span> of <span className="font-medium">{sellers.length}</span> sellers
                      {searchTerm && ` (filtered by: "${searchTerm}")`}
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-xs text-gray-600">Allocated</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <span className="text-xs text-gray-600">Unallocated</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Team Members Info */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {teamMembers.map((member) => {
                const assignedCount = Object.values(allocations).filter(val => val === member).length;
                return (
                  <div 
                    key={member} 
                    className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 border border-blue-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-900">{member}</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {assignedCount} seller{assignedCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-600">
                          {assignedCount}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${(assignedCount / sellers.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">How to Use</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-bold text-blue-600">1</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Use the dropdown to assign team members to sellers
                      </p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-bold text-blue-600">2</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Search for specific sellers using the search bar
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-bold text-blue-600">3</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Use bulk actions to allocate remaining or clear all
                      </p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                        <span className="text-xs font-bold text-blue-600">4</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Click Save to store allocations (saved locally)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerAllocationPage;