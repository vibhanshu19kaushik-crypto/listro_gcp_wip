import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const FinalImageGallery = ({ 
  allImages, 
  currentImageIndex, 
  nextImage, 
  prevImage, 
  goToImage 
}) => {
  if (!allImages || allImages.length === 0) {
    return (
      <div className="border p-4 mb-4 bg-white rounded-lg h-[500px] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">No images available</p>
        </div>
      </div>
    );
  }

  const currentImage = allImages[currentImageIndex];

  return (
    <div className="sticky top-4">
      {/* Main Image */}
      <div className="border p-4 mb-4 bg-white rounded-lg">
        <div className="h-[500px] flex items-center justify-center bg-gray-50 relative group rounded-lg overflow-hidden">
          <img
            src={currentImage?.url}
            alt={currentImage?.label || 'Product'}
            className="max-h-full max-w-full object-contain"
          />

          {allImages.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
            {currentImageIndex + 1} / {allImages.length}
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-sm font-medium text-gray-900">{currentImage?.label}</p>
        </div>
      </div>

      {/* Thumbnails */}
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {allImages.map((image, index) => (
            <div
              key={index}
              onClick={() => goToImage(index)}
              className={`flex-shrink-0 cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                currentImageIndex === index ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 hover:border-blue-300'
              }`}
              style={{ width: '80px', height: '80px' }}
            >
              <div className="relative w-full h-full">
                <img src={image.url} alt={image.label} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5 whitespace-nowrap overflow-hidden">
                  {image.type === 'generated' ? 'Listro' : 'Orig'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FinalImageGallery;
