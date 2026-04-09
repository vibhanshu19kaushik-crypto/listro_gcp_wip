import React from 'react';
import { Mail, Users, Download } from 'lucide-react';

const DistributionDashboard = ({ 
  data, 
  onExport,
  isExporting
}) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Seller Distribution Registry</h2>
          <p className="text-gray-600 text-xs">Live registry of all current KAM assignments.</p>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
        >
          <Download size={14} /> Export Registry
        </button>
      </div>

      <div className="divide-y divide-gray-200 max-h-80 overflow-y-auto">
        {data.map((row, index) => (
          <div key={`${row.sellerId}-${row.assignedEmail}-${index}`} className="grid grid-cols-4 gap-4 px-4 py-2.5 hover:bg-gray-50 transition-colors text-xs items-center">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded-full text-blue-600"><Users size={12} /></div>
              <span className="font-bold text-gray-900 truncate">{row.sellerName}</span>
            </div>
            <div className="font-mono text-gray-400 uppercase tracking-tighter">{row.sellerId}</div>
            <div className="flex items-center gap-2">
              <Mail size={12} className="text-gray-400" />
              <span className="text-gray-600 truncate">{row.assignedEmail}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-green-700 font-medium truncate">{row.assignedBy?.split('@')[0]}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 bg-gray-50 border-t text-[10px] text-gray-400 text-right uppercase tracking-widest font-bold">
        {data.length} Total Assignments In Sheet
      </div>
    </div>
  );
};

export default DistributionDashboard;
