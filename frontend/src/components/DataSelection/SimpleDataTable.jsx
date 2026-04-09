import React from 'react';
import { Database, ExternalLink, Download } from 'lucide-react';
import { formatTableName } from '../../utils/dataUtils';

const SimpleDataTable = ({ 
  data, 
  headers, 
  tableName, 
  getSelectedDisplayName, 
  onDownload 
}) => {
  if (!data) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 opacity-0 translate-y-4 animate-fadeInUp" style={{ animation: 'fadeInUp 0.6s ease-out forwards' }}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Full Listing Data for {getSelectedDisplayName()}</h2>
            <p className="text-gray-600 mt-1 text-sm">Listings Found: <span className="font-bold text-blue-600">{data.length}</span></p>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-2 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded-md">
              <Database className="h-3 w-3" />
              <span>Table: {formatTableName(tableName)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listing Link</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, idx) => {
              const asin = item['asin1'] || item['ASIN'] || item['asin'] || '';
              return (
                <tr key={idx} className="hover:bg-gray-50">
                  {headers.map((header, colIdx) => (
                    <td key={colIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {header === 'image_url' && item[header] ? (
                        <img src={item[header]} alt="Product" className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <span>{item[header] || '-'}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a href={`https://www.amazon.in/dp/${asin}`} target="_blank" rel="noreferrer" className="text-blue-600 flex items-center gap-1 hover:underline">
                      View <ExternalLink size={12}/>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-gray-50 border-t border-gray-200 text-center">
        <button onClick={onDownload} className="flex items-center mx-auto space-x-2 px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium">
          <Download size={18}/> <span>Download Full Data Sheet</span>
        </button>
      </div>
    </div>
  );
};

export default SimpleDataTable;
