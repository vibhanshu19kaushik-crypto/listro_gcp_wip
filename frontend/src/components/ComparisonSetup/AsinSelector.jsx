import React from 'react';
import { ChevronDown, Download, Loader2, AlertCircle } from 'lucide-react';

const AsinSelector = ({
  selectedAsin,
  asinList,
  asinDropdownOpen,
  setAsinDropdownOpen,
  isLoadingAsins,
  asinCompletionStatus,
  asinSearchQuery,
  setAsinSearchQuery,
  isScrapingMetadata,
  onAsinSelect,
  onLoadMetadata
}) => {
  const filteredAsins = asinList.filter(a => a.asin.toLowerCase().includes(asinSearchQuery.toLowerCase()));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Selected Claimed Listings from Previous Step</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select a ASIN to View Its Metadata</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <button
                type="button"
                className="w-full flex items-center justify-between border border-gray-300 rounded-md px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => setAsinDropdownOpen(!asinDropdownOpen)}
                disabled={isLoadingAsins || asinList.length === 0}
              >
                <span className={`${selectedAsin ? 'text-gray-900' : 'text-gray-500'} truncate`}>
                  {selectedAsin
                    ? `ASIN: ${selectedAsin}${asinCompletionStatus[selectedAsin]?.isCompleted ? ' (Completed ✓)' : ''}`
                    : isLoadingAsins ? 'Loading claimed listings...' : asinList.length > 0 ? `Select from ${asinList.length} listings` : 'No claimed listings found'}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${asinDropdownOpen ? 'transform rotate-180' : ''}`} />
              </button>

              {asinDropdownOpen && asinList.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-72 overflow-y-auto">
                  <div className="py-1">
                    <div className="px-3 py-3 bg-gray-50 border-b sticky top-0">
                      <input
                        type="text" placeholder="Search ASIN..." value={asinSearchQuery}
                        onChange={(e) => setAsinSearchQuery(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {filteredAsins.map((data, idx) => (
                      <button
                        key={idx} type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-b-0 ${!data.canEdit ? 'bg-gray-50 text-gray-400' : ''}`}
                        onClick={() => data.canEdit && onAsinSelect(data.asin)}
                        disabled={!data.canEdit}
                      >
                        <div className="font-mono">{data.asin}</div>
                        <div className="text-xs text-gray-500 mt-0.5 flex justify-between">
                          <span>Listing {idx + 1} of {asinList.length}</span>
                          {data.isCompleted ? <span className="text-red-500 font-medium">✓ Completed</span> : data.canEdit ? <span className="text-green-500 font-medium">✓ Available</span> : <span>Unavailable</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => onLoadMetadata(selectedAsin)}
              disabled={!selectedAsin || isScrapingMetadata || (asinCompletionStatus[selectedAsin]?.isCompleted)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2 font-medium"
            >
              {isScrapingMetadata ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Loading...</span></> : <><Download className="h-4 w-4" /><span>Load Metadata</span></>}
            </button>
          </div>
          
          <div className="mt-2 text-xs text-amber-600 flex items-center">
            {!selectedAsin && asinList.length > 0 && <><AlertCircle className="h-3 w-3 mr-1" />Select an available ASIN and click "Load Metadata"</>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsinSelector;
