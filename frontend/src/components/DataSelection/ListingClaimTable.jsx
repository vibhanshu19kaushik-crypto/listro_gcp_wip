import React from 'react';
import { Search, X, Database, ExternalLink, Calendar, Timer, CheckCircle } from 'lucide-react';
import { getColumnValue, formatTimestamp, formatTableName } from '../../utils/dataUtils';
import { ClaimStatusBadge } from './StatusBadges';

const ListingClaimTable = ({
  rawResourceData,
  sortedAndFilteredData,
  selectedListings,
  toggleListingSelection,
  userEmail,
  table2SearchTerm,
  setTable2SearchTerm,
  sortConfig,
  handleSort,
  isSortDropdownOpen,
  setIsSortDropdownOpen,
  TABLE_2_NAME
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-0 translate-y-4 animate-fadeInUp" style={{ animation: 'fadeInUp 0.6s ease-out forwards', animationDelay: '0.2s' }}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Select Listings to Optimize</h2>
            <div className="text-gray-600 mt-1 text-sm">
              Selected: <span className="font-bold text-blue-600">{selectedListings.size}</span> available listings
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-md">
              <Database className="h-3 w-3" />
              <span>Table: {formatTableName(TABLE_2_NAME)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 w-full">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ASIN, Listing ID, Store Name..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={table2SearchTerm}
              onChange={(e) => setTable2SearchTerm(e.target.value)}
            />
            {table2SearchTerm && <button onClick={() => setTable2SearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"><X className="h-4 w-4" /></button>}
          </div>
        </div>
        
        <div className="relative">
          <button onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
            Sort {sortConfig.key && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
          </button>
          {isSortDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-md shadow-lg z-50">
              {['store-name', 'asin', 'listing-id', 'status', 'claimed-by', 'last-claim'].map(key => (
                <button key={key} onClick={() => { handleSort(key); setIsSortDropdownOpen(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sortConfig.key === key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                  {key.replace('-', ' ').toUpperCase()} {sortConfig.key === key && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-6 py-3 w-12 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[150px]">STORE NAME</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ASIN</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LISTING ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STATUS</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">Item Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px]">Listing Link</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">CLAIMED STATUS</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CLAIMED BY</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Last Claim (IST)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAndFilteredData.map((item, idx) => {
              const listingId = getColumnValue(item, ['listing-id', 'listing_id', 'listingId']);
              const claimedBy = getColumnValue(item, ['Email_id', 'Email_ID', 'email_id', 'claimed_by']) || '';
              const isClaimedByUser = claimedBy.toLowerCase() === (userEmail || '').toLowerCase();
              const endTime = getColumnValue(item, ['End_Time', 'end_time']) || '';
              const isCompleted = endTime && endTime.trim() !== '';
              const claimedStatus = getColumnValue(item, ['Claimed_Status', 'claimed_status', 'Claimed Status']);
              const isClaimed = claimedStatus === 'Claimed' || claimedStatus === 'In Progress';

              return (
                <tr key={idx} className={`${isCompleted ? 'bg-green-50' : isClaimedByUser ? 'bg-blue-50' : ''} hover:bg-gray-50 transition-colors`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {listingId && !isCompleted && (
                      <input
                        type="checkbox"
                        checked={selectedListings.has(listingId)}
                        onChange={() => toggleListingSelection(listingId)}
                        disabled={isClaimed && !isClaimedByUser}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{getColumnValue(item, ['store_name', 'storeName', 'Store Name']) || '-'}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{getColumnValue(item, ['asin1', 'asin', 'ASIN']) || '-'}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{listingId || '-'}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{getColumnValue(item, ['status', 'Status']) || '-'}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 min-w-[200px]"><span className="truncate">{getColumnValue(item, ['item-name', 'item_name', 'itemName', 'Item Name']) || '-'}</span></td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <a href={`https://www.amazon.in/dp/${getColumnValue(item, ['asin1', 'asin', 'ASIN'])}`} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline">
                      <ExternalLink size={12}/> View
                    </a>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    <ClaimStatusBadge listingId={listingId} claimedStatus={claimedStatus} claimedBy={claimedBy} endTime={endTime} startTime={getColumnValue(item, ['Start_Time', 'start_time'])} userEmail={userEmail} />
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm">
                    {isClaimedByUser ? <span className="text-blue-600 font-medium">You</span> : claimedBy ? <span className="text-gray-600">Another user</span> : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 min-w-[180px]">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar size={12}/> {formatTimestamp(getColumnValue(item, ['Last_Claim_Timestamp', 'last_claim_timestamp']))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ListingClaimTable;
