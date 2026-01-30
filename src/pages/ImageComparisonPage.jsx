// ImageComparisonPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { generateAIImage } from '../api/api';
import { uploadImageToGCS, uploadImageFromLink } from '../api/frontendApi';
import { Wand2, Loader2, ArrowRight, X, Upload, Link, Images } from 'lucide-react';

const ImageComparisonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [previewImage, setPreviewImage] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceFile, setReferenceFile] = useState(null);
  const [productAttributes, setProductAttributes] = useState({});
  const [goldStandardProduct, setGoldStandardProduct] = useState(null);
  const [existingProduct, setExistingProduct] = useState(null);
  const [isNewProduct, setIsNewProduct] = useState(location.state?.isNewProduct || false);
  const [showExistingImagesDialog, setShowExistingImagesDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadTargetIndex, setUploadTargetIndex] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadLinkInput, setUploadLinkInput] = useState('');
  const [uploadMode, setUploadMode] = useState(null); // 'machine', 'gdrive', 'link'

  const loadingMessages = [
    "Painting pixels...",
    "Creating magic...",
    "Crafting your image...",
    "Generating masterpiece...",
    "Conjuring visuals...",
    "Building your vision...",
    "Adding colors...",
    "Focusing creativity...",
    "Launching generation...",
    "Mixing digital paint...",
    "Rendering pixels...",
    "Blooming your image...",
    "Flowing with creativity...",
    "Shining up pixels...",
    "Uploading your image...",
    "Storing in the cloud...",
    "Processing upload...",
  ];

  const [currentLoadingMessage, setCurrentLoadingMessage] = useState("");

  // --- Regeneration limit state ---
  const [totalRegenerations, setTotalRegenerations] = useState(0);
  const MAX_REGEN = 2; // allow max 2 regenerations among the first 5 images
  const [regenLimitMessageShown, setRegenLimitMessageShown] = useState(false);

  // CRITICAL: Reload localStorage data whenever we navigate to this page
  // This ensures fresh data when switching between different ASINs
  useEffect(() => {
    console.log('🔄 [ImageComparisonPage] Reloading all data from localStorage...');
    console.log('🔍 [ImageComparisonPage] location.state:', location.state);
    console.log('🔍 [ImageComparisonPage] location.key:', location.key);
    
    // Reset generated images state to clear old AI-generated images
    setGeneratedImages(Array(20).fill(null).map(() => ({ url: null, isLoading: false })));
    console.log('🗑️ Cleared generatedImages state (reset to empty)');
    
    // Reset selected images
    const initialSelections = {};
    for (let i = 0; i < 20; i++) {
      initialSelections[i] = { existing: false, generated: false };
    }
    setSelectedImages(initialSelections);
    console.log('🗑️ Cleared selectedImages state (reset to empty)');
    
    if (location.state?.isNewProduct) {
      console.log('… Coming from new product page - hiding existing product section');
    }

    // Always reload filters
    const storedFilters = localStorage.getItem('productFilters');
    if (storedFilters) {
      try {
        const parsedFilters = JSON.parse(storedFilters);
        setProductAttributes(parsedFilters);
        console.log('✅ Loaded product attributes:', parsedFilters);
      } catch (error) {
        console.error('❌ Error parsing stored filters:', error);
      }
    }

    // Always reload Gold Standard
    const storedGoldStandard = localStorage.getItem('goldStandardProduct');
    if (storedGoldStandard) {
      try {
        const parsedGold = JSON.parse(storedGoldStandard);
        setGoldStandardProduct(parsedGold);
        console.log('✅ Loaded Gold Standard ASIN:', parsedGold.asin, 'Images:', parsedGold.images?.length || 0);
        console.log('📅 Gold Standard version:', parsedGold.version || 'no-version', 'loadedAt:', parsedGold.loadedAt || 'no-timestamp');
        console.log('🖼️ Gold Standard Images:', parsedGold.images);
      } catch (error) {
        console.error('❌ Error parsing Gold Standard product:', error);
      }
    } else {
      console.warn('⚠️ No Gold Standard product in localStorage!');
      setGoldStandardProduct(null);
    }

    // Always reload Existing Product (unless new product)
    if (!location.state?.isNewProduct) {
      const storedExisting = localStorage.getItem('existingProduct');
      if (storedExisting) {
        try {
          const parsedExisting = JSON.parse(storedExisting);
          setExistingProduct(parsedExisting);
          console.log('✅ Loaded Existing Product ASIN:', parsedExisting.asin, 'Images:', parsedExisting.images?.length || 0);
          console.log('📅 Existing Product version:', parsedExisting.version || 'no-version', 'loadedAt:', parsedExisting.loadedAt || 'no-timestamp');
          console.log('🖼️ Existing Product Images:', parsedExisting.images);
        } catch (error) {
          console.error('❌ Error parsing Existing product:', error);
        }
      } else {
        console.warn('⚠️ No Existing product in localStorage!');
        setExistingProduct(null);
      }
    }
    
    console.log('✅ [ImageComparisonPage] Data reload complete');
  }, [location.state, location.key]); // Re-run when location changes (including navigation)

  // One-time message effect when regen limit exhausted (and first 5 are generated)
  useEffect(() => {
    if (isFullyGenerated && totalRegenerations === MAX_REGEN && !regenLimitMessageShown) {
      // small message - using alert for simplicity; replace with toast if you have one
      alert("⚠️ Your limit for regeneration is reached.");
      setRegenLimitMessageShown(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalRegenerations]);


  const getGoldStandardImages = () => {
    const srcArray = goldStandardProduct?.images || [];  // ONLY GOLD IMAGES

    console.log('🔍 [getGoldStandardImages] goldStandardProduct:', goldStandardProduct);
    console.log('🔍 [getGoldStandardImages] srcArray:', srcArray);
    console.log('🔍 [getGoldStandardImages] srcArray length:', srcArray.length);

    // ✅ Return ALL unique images from backend (no padding, no filtering)
    // Backend now returns only unique images found on Amazon
    console.log('✅ [getGoldStandardImages] returning all', srcArray.length, 'unique images');
    return srcArray;
  };


  const getExistingImages = () => {
    const srcArray = existingProduct?.images || [];  // MAIN PRODUCT ONLY

    console.log('🔍 [getExistingImages] existingProduct:', existingProduct);
    console.log('🔍 [getExistingImages] srcArray:', srcArray);
    console.log('🔍 [getExistingImages] srcArray length:', srcArray.length);

    // ✅ Return ALL unique images from backend (no padding, no filtering)
    // Backend now returns only unique images found on Amazon
    console.log('✅ [getExistingImages] returning all', srcArray.length, 'unique images');
    return srcArray;
  
  };

  const getAllExistingImages = () => {
    const srcArray = existingProduct?.images || [];
    return srcArray.length > 0 ? [...new Set(srcArray)] : [];
  };

  const urlToFile = async (imageUrl, filename) => {
    try {
      console.log('♪ Converting URL to File:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg', lastModified: Date.now() });
      console.log('… Successfully converted URL to File:', file);
      return file;
    } catch (error) {
      console.error('✖ Error converting URL to File:', error);
      throw error;
    }
  };

  const [generatedImages, setGeneratedImages] = useState(
    Array(20).fill(null).map(() => ({ url: null, isLoading: false, source: null }))  // Support up to 20 images, source: 'generated' | 'uploaded'
  );

  // For existing products: track selections for both existing and generated images
  // Format: { 0: { existing: boolean, generated: boolean }, 1: { existing: boolean, generated: boolean }, ... }
  const [selectedImages, setSelectedImages] = useState(() => {
    const initialSelections = {};
    for (let i = 0; i < 20; i++) {  // Support up to 20 images
      initialSelections[i] = { existing: false, generated: false };
    }
    return initialSelections;
  });

  const imageLabels = [
    'Main Product',
    'White Background',
    'Lifestyle- L/R/B',
    'Lifestyle',
    'Infographics',
    'Detail Shot 1',
    'Detail Shot 2',
    'Additional 1',
    'Additional 2',
    'Additional 3',
    'Additional 4',
    'Additional 5',
    'Additional 6',
    'Additional 7',
    'Additional 8',
    'Additional 9',
    'Additional 10',
  ];

  // Calculate the maximum number of images to display across all sources
  const maxImageCount = useMemo(() => {
    const goldCount = getGoldStandardImages().length;
    const existingCount = getExistingImages().length;
    const generatedCount = generatedImages.filter(img => img.url !== null).length;
    return Math.max(goldCount, existingCount, generatedCount, 5); // Minimum 5 for generation
  }, [goldStandardProduct, existingProduct, generatedImages]);

  // Derived: are the first 5 images all generated?
  const isFullyGenerated = useMemo(() => {
    return generatedImages.slice(0, 5).every(img => img && img.url);
  }, [generatedImages]);

  // Calculate total selected images
  const totalSelectedImages = useMemo(() => {
    return Object.values(selectedImages).reduce((total, selections) => {
      return total + (selections.existing ? 1 : 0) + (selections.generated ? 1 : 0);
    }, 0);
  }, [selectedImages]);

  // Check if max selection limit reached
  const isMaxSelectionReached = useMemo(() => {
    return totalSelectedImages >= 7;
  }, [totalSelectedImages]);

  // Helper to decide if a regenerate button should be disabled
  const shouldDisableRegenerate = (index) => {
    // disable while loading
    if (generatedImages[index]?.isLoading) return true;

    // If this is a regeneration attempt (image already exists and all 5 are generated),
    // enforce the total regenerations limit
    const isRegenerationAttempt = !!(generatedImages[index]?.url && isFullyGenerated);
    if (isRegenerationAttempt && totalRegenerations >= MAX_REGEN) return true;

    return false;
  };

  const handleGenerateImage = async (index) => {
    if (!referenceFile && !referenceImage) {
      alert('Please upload or select a reference image first!');
      return;
    }
    
    // Category-specific style availability check
    const category = productAttributes?.Category || productAttributes?.category || '';
    const isHomeKitchen = category && 
      ['home & kitchen', 'home and kitchen', 'home kitchen', 'home &kitchen', 'home-kitchen']
        .includes(category.toLowerCase().trim());
    
    if (isHomeKitchen && index >= 2) {
      alert('🏠 Home & Kitchen: Listro generation for this style is coming soon! For now, please use the "Upload Your Own" button to add your custom image. ✨');
      return;
    }
    
    if (index >= 5) {
      alert('✅ This image style is coming soon! Currently in development. Stay tuned! ✨');
      return;
    }
    const normalizedAttributes = {};
    Object.entries(productAttributes).forEach(([key, value]) => {
      if (key === 'Subcategory') normalizedAttributes['SubCategory'] = value;
      else if (key === 'Age Group') normalizedAttributes['AgeGroup'] = value;
      else normalizedAttributes[key] = value;
    });
    setCurrentLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isLoading: true } : img));
    const messageInterval = setInterval(() => {
      setCurrentLoadingMessage(loadingMessages[Math.floor(Math.random() * loadingMessages.length)]);
    }, 2000);
    try {
      let imageFile = referenceFile;
      if (!referenceFile && referenceImage) {
        imageFile = await urlToFile(referenceImage, `reference-image-${Date.now()}.jpg`);
      }
      if (!imageFile) throw new Error('No reference image available for generation');
      const newImageUrl = await generateAIImage(imageFile, index, normalizedAttributes);
      clearInterval(messageInterval);
      setGeneratedImages(prev => prev.map((img, i) => i === index ? { url: newImageUrl, isLoading: false, source: 'generated' } : img));
      
      // REMOVED: Auto-select the newly generated image - let user decide
      // Users will manually click to select images
    } catch (error) {
      clearInterval(messageInterval);
      let errorMessage = error.message;
      if (errorMessage.includes('No image returned from model'))
        errorMessage = 'The Listro model could not generate this image. This might be due to content safety filters or prompt issues. Please try a different style or image.';
      else if (errorMessage.includes('style_index out of range'))
        errorMessage = 'This image style is not yet available. Please try another style.';
      else if (errorMessage.includes('safety filters'))
        errorMessage = 'Content generation was blocked by safety filters. Please try a different reference image or style.';
      else if (errorMessage.includes('No image uploaded'))
        errorMessage = 'Reference image processing failed. Please try uploading the image directly or select a different existing image.';
      alert(`Failed to generate image: ${errorMessage}`);
      setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isLoading: false } : img));
    }
  };

  // Wrapper to handle regenerate clicks and count them only when they are true "regenerations"
  const handleRegenerateClick = (index) => {
    const isRegeneration = !!(generatedImages[index]?.url && isFullyGenerated);
    if (isRegeneration) {
      if (totalRegenerations >= MAX_REGEN) {
        alert(`Regeneration limit reached. You can only regenerate ${MAX_REGEN} times across the 5 images.`);
        return;
      }
      // Count the regeneration attempt immediately
      setTotalRegenerations(prev => prev + 1);
    }
    handleGenerateImage(index);
  };

  const handleReferenceImageUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setReferenceFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setReferenceImage(e.target.result);
      reader.readAsDataURL(file);
      console.log('… Reference image uploaded:', file.name);
    }
  };

  const handleSelectExistingImage = async (imageUrl) => {
    try {
      const file = await urlToFile(imageUrl, `existing-reference-${Date.now()}.jpg`);
      setReferenceFile(file);
      setReferenceImage(imageUrl);
      setShowExistingImagesDialog(false);
      console.log('… Successfully set existing image as reference');
    } catch {
      alert('Failed to select this image as reference. Please try uploading the image directly or select a different image.');
    }
  };

  const handleRemoveReferenceImage = () => {
    setReferenceImage(null);
    setReferenceFile(null);
    console.log('Reference image removed');
  };

  const handleCopyImageLink = (imageUrl) => {
    navigator.clipboard.writeText(imageUrl).then(() => {
      alert('Image link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link. Please try again.');
    });
  };

  // Handle image selection - allows selecting both existing and generated for the same slot
  const handleImageSelection = (rowIndex, imageType) => {
    // Check if we're trying to select a new image when max is reached
    const currentSelection = selectedImages[rowIndex][imageType];
    
    // If trying to select (not deselect) and max limit is reached, show alert
    if (!currentSelection && isMaxSelectionReached) {
      alert('Maximum selection limit reached! You can only select up to 7 images total. Deselect some images first.');
      return;
    }
    
    setSelectedImages(prev => ({
      ...prev,
      [rowIndex]: {
        ...prev[rowIndex],
        [imageType]: !prev[rowIndex][imageType]
      }
    }));
  };

  const handleSaveChanges = () => {
    if (isNewProduct) {
      const generatedCount = generatedImages.filter(img => img.url !== null).length;
      if (generatedCount < 5) {
        alert(`✅ Please generate at least 5 images before proceeding. Currently generated: ${generatedCount}/7`);
        return;
      }
      if (generatedCount > 7) {
        alert(`✅ Maximum 7 images allowed. Currently generated: ${generatedCount}`);
        return;
      }
    } else {
      // For existing products: check total selected images
      if (totalSelectedImages < 5) {
        alert(`✅ Please select at least 5 images before proceeding. Currently selected: ${totalSelectedImages}/7`);
        return;
      }
      if (totalSelectedImages > 7) {
        alert(`✅ Maximum 7 selections allowed. Currently selected: ${totalSelectedImages}`);
        return;
      }
    }

    const allImages = [];
    const generatedImageUrls = [];

    if (isNewProduct) {
      generatedImages.forEach((imgData, index) => {
        if (imgData.url) {
          allImages.push({ url: imgData.url, type: 'generated', label: imageLabels[index] || `Generated ${index + 1}` });
          generatedImageUrls.push(imgData.url);
        }
      });
    } else {
      const existingImagesList = getExistingImages();
      
      // Add selected existing images
      Object.entries(selectedImages).forEach(([index, selections]) => {
        const idx = parseInt(index);
        
        if (selections.existing) {
          const existingUrl = existingImagesList[idx];
          if (existingUrl) {
            allImages.push({ 
              url: existingUrl, 
              type: 'existing', 
              label: imageLabels[idx] || `Existing ${idx + 1}`,
              slot: idx
            });
          }
        }
        
        if (selections.generated) {
          const generatedUrl = generatedImages[idx].url;
          if (generatedUrl) {
            allImages.push({ 
              url: generatedUrl, 
              type: 'generated', 
              label: imageLabels[idx] || `Generated ${idx + 1}`,
              slot: idx
            });
            generatedImageUrls.push(generatedUrl);
          }
        }
      });
    }

    localStorage.setItem('generatedImages', JSON.stringify(generatedImageUrls));
    localStorage.setItem('allProductImages', JSON.stringify(allImages));
    navigate('/final-page');
  };

  const ImageCard = ({ 
    src, 
    alt, 
    label, 
    type, 
    index = null, 
    onGenerate = null, 
    isLoading = false, 
    isSelected = false, 
    onSelect = null,
    selectionType = null,
    imgData = null
  }) => (
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
        {(type === 'reference' || type === 'current') && !src && (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <div className="text-gray-400 text-xs">No image</div>
          </div>
        )}
        {type === 'generate' && !src && !isLoading && (
          <div className="flex flex-col items-center justify-center p-4 text-center w-full h-full">
            <p className="text-xs font-semibold text-gray-700 mb-3">Choose one option:</p>
            <div className="w-full space-y-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // If no src and not loading, this is a first-time generation -> call generate
                  onGenerate && onGenerate(index);
                }}
                className="w-full flex flex-col items-center justify-center p-3 hover:bg-blue-100 transition-colors rounded-lg border-2 border-blue-400 bg-blue-50"
              >
                <Wand2 className="h-5 w-5 text-blue-600 mb-1" />
                <span className="text-xs font-bold text-blue-700">Generate</span>
              </button>
              <div className="flex items-center space-x-2">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-xs text-gray-500">OR</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadTargetIndex(index);
                  setUploadError(null);
                  setUploadLinkInput('');
                  setUploadMode(null);
                  setShowUploadDialog(true);
                }}
                className="w-full flex flex-col items-center justify-center p-3 hover:bg-purple-100 transition-colors rounded-lg border-2 border-purple-400 bg-purple-50"
              >
                <Upload className="h-5 w-5 text-purple-600 mb-1" />
                <span className="text-xs font-bold text-purple-700">Upload Your Own</span>
              </button>
            </div>
          </div>
        )}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-3 text-center">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mb-1" />
            <span className="text-xs font-medium text-gray-700">{currentLoadingMessage}</span>
          </div>
        )}
        {src && !isLoading && (
          <>
            <img
              src={src}
              alt={alt}
              className="w-full h-full object-contain hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({ src, alt, label });
              }}
              onError={(e) => {
                e.target.src = `https://placehold.co/250x250/E5E7EB/6B7280?text=${encodeURIComponent(alt)}`;
              }}
            />
            {type === 'generate' && (
              <div className="absolute bottom-1 left-1 right-1 flex gap-1">
                {imgData?.source === 'generated' ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Use wrapper that counts regenerations only when appropriate
                        handleRegenerateClick(index);
                      }}
                      className={`flex-1 px-2 py-1 rounded text-xs z-10 ${shouldDisableRegenerate(index) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      title="Regenerate Image"
                      disabled={shouldDisableRegenerate(index)}
                    >
                      Regenerate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyImageLink(src);
                      }}
                      className="bg-purple-600 text-white p-1 rounded text-xs hover:bg-purple-700 transition-colors z-10"
                      title="Copy Image Link"
                    >
                      <Link className="h-3 w-3" />
                    </button>
                  </>
                ) : imgData?.source === 'uploaded' ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadTargetIndex(index);
                        setUploadError(null);
                        setUploadLinkInput('');
                        setUploadMode(null);
                        setShowUploadDialog(true);
                      }}
                      className="flex-1 px-2 py-1 rounded text-xs z-10 bg-purple-600 text-white hover:bg-purple-700"
                      title="Re-upload Image"
                    >
                      Re-upload
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyImageLink(src);
                      }}
                      className="bg-purple-600 text-white p-1 rounded text-xs hover:bg-purple-700 transition-colors z-10"
                      title="Copy Image Link"
                    >
                      <Link className="h-3 w-3" />
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
      <div className="p-2">
        <h4 className="text-xs font-medium text-gray-900 text-center">{label}</h4>
        {onSelect && src && !isLoading && (
          <p className="text-xs text-center text-gray-500 mt-1">
            {isSelected ? 'Selected' : 'Click to select'}
          </p>
        )}
      </div>
    </div>
  );

  const ExistingImagesDialog = () => {
    const existingImages = getAllExistingImages();
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50"
        onClick={() => setShowExistingImagesDialog(false)}
      >
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border-4 border-blue-500 animate-scaleIn"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Select Existing Image as Reference</h3>
              <p className="text-sm text-gray-600 mt-1">
                Choose an image from your existing product images to use as reference for AI generation
              </p>
            </div>
            <button
              onClick={() => setShowExistingImagesDialog(false)}
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6 bg-gray-50 max-h-[65vh] overflow-y-auto">
            {existingImages.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {existingImages.map((imageUrl, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
                    onClick={() => handleSelectExistingImage(imageUrl)}
                  >
                    <div className="aspect-square bg-gray-100 flex items-center justify-center">
                      <img
                        src={imageUrl}
                        alt={`Existing product image ${index + 1}`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.target.src = `https://placehold.co/200x200/E5E7EB/6B7280?text=Image+${index + 1}`;
                        }}
                      />
                    </div>
                    <div className="p-2 text-center">
                      <span className="text-xs font-medium text-gray-700">Image {index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Images className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No existing product images found.</p>
                <p className="text-sm text-gray-500 mt-1">Please upload images in the previous steps.</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-600">
              {existingImages.length} image(s) available
            </span>
            <button
              onClick={() => setShowExistingImagesDialog(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleFileInput = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!uploadTargetIndex && uploadTargetIndex !== 0) return;
    try {
      setUploadLoading(true);
      setUploadError(null);
      // Set loading state in the image card to show uploading indicator
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: true } : img));
      const gcsUrl = await uploadImageToGCS(file);
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { url: gcsUrl, isLoading: false, source: 'uploaded' } : img));
      setShowUploadDialog(false);
      setUploadMode(null);
      setUploadLinkInput('');
    } catch (error) {
      console.error('Upload failed', error);
      setUploadError(error.message || 'Upload failed');
      // Clear loading state on error
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: false } : img));
    } finally {
      setUploadLoading(false);
    }
  };

  const handleUploadLink = async () => {
    if (!uploadLinkInput) return setUploadError('Please provide a URL');
    try {
      setUploadLoading(true);
      setUploadError(null);
      // Set loading state in the image card to show uploading indicator
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: true } : img));
      const gcsUrl = await uploadImageFromLink(uploadLinkInput);
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { url: gcsUrl, isLoading: false, source: 'uploaded' } : img));
      setShowUploadDialog(false);
      setUploadMode(null);
      setUploadLinkInput('');
    } catch (error) {
      console.error('Upload from link failed', error);
      setUploadError(error.message || 'Upload from link failed');
      // Clear loading state on error
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: false } : img));
    } finally {
      setUploadLoading(false);
    }
  };

  const UploadDialog = () => {
    if (!showUploadDialog) return null;

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-black bg-opacity-50" onClick={() => { setShowUploadDialog(false); setUploadMode(null); setUploadLinkInput(''); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Upload Your Image</h3>
              <p className="text-sm text-gray-600 mt-1">Choose how you'd like to upload. Image will be stored in Google Cloud with a shareable link.</p>
            </div>
            <button 
              onClick={() => { setShowUploadDialog(false); setUploadMode(null); setUploadLinkInput(''); }} 
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {!uploadMode ? (
              // Mode selection
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Machine Upload */}
                <label className="relative cursor-pointer group">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl p-6 text-center transition-all group-hover:shadow-lg group-hover:border-blue-500 group-hover:from-blue-100 group-hover:to-blue-200">
                    <div className="bg-blue-600 text-white rounded-full inline-flex items-center justify-center p-4 mb-4">
                      <Upload className="h-8 w-8" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Upload from Machine</h4>
                    <p className="text-sm text-gray-600">Select an image from your computer</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
                </label>

                {/* Google Drive Upload */}
                <button
                  onClick={() => setUploadMode('gdrive')}
                  className="relative cursor-pointer group"
                >
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-300 rounded-xl p-6 text-center transition-all group-hover:shadow-lg group-hover:border-green-500 group-hover:from-green-100 group-hover:to-green-200">
                    <div className="bg-green-600 text-white rounded-full inline-flex items-center justify-center p-4 mb-4">
                      <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4c-1.48 0-2.85.43-4.01 1.17l1.46 1.46C10.21 5.23 11.08 5 12 5c3.04 0 5.5 2.46 5.5 5.5v.5H19c2.05 0 3.71 1.66 3.71 3.71 0 1.84-1.38 3.39-3.12 3.72-.64-.71-1.57-1.17-2.59-1.17zM19 13h-4V9h4v4zM6.64 19.27l2.53-3.02H3c-1.66 0-3-1.34-3-3s1.34-3 3-3h.5V9.07C2.56 9.56 0 12.6 0 16c0 3.31 2.69 6 6 6h3.64z"/>
                      </svg>
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Upload from Google Drive</h4>
                    <p className="text-sm text-gray-600">Paste a shared Drive link</p>
                  </div>
                </button>

                {/* Link Upload */}
                <button
                  onClick={() => setUploadMode('link')}
                  className="relative cursor-pointer group"
                >
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-6 text-center transition-all group-hover:shadow-lg group-hover:border-purple-500 group-hover:from-purple-100 group-hover:to-purple-200">
                    <div className="bg-purple-600 text-white rounded-full inline-flex items-center justify-center p-4 mb-4">
                      <Link className="h-8 w-8" />
                    </div>
                    <h4 className="font-bold text-gray-900 mb-1">Upload from Link</h4>
                    <p className="text-sm text-gray-600">Paste an image URL</p>
                  </div>
                </button>
              </div>
            ) : (
              // URL Input Mode
              <div>
                <div className="mb-4">
                  <button
                    onClick={() => setUploadMode(null)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
                  >
                    <span>← Back</span>
                  </button>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h4 className="font-bold text-gray-900 mb-3">
                    {uploadMode === 'gdrive' ? 'Google Drive Link' : 'Image URL'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    {uploadMode === 'gdrive' 
                      ? 'Paste the Google Drive shared link to your image. Make sure the link is publicly accessible.'
                      : 'Paste the URL of the image you want to upload.'
                    }
                  </p>
                  
                  {uploadMode === 'gdrive' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-800 font-medium mb-2">How to share from Google Drive:</p>
                      <ol className="text-xs text-blue-700 space-y-1 ml-3">
                        <li>1. Right-click the image in Google Drive</li>
                        <li>2. Select "Share"</li>
                        <li>3. Set to "Anyone with the link" can view</li>
                        <li>4. Copy the link and paste it below</li>
                      </ol>
                    </div>
                  )}
                  
                  <input
                    type="text"
                    placeholder={uploadMode === 'gdrive' ? 'https://drive.google.com/file/d/...' : 'https://example.com/image.jpg'}
                    value={uploadLinkInput}
                    onChange={(e) => setUploadLinkInput(e.target.value)}
                    disabled={uploadLoading}
                    className="w-full border border-gray-300 px-4 py-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                  />
                  
                  {uploadError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                      {uploadError}
                    </div>
                  )}

                  {uploadLoading && (
                    <div className="flex items-center justify-center space-x-2 text-blue-600 mb-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm font-medium">Uploading to Google Cloud...</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => { setUploadMode(null); setUploadLinkInput(''); setUploadError(null); }}
                      disabled={uploadLoading}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUploadLink}
                      disabled={uploadLoading || !uploadLinkInput}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {uploadLoading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border-4 border-blue-500 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <h3 className="text-lg font-semibold text-gray-900">{previewImage.label}</h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 transition-all duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 bg-gray-50">
              <img
                src={previewImage.src}
                alt={previewImage.alt}
                className="w-full h-auto max-h-[65vh] object-contain rounded-lg shadow-md"
                onError={(e) => {
                  e.target.src = `https://placehold.co/800x800/E5E7EB/6B7280?text=${encodeURIComponent(previewImage.alt)}`;
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Existing Images Dialog */}
      {showExistingImagesDialog && <ExistingImagesDialog />}
      {/* Upload Dialog */}
      {showUploadDialog && <UploadDialog />}

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Image Comparison & Generation</h1>
          <p className="text-sm text-gray-600">
            Compare your current images against the Gold Standard and generate new Listro-powered alternatives for each slot.
          </p>
          {Object.keys(productAttributes).length > 0 && (
            <div className="mt-2 inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-xs">
              <span className="font-medium text-blue-900">Using attributes:</span>
              {Object.entries(productAttributes).map(([key, value]) => (
                <span key={key} className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {key}: {value}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Reference Image Upload Section */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md border-2 border-purple-300 p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-base font-bold text-gray-900 mb-1">Reference Image for New Images Generation</h3>
              <p className="text-xs text-gray-600">
                {referenceImage
                  ? 'Reference image selected. You can now generate Listro images.'
                  : 'Upload a reference image or select from existing images to guide the Listro generation process'
                }
              </p>
              {referenceImage && (
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded flex items-center">
                    <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Ready for New Image Generation
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {!referenceImage ? (
                <>
                  <label className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer transition-colors text-sm">
                    <Upload className="h-4 w-4" />
                    <span>Upload Reference</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageUpload}
                      className="hidden"
                    />
                  </label>
                  {!isNewProduct && getAllExistingImages().length > 0 && (
                    <button
                      onClick={() => setShowExistingImagesDialog(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      <Images className="h-4 w-4" />
                      <span>Select Existing Image</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src={referenceImage}
                      alt="Reference"
                      className="w-20 h-20 object-cover rounded-lg border-2 border-purple-400 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setPreviewImage({ src: referenceImage, alt: 'Reference Image', label: 'Reference Image' })}
                    />
                    <button
                      onClick={handleRemoveReferenceImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer transition-colors text-sm">
                      <Upload className="h-4 w-4" />
                      <span>Change</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceImageUpload}
                        className="hidden"
                      />
                    </label>
                    {!isNewProduct && getAllExistingImages().length > 0 && (
                      <button
                        onClick={() => setShowExistingImagesDialog(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                      >
                        <Images className="h-4 w-4" />
                        <span>Select Different</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        {isNewProduct ? (
          <div>
            {/* Information section for new products */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-900 font-medium">
                  ✅ For new products, generate at least 5 images (max 7)
                </p>
                {isFullyGenerated && (
                  <div className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                    Regeneration left: {Math.max(0, MAX_REGEN - totalRegenerations)} / {MAX_REGEN}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-3">
                <div className="text-center mb-3">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Gold Standard Images</h2>
                  <p className="text-xs text-gray-600">Reference benchmark images</p>
                </div>
                <div className="space-y-1">
                  {getGoldStandardImages().map((src, index) => (
                    <ImageCard
                      key={`gold-${index}`}
                      src={src}
                      alt={`Gold standard ${imageLabels[index]}`}
                      label={imageLabels[index]}
                      type="reference"
                    />
                  ))}
                </div>
              </div>

              <div className="border-2 border-blue-300 rounded-lg p-3">
                <div className="text-center mb-3">
                  <h2 className="text-base font-bold text-gray-900 mb-1">Listro Generate</h2>
                  <p className="text-xs text-gray-600">Create optimized alternatives (min 5, matches available images)</p>
                  <div className="mt-2 inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-medium">
                    {generatedImages.filter(img => img.url !== null).length} / {maxImageCount} Generated
                  </div>
                </div>
                <div className="space-y-1">
                  {generatedImages.slice(0, maxImageCount).map((imgData, index) => {
                    // Safety check: ensure imgData exists
                    const safeImgData = imgData || { url: null, isLoading: false };
                    return (
                      <ImageCard
                        key={`generated-${index}`}
                        src={safeImgData.url}
                        alt={`Listro generated ${imageLabels[index]}`}
                        label={imageLabels[index]}
                        type="generate"
                        index={index}
                        onGenerate={handleRegenerateClick}
                        isLoading={safeImgData.isLoading}
                        imgData={safeImgData}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Information section for existing products */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-900 font-medium">
                    Select at least 5 images total (max 7) - You can select both existing and generated images for each slot
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Selected: {totalSelectedImages} / 7
                    {isMaxSelectionReached && <span className="ml-2 text-red-600 font-bold">MAX LIMIT REACHED</span>}
                  </p>
                </div>
                {isFullyGenerated && (
                  <div className="text-xs px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 font-medium">
                    Regeneration left: {Math.max(0, MAX_REGEN - totalRegenerations)} / {MAX_REGEN}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {Array.from({ length: maxImageCount }, (_, index) => {
                const existingImg = getExistingImages()[index];
                const generatedImg = generatedImages[index] || { url: null, isLoading: false }; // Safety check
                const selections = selectedImages[index] || { existing: false, generated: false };
                const label = imageLabels[index] || `Image ${index + 1}`;

                return (
                  <div key={`row-${index}`} className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3">
                    <div className="text-center mb-2">
                      <h3 className="text-sm font-bold text-gray-900">{label}</h3>
                      <p className="text-xs text-gray-600">You can select both existing and generated images for this slot</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-center mb-2">
                          <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            Gold Standard
                          </span>
                        </div>
                        <ImageCard
                          src={getGoldStandardImages()[index]}
                          alt={`Gold standard ${label}`}
                          label="Reference"
                          type="reference"
                        />
                      </div>
                      <div>
                        <div className="text-center mb-2">
                          <span className="text-xs font-semibold text-gray-700 bg-gray-200 px-2 py-1 rounded">
                            Your Existing
                          </span>
                          {selections.existing && (
                            <span className="ml-2 text-xs text-green-600 font-medium">✓ Selected</span>
                          )}
                        </div>
                        <ImageCard
                          src={existingImg}
                          alt={`Existing ${label}`}
                          type="current"
                          isSelected={selections.existing}
                          onSelect={existingImg && (!isMaxSelectionReached || selections.existing) ? () => handleImageSelection(index, 'existing') : null}
                        />
                      </div>
                      <div>
                        <div className="text-center mb-2">
                          <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                            Listro Generated
                          </span>
                          {selections.generated && (
                            <span className="ml-2 text-xs text-green-600 font-medium">✓ Selected</span>
                          )}
                        </div>
                        <ImageCard
                          src={generatedImg.url}
                          alt={`Listro generated ${label}`}
                          label={label}
                          type="generate"
                          index={index}
                          onGenerate={handleRegenerateClick}
                          isLoading={generatedImg.isLoading}
                          isSelected={selections.generated}
                          onSelect={generatedImg.url && (!isMaxSelectionReached || selections.generated) ? () => handleImageSelection(index, 'generated') : null}
                          imgData={generatedImg}
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-xs text-gray-500">
                        {selections.existing && selections.generated ? 
                          "✓ Both selected for this slot" : 
                          selections.existing ? 
                          "✓ Existing selected" : 
                          selections.generated ? 
                          "✓ Generated selected" : 
                          isMaxSelectionReached ? 
                          "Max limit reached - deselect images to select more" :
                          "Click images to select"
                        }
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              📊 Displaying {maxImageCount} image slots based on available images
            </p>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {isNewProduct ? (
                <>
                  <span className="font-medium">Generated Images:</span>
                  <span className="ml-2">
                    {generatedImages.filter(img => img.url !== null).length} of 7 (min 5 required)
                  </span>
                </>
              ) : (
                <>
                  <span className="font-medium">Selected Images:</span>
                  <span className="ml-2">
                    {totalSelectedImages} of 7 (min 5 required)
                    {isMaxSelectionReached && <span className="ml-2 text-red-600 font-bold">• MAX REACHED</span>}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleSaveChanges}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors text-sm ${(isNewProduct && generatedImages.filter(img => img.url !== null).length >= 5 && generatedImages.filter(img => img.url !== null).length <= 7) ||
                (!isNewProduct && totalSelectedImages >= 5 && totalSelectedImages <= 7)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              disabled={
                isNewProduct
                  ? generatedImages.filter(img => img.url !== null).length < 5 || generatedImages.filter(img => img.url !== null).length > 7
                  : totalSelectedImages < 5 || totalSelectedImages > 7
              }
            >
              <ArrowRight className="h-4 w-4" />
              <span>Proceed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageComparisonPage;
