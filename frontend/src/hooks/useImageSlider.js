import { useState, useCallback } from 'react';

export const useImageSlider = (allImages = []) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const nextImage = useCallback(() => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }
  }, [allImages.length]);

  const prevImage = useCallback(() => {
    if (allImages.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    }
  }, [allImages.length]);

  const goToImage = useCallback((index) => {
    setCurrentImageIndex(index);
  }, []);

  return {
    currentImageIndex,
    setCurrentImageIndex,
    nextImage,
    prevImage,
    goToImage
  };
};
