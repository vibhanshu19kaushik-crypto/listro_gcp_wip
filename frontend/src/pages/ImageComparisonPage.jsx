import { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowRight, Loader2 } from 'lucide-react';

// --- Custom Hooks ---
import { useImageComparisonState } from '../hooks/useImageComparisonState';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { useImageUpload } from '../hooks/useImageUpload';

// --- UI Components ---
import ImageCard from '../components/ImageComparison/ImageCard';
import ReferenceImageSelector from '../components/ImageComparison/ReferenceImageSelector';
import UploadManagerModal from '../components/ImageComparison/UploadManagerModal';
import ExistingImagesDialog from '../components/ImageComparison/ExistingImagesDialog';

// --- Utilities ---
import { IMAGE_LABELS, MIN_REQUIRED, SELECTION_LIMIT, urlToFile } from '../utils/imageComparisonUtils';

const ImageComparisonPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [previewImage, setPreviewImage] = useState(null);
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceFile, setReferenceFile] = useState(null);
  const [showExistingDialog, setShowExistingDialog] = useState(false);

  // 1. Unified State Hook
  const state = useImageComparisonState(location.state);

  // 2. Action Hooks
  const generation = useImageGeneration(state.productAttributes, state.setGeneratedImages);
  const upload = useImageUpload(state.setGeneratedImages);

  // 3. Handlers
  const handleRefUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReferenceFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setReferenceImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSelectExisting = async (url) => {
    const file = await urlToFile(url, `ref-${Date.now()}.jpg`);
    setReferenceFile(file);
    setReferenceImage(url);
    setShowExistingDialog(false);
  };

  const handleFinalSave = () => {
    const selectedList = [];
    const generatedUrls = [];

    if (state.isNewProduct) {
      state.generatedImages.forEach((img, i) => {
        if (img.url) {
          selectedList.push({ url: img.url, type: 'generated', label: IMAGE_LABELS[i] });
          generatedUrls.push(img.url);
        }
      });
    } else {
      Object.entries(state.selectedImages).forEach(([i, sel]) => {
        const idx = parseInt(i);
        if (sel.existing && state.existingImages[idx]) {
          selectedList.push({ url: state.existingImages[idx], type: 'existing', label: IMAGE_LABELS[idx], slot: idx });
        }
        if (sel.generated && state.generatedImages[idx].url) {
          selectedList.push({ url: state.generatedImages[idx].url, type: 'generated', label: IMAGE_LABELS[idx], slot: idx });
          generatedUrls.push(state.generatedImages[idx].url);
        }
      });
    }

    localStorage.setItem('generatedImages', JSON.stringify(generatedUrls));
    localStorage.setItem('allProductImages', JSON.stringify(selectedList));
    navigate('/final-page');
  };

  if (!state.goldStandardProduct) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-4" />
        <p className="text-gray-500 font-bold tracking-widest uppercase">Initializing Visual Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-5xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 uppercase tracking-widest text-sm">{previewImage.label}</h3>
              <button onClick={() => setPreviewImage(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <img src={previewImage.src} className="w-full h-auto max-h-[80vh] object-contain" alt="Preview"/>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter">Visual Comparison Lab</h1>
          <p className="text-gray-500 max-w-2xl text-sm leading-relaxed">
            Synchronize your product visuals with the Gold Standard benchmarks. Generate AI alternatives or bring your own studio photography.
          </p>
        </div>

        <ReferenceImageSelector 
          referenceImage={referenceImage}
          onUpload={handleRefUpload}
          onSelectExisting={() => setShowExistingDialog(true)}
          onRemove={() => { setReferenceImage(null); setReferenceFile(null); }}
          isNewProduct={state.isNewProduct}
          hasExistingImages={state.existingImages.length > 0}
        />

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4 border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${state.totalSelectedCount >= MIN_REQUIRED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {state.totalSelectedCount} of {SELECTION_LIMIT} Selected
              </div>
              {state.totalSelectedCount < MIN_REQUIRED && (
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">⚠️ Minimum {MIN_REQUIRED} required</span>
              )}
            </div>
            <button
              onClick={handleFinalSave}
              disabled={state.totalSelectedCount < MIN_REQUIRED}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-xl ${state.totalSelectedCount >= MIN_REQUIRED ? 'bg-black text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
            >
              <span>Synchronize & Proceed</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-12">
            {Array.from({ length: state.maxImageCount }, (_, i) => {
              const label = IMAGE_LABELS[i] || `Style ${i + 1}`;
              return (
                <div key={i} className="group flex flex-col gap-6 p-8 rounded-3xl bg-gray-50/50 border border-gray-100 hover:bg-white hover:shadow-2xl transition-all hover:border-blue-100">
                  <div className="flex items-center gap-4">
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-lg text-xs font-black">{i + 1}</span>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">{label}</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                      <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Benchmark</span>
                      <ImageCard 
                        src={state.goldImages[i]} 
                        alt="Gold Standard" 
                        label="Gold Standard" 
                        type="reference"
                      />
                    </div>
                    
                    {!state.isNewProduct && (
                      <div className="space-y-3">
                        <span className="text-[10px] font-black text-yellow-700 uppercase tracking-widest bg-yellow-50 px-3 py-1 rounded-full">Legacy Asset</span>
                        <ImageCard 
                          src={state.existingImages[i]} 
                          alt="Existing" 
                          label="Your Current" 
                          type="current"
                          isSelected={state.selectedImages[i]?.existing}
                          onSelect={() => state.handleToggleSelection(i, 'existing')}
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest bg-purple-50 px-3 py-1 rounded-full">Listro Alternative</span>
                      <ImageCard 
                        src={state.generatedImages[i].url} 
                        alt="AI Alternative" 
                        label="Listro Generated" 
                        type="generate"
                        index={i}
                        onGenerate={() => generation.handleGenerate(i, referenceImage, referenceFile)}
                        onUploadRequest={(idx) => { upload.setUploadTargetIndex(idx); upload.setShowUploadDialog(true); }}
                        isLoading={state.generatedImages[i].isLoading}
                        loadingMessage={generation.currentMessage}
                        isSelected={state.selectedImages[i]?.generated}
                        onSelect={() => state.handleToggleSelection(i, 'generated')}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <UploadManagerModal 
        isOpen={upload.showUploadDialog}
        onClose={() => upload.setShowUploadDialog(false)}
        onFileUpload={upload.handleManualUpload}
        onLinkUpload={upload.handleLinkUpload}
        uploadMode={upload.uploadMode}
        setUploadMode={upload.setUploadMode}
        linkInput={upload.uploadLinkInput}
        setLinkInput={upload.setUploadLinkInput}
        isLoading={upload.uploadLoading}
        error={upload.uploadError}
      />

      <ExistingImagesDialog 
        isOpen={showExistingDialog}
        onClose={() => setShowExistingDialog(false)}
        images={state.existingImages}
        onSelect={handleSelectExisting}
      />
    </div>
  );
};

export default ImageComparisonPage;
