import React from 'react';
import { X, Upload, Link, Loader2 } from 'lucide-react';

const UploadManagerModal = ({ 
  isOpen, 
  onClose, 
  onFileUpload, 
  onLinkUpload, 
  uploadMode, 
  setUploadMode,
  linkInput,
  setLinkInput,
  isLoading,
  error
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900">Upload Visual Asset</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-8">
          {!uploadMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="cursor-pointer group">
                <div className="border-2 border-dashed border-blue-200 rounded-2xl p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                  </div>
                  <h4 className="font-bold text-gray-900">Local Machine</h4>
                  <p className="text-xs text-gray-500 mt-1">Upload directly from your hardware.</p>
                </div>
                <input type="file" accept="image/*" onChange={(e) => onFileUpload(e.target.files[0])} className="hidden" />
              </label>

              <button onClick={() => setUploadMode('link')} className="border-2 border-dashed border-purple-200 rounded-2xl p-8 text-center hover:border-purple-500 hover:bg-purple-50 transition-all group">
                <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Link size={32} />
                </div>
                <h4 className="font-bold text-gray-900">External URL</h4>
                <p className="text-xs text-gray-500 mt-1">Siphon image from a public link.</p>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <button 
                onClick={() => setUploadMode(null)} 
                className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                ← Change Method
              </button>
              
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="https://example.com/product.jpg"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                  disabled={isLoading}
                />
                
                {error && <p className="text-xs text-red-600 font-bold">⚠️ {error}</p>}
                
                <button
                  onClick={onLinkUpload}
                  disabled={isLoading || !linkInput}
                  className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                  {isLoading ? "Synchronizing..." : "Initiate Upload"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadManagerModal;
