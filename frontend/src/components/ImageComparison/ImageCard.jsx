import React from 'react';
import { Wand2, Upload, Loader2, Link } from 'lucide-react';

const ImageCard = ({ 
  src, 
  alt, 
  label, 
  type, 
  index = null, 
  onGenerate = null, 
  onUploadRequest = null,
  isLoading = false, 
  isSelected = false, 
  onSelect = null,
  loadingMessage = "",
  shouldDisableRegen = false
}) => {
  return (
    <div 
      className={`bg-white rounded-md border-2 overflow-hidden mb-2 transition-all ${isSelected ? 'border-green-500 shadow-lg ring-2 ring-green-300' : 'border-gray-200'} ${onSelect && src ? 'cursor-pointer hover:border-blue-300' : ''}`}
      onClick={() => onSelect && src && !isLoading && onSelect()}
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
        {isSelected && (
          <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-1 z-20 shadow-lg">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
        
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mb-1" />
            <span className="text-[10px] font-medium text-gray-700">{loadingMessage}</span>
          </div>
        )}

        {type === 'generate' && !src && !isLoading && (
          <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full">
            <div className="w-full space-y-2">
              <button
                onClick={(e) => { e.stopPropagation(); onGenerate && onGenerate(index); }}
                className="w-full flex flex-col items-center justify-center p-2 hover:bg-blue-100 transition-colors rounded-lg border-2 border-blue-400 bg-blue-50"
              >
                <Wand2 size={16} className="text-blue-600 mb-1" />
                <span className="text-[10px] font-bold text-blue-700">Generate</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onUploadRequest && onUploadRequest(index); }}
                className="w-full flex flex-col items-center justify-center p-2 hover:bg-purple-100 transition-colors rounded-lg border-2 border-purple-400 bg-purple-50"
              >
                <Upload size={16} className="text-purple-600 mb-1" />
                <span className="text-[10px] font-bold text-purple-700">Upload</span>
              </button>
            </div>
          </div>
        )}

        {src && !isLoading && (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-contain hover:opacity-90 transition-opacity"
            onError={(e) => { e.target.src = `https://placehold.co/250x250?text=Error`; }}
          />
        )}
      </div>
      <div className="p-1 px-2 border-t flex justify-between items-center bg-gray-50">
        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter truncate">{label}</h4>
        {type === 'generate' && src && !isLoading && (
          <div className="flex gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onGenerate && onGenerate(index); }}
              disabled={shouldDisableRegen}
              className={`p-1 rounded text-[10px] ${shouldDisableRegen ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white'}`}
            >
              Regen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageCard;
