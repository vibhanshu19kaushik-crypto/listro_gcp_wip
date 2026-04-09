import React from 'react';
import { Search, ChevronDown, Loader2, X } from 'lucide-react';

const SellerDropdown = ({
  selectedSeller,
  setSelectedSeller,
  availableOptions,
  isDropdownOpen,
  setIsDropdownOpen,
  searchTerm,
  setSearchTerm,
  isLoadingDropdown,
  userHasAllocations,
  onSellerChange,
  getSelectedDisplayName
}) => {
  const filteredOptions = availableOptions.filter(option =>
    option.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.storeName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {userHasAllocations ? "Search Your Allocated Sellers" : "No Sellers Allocated"}
            </label>
          
            <div className="relative">
              <button
                onClick={() => userHasAllocations && setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left text-sm flex items-center justify-between cursor-pointer hover:bg-gray-50 ${
                  !userHasAllocations ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                }`}
                disabled={isLoadingDropdown || !userHasAllocations}
              >
                <span className="truncate">
                  {selectedSeller ? getSelectedDisplayName() :
                   userHasAllocations ? 'Select your allocated seller...' :
                   'No sellers allocated to your account'}
                </span>
                {isLoadingDropdown ? (
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                ) : (
                  <ChevronDown className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                )}
              </button>

              {isDropdownOpen && userHasAllocations && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-hidden">
                  <div className="p-2 border-b border-gray-200">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search your allocated sellers..."
                        className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        autoFocus
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="overflow-y-auto max-h-60">
                    {filteredOptions.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 text-center">
                        {isLoadingDropdown ? 'Loading...' : 'No allocated sellers found'}
                      </div>
                    ) : (
                      filteredOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => onSellerChange(option.id, option.storeName)}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                            selectedSeller === option.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                          }`}
                        >
                          <div className="font-medium">{option.storeName}</div>
                          <div className="text-xs text-gray-500 mt-1">Seller ID: {option.id}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerDropdown;
