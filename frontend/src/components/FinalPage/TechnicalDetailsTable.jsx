import React from 'react';

const TechnicalDetailsTable = ({ displayDetails }) => {
  if (!displayDetails || displayDetails.length === 0) return null;

  return (
    <div className="py-4 mt-4 border-t border-[#e7e7e7]">
      <h2 className="text-lg font-bold mb-4 text-[#0F1111]">Technical Details</h2>
      <div className="overflow-hidden border border-[#e7e7e7] rounded-lg">
        <table className="w-full text-sm border-collapse">
          <tbody className="divide-y divide-[#e7e7e7]">
            {displayDetails.map((detail, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-3 px-4 font-bold text-[#444] bg-gray-50/50" style={{ width: '40%' }}>
                  {detail.label}
                </td>
                <td className="py-3 px-4 text-[#0F1111] break-words">
                  {detail.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TechnicalDetailsTable;
