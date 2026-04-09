import React from 'react';
import { Home, RefreshCw, X } from 'lucide-react';

const ExportSuccessModal = ({ 
  isOpen, 
  onClose, 
  onNewSeller, 
  onNewAsin, 
  asin 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-green-600 p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute right-4 top-4 hover:bg-white/20 p-1 rounded-full transition-colors">
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Submission Successful!</h2>
          <p className="mt-2 text-green-50 opacity-90">Listing for {asin} has been exported.</p>
        </div>

        <div className="p-8 space-y-4">
          <p className="text-gray-600 text-center text-sm mb-6">What would you like to do next?</p>
          
          <button
            onClick={onNewAsin}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all shadow-md active:scale-[0.98]"
          >
            <RefreshCw size={20} />
            <span>Optimize Next ASIN</span>
          </button>

          <button
            onClick={onNewSeller}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-4 px-6 rounded-xl border-2 border-gray-200 transition-all active:scale-[0.98]"
          >
            <Home size={20} />
            <span>Select Another Seller</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            Stay on this Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportSuccessModal;
