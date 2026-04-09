import React from 'react';
import { Loader2, Search, Download, Trash2, Clock } from 'lucide-react';

const ClaimedListingsDashboard = ({ 
  listings, 
  isLoading, 
  onUnclaim, 
  unclaimingId, 
  onExport,
  onRefresh,
  search,
  setSearch,
  filter,
  setFilter
}) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Claimed ASINs Management</h2>
            <p className="text-gray-600 text-xs mt-1">Status monitoring for KAM-claimed products.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center border rounded px-2 py-1 bg-white">
              <Search className="h-4 w-4 text-gray-400 mr-2" />
              <input 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Search listing / ASIN..." 
                className="text-xs outline-none w-40" 
              />
            </div>
            <select 
              value={filter} 
              onChange={e => setFilter(e.target.value)} 
              className="border px-2 py-1 rounded text-xs bg-white"
            >
              <option value="all">All Status</option>
              <option value="claimed">Claimed</option>
              <option value="in progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <button onClick={onRefresh} className="px-2 py-1 bg-gray-100 rounded text-xs hover:bg-gray-200">Refresh</button>
            <button onClick={onExport} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs">
              <Download className="h-3 w-3" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Listing ID / ASIN</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Claimed By</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 overflow-y-auto max-h-96">
                {listings.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-12 text-center text-gray-500 text-sm">No listings found matching filters.</td>
                  </tr>
                ) : (
                  listings.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-50 text-xs">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r['listing-id']}</div>
                        <div className="text-gray-500 text-[10px]">{r.asin1}</div>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[150px]">{r.store_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          r.Claimed_Status?.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                          r.Claimed_Status?.toLowerCase() === 'in progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          {r.Claimed_Status}
                        </span>
                      </td>
                      <td className="px-4 py-3 truncate max-w-[120px]">{r.Email_id?.split('@')[0]}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {r.Last_Claim_Timestamp?.split(' ')[0]}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => onUnclaim(r['listing-id'])}
                          disabled={unclaimingId === r['listing-id']}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          title="Unclaim listing"
                        >
                          {unclaimingId === r['listing-id'] ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClaimedListingsDashboard;
