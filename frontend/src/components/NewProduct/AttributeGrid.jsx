import React from 'react';
import { Plus, Check } from 'lucide-react';

const AttributeGrid = ({
  goldenProduct,
  productAttributes,
  usedAttributes,
  showAddAttribute,
  setShowAddAttribute,
  newAttributeKey,
  setNewAttributeKey,
  newAttributeValue,
  setNewAttributeValue,
  selectedAttributeType,
  setSelectedAttributeType,
  onAttributeChange,
  onAddAttribute
}) => {
  // Predefined options
  const predefinedAttributes = [
    { key: 'material', label: 'Material' }, { key: 'color', label: 'Color' },
    { key: 'size', label: 'Size' }, { key: 'hsn code', label: 'HSN Code' },
    { key: 'your_price', label: 'Your Price' }, { key: 'brand_name', label: 'Brand Name' },
    { key: 'custom', label: 'Custom Attribute' }
  ];

  const renderAttributeRow = (key, label, goldenValue) => (
    <div key={key} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-3">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase">{label}</div>
        <div className="text-sm font-medium">{goldenValue || 'N/A'}</div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase">{label}</div>
        <input
          type="text"
          className="w-full border-b outline-none text-sm mt-1"
          value={productAttributes[key] || ''}
          onChange={e => onAttributeChange(key, e.target.value)}
          placeholder={`Enter ${label}...`}
        />
      </div>
    </div>
  );

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Golden Listing Attributes</h3>
        <h3 className="text-lg font-semibold text-gray-700">New Listing Attributes</h3>
      </div>
      
      {/* Dynamic Rows */}
      {Object.keys(productAttributes).map(key => renderAttributeRow(key, key.replace(/([A-Z])/g, ' $1'), 'From Golden'))}

      {/* Add Logic */}
      {showAddAttribute ? (
        <div className="grid grid-cols-2 gap-6">
          <div></div>
          <div className="bg-blue-50 p-4 rounded border border-blue-200 space-y-2">
             <select 
               className="w-full border p-2 text-sm rounded" 
               value={selectedAttributeType} 
               onChange={e => setSelectedAttributeType(e.target.value)}
             >
               <option value="">Select Type</option>
               {predefinedAttributes.map(a => <option key={a.key} value={a.key} disabled={usedAttributes.has(a.key) && a.key !== 'custom'}>{a.label}</option>)}
             </select>
             {selectedAttributeType === 'custom' && <input className="w-full border p-2 text-sm rounded" placeholder="Name" value={newAttributeKey} onChange={e => setNewAttributeKey(e.target.value)}/>}
             <input className="w-full border p-2 text-sm rounded" placeholder="Value" value={newAttributeValue} onChange={e => setNewAttributeValue(e.target.value)}/>
             <div className="flex gap-2">
               <button className="bg-green-600 text-white px-3 py-1 rounded text-sm" onClick={onAddAttribute}><Check size={14}/> Add</button>
               <button className="bg-gray-200 px-3 py-1 rounded text-sm" onClick={() => setShowAddAttribute(false)}>Cancel</button>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 mt-4">
          <div></div>
          <button className="flex items-center gap-2 text-blue-600 font-medium text-sm" onClick={() => setShowAddAttribute(true)}><Plus size={16}/> Add Attribute</button>
        </div>
      )}
    </div>
  );
};

export default AttributeGrid;
