import React from 'react';
import { X, Images } from 'lucide-react';

const ExistingImagesDialog = ({ 
  isOpen, 
  onClose, 
  images, 
  onSelect 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900">Select Source Artifact</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
        </div>
        
        <div className="p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto">
          {images.length > 0 ? (
            images.map((url, i) => (
              <div 
                key={i} 
                className="group relative aspect-square rounded-2xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all cursor-pointer shadow-sm hover:shadow-xl"
                onClick={() => onSelect(url)}
              >
                <img src={url} alt={`Option ${i}`} className="w-full h-full object-contain bg-gray-50" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold shadow-lg">Use This</span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-12 text-center text-gray-400">
              <Images size={48} className="mx-auto mb-4 opacity-20" />
              <p>No existing visual assets found in registry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExistingImagesDialog;
