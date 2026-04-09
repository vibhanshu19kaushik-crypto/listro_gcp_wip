import React from 'react';
import { Plus } from 'lucide-react';

const FeatureEditor = ({
  goldenProduct,
  productFeatures,
  featureValues,
  newFeature,
  setNewFeature,
  onFeatureChange,
  onAddFeature
}) => {
  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-700">Golden Features</h3>
        <h3 className="text-lg font-semibold text-gray-700">New Features</h3>
      </div>
      
      <div className="space-y-4">
        {productFeatures.map((f, i) => (
          <div key={f.id} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-amber-50 p-4 border border-amber-200 rounded text-sm italic">
              {goldenProduct?.features?.[i] || 'No reference'}
            </div>
            <div className="bg-white border p-3 rounded-lg flex items-center gap-2">
               <span className="text-blue-500">•</span>
               <input 
                 className="flex-1 outline-none text-sm" 
                 value={featureValues[f.id] || ''} 
                 onChange={e => onFeatureChange(f.id, e.target.value)}
                 placeholder="Enter feature..."
               />
            </div>
          </div>
        ))}
        
        <div className="grid grid-cols-2 gap-6">
           <div></div>
           <div className="bg-blue-50 p-3 rounded border border-blue-200 flex gap-2">
             <input 
               className="flex-1 border p-2 text-sm rounded" 
               placeholder="Add feature..." 
               value={newFeature} 
               onChange={e => setNewFeature(e.target.value)}
             />
             <button className="bg-green-600 text-white px-3 py-1 rounded text-sm" onClick={onAddFeature}><Plus size={18}/></button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureEditor;
