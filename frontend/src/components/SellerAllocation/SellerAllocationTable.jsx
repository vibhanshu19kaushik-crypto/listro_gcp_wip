import React, { useState } from 'react';
import { Search, Mail, Users, Loader2 } from 'lucide-react';

const SellerAllocationTable = ({ 
  sellers, 
  emails, 
  dbAllocations, 
  selectedEmails,
  onSelectEmail,
  onSelectAllForSeller,
  isLoading,
  isLoadingEmails
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emailSearchTerm, setEmailSearchTerm] = useState('');
  const [expandedSeller, setExpandedSeller] = useState(null);

  const getAllocatedEmailsForSeller = (sellerId) => {
    return Array.from(new Set(
      (dbAllocations || [])
        .filter(r => (r.Allocation_Status || '').toUpperCase().trim() === 'ALLOCATED' && (r.Seller_ID == sellerId || r.sellerId == sellerId))
        .map(r => r.Resource_Email || r.resourceEmail || '').filter(Boolean)
    ));
  };

  const filteredSellers = sellers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEmails = emails.filter(e => 
    e.email.toLowerCase().includes(emailSearchTerm.toLowerCase()) ||
    (e.fullName && e.fullName.toLowerCase().includes(emailSearchTerm.toLowerCase()))
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">KAM Seller Allocation</h2>
          <p className="text-gray-600 text-xs">Manage resource mapping between internal KAMs and sellers.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search sellers..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="divide-y divide-gray-200 max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" /></div>
        ) : filteredSellers.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No sellers matching search criteria.</div>
        ) : (
          filteredSellers.map((seller) => {
            const liveAllocated = getAllocatedEmailsForSeller(seller.id);
            const selectedForSeller = selectedEmails[seller.id] || [];
            const isExpanded = expandedSeller === seller.id;
            
            // Checkbox state: if user has interacted, use selectedEmails[seller.id], else use liveAllocated
            const isModified = Object.prototype.hasOwnProperty.call(selectedEmails, seller.id);
            const displayList = isModified ? selectedForSeller : liveAllocated;

            return (
              <div key={seller.id} className="transition-colors border-l-4 border-transparent hover:border-blue-500">
                <div 
                  className={`px-4 py-3 flex items-center justify-between cursor-pointer ${displayList.length > 0 ? 'bg-green-50/30' : ''}`}
                  onClick={() => setExpandedSeller(isExpanded ? null : seller.id)}
                >
                  <div className="flex items-center gap-3 w-1/3">
                    <div className={`p-2 rounded-full ${displayList.length > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      <Users size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{seller.name}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{seller.id}</div>
                    </div>
                  </div>

                  <div className="w-1/4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${displayList.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {displayList.length} ASSIGNED
                    </span>
                  </div>

                  <div className="flex-1 flex gap-1 items-center overflow-hidden">
                    {displayList.slice(0, 2).map(e => (
                      <span key={e} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] truncate max-w-[100px]">
                        {e.split('@')[0]}
                      </span>
                    ))}
                    {displayList.length > 2 && <span className="text-[10px] text-gray-400">+{displayList.length - 2} more</span>}
                  </div>

                  <div className="text-gray-300 text-xl font-light ml-4">{isExpanded ? '−' : '+'}</div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-gray-50 border-t border-b border-gray-100">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500 uppercase">Select KAM Resources</span>
                        <button 
                          onClick={() => onSelectAllForSeller(seller.id, filteredEmails)}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest"
                        >
                          {selectedForSeller.length === filteredEmails.length ? 'Deselect All' : 'Select All Available'}
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                        <input 
                          type="text" 
                          value={emailSearchTerm} 
                          onChange={(e) => setEmailSearchTerm(e.target.value)} 
                          placeholder="Filter emails..." 
                          className="w-full pl-7 pr-3 py-1.5 border rounded text-xs" 
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                        {isLoadingEmails ? (
                          <div className="col-span-full py-4 text-center"><Loader2 className="animate-spin h-4 w-4 mx-auto" /></div>
                        ) : filteredEmails.map(e => {
                          const isChecked = isModified ? selectedForSeller.includes(e.email) : liveAllocated.includes(e.email);
                          return (
                            <label key={e.email} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white hover:bg-gray-50'}`}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => onSelectEmail(seller.id, e.email)}
                                className="hidden"
                              />
                              <Mail size={12} className={isChecked ? 'text-blue-100' : 'text-gray-400'} />
                              <div className="min-w-0">
                                <div className="text-[11px] font-bold truncate leading-tight">{e.fullName || e.email.split('@')[0]}</div>
                                <div className={`text-[10px] truncate opacity-70 ${isChecked ? 'text-white' : 'text-gray-500'}`}>{e.email}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SellerAllocationTable;
