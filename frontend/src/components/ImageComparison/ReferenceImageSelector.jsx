import React from 'react';
import { Upload, X, Images, CheckCircle2 } from 'lucide-react';

const ReferenceImageSelector = ({ 
  referenceImage, 
  onUpload, 
  onSelectExisting, 
  onRemove,
  isNewProduct,
  hasExistingImages
}) => {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl shadow-sm border-2 border-purple-100 p-6 mb-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            Reference Visual
            {referenceImage && <CheckCircle2 className="text-green-500" size={20} />}
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            {referenceImage 
              ? "Base-layer established. You can now initiate Listro AI generation for all downstream slots."
              : "Establish a reference visual to guide the Listro AI generation process. Upload a file or select from catalog."
            }
          </p>
        </div>

        <div className="flex items-center gap-4">
          {!referenceImage ? (
            <div className="flex gap-3">
              <label className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 cursor-pointer transition-all font-bold shadow-lg shadow-purple-100">
                <Upload size={18} />
                <span>Upload Reference</span>
                <input type="file" accept="image/*" onChange={(e) => onUpload(e)} className="hidden" />
              </label>
              {!isNewProduct && hasExistingImages && (
                <button 
                  onClick={onSelectExisting}
                  className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl hover:bg-green-50 transition-all font-bold"
                >
                  <Images size={18} />
                  <span>Select Existing</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-6 bg-white p-2 pr-6 rounded-2xl border-2 border-purple-200 shadow-sm">
              <div className="relative group">
                <img src={referenceImage} alt="Reference" className="w-20 h-20 object-cover rounded-xl" />
                <button onClick={onRemove} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:scale-110 transition-transform">
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-purple-600 uppercase tracking-widest cursor-pointer hover:underline">
                  Change Visual
                  <input type="file" accept="image/*" onChange={(e) => onUpload(e)} className="hidden" />
                </label>
                {!isNewProduct && hasExistingImages && (
                  <button onClick={onSelectExisting} className="text-[10px] font-bold text-green-600 uppercase tracking-widest hover:underline text-left">
                    Select Different
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReferenceImageSelector;
