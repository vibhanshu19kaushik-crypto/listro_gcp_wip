import React from 'react';

const ProductInfoSection = ({ comparisonData, mrp, discountPercentage }) => {
  if (!comparisonData) return null;

  return (
    <div className="col-span-7">
      <div className="border-b border-[#e7e7e7] pb-4">
        <h1 className="text-xl font-medium mb-2 text-[#0F1111]">
          {comparisonData.originalTitle}
        </h1>
      </div>

      <div className="py-4 border-b border-[#e7e7e7]">
        {mrp && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[12px] text-gray-600">M.R.P.:</span>
            <span className="text-[14px] text-gray-600 line-through">{mrp}</span>
          </div>
        )}
       
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] text-gray-900">Price:</span>
          <span className="text-[28px] text-[#0F1111] font-light tracking-tight">
            {comparisonData.originalPrice}
          </span>
         
          {discountPercentage && discountPercentage > 0 && (
            <span className="text-[14px] text-[#cc0c39]">({discountPercentage}% off)</span>
          )}
        </div>
       
        <div className="mt-1 text-[12px] text-gray-500">Inclusive of all taxes</div>
      </div>

      <div className="py-4 border-b border-[#e7e7e7]">
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-4 align-top text-[#565959]" style={{ width: '120px' }}>Brand</td>
              <td className="py-1 text-[#0F1111] font-medium">{comparisonData.brandComparison.original}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 align-top text-[#565959]">ASIN</td>
              <td className="py-1 text-[#0F1111]">{comparisonData.originalAsin}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 align-top text-[#565959]">Category</td>
              <td className="py-1 text-[#0F1111]">{comparisonData.category}</td>
            </tr>
            <tr>
              <td className="py-1 pr-4 align-top text-[#565959]">Subcategory</td>
              <td className="py-1 text-[#0F1111]">{comparisonData.subcategory}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductInfoSection;
