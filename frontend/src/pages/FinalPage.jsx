import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import { Download, Loader2, Home } from 'lucide-react';

// --- Custom Hooks ---
import { useFinalPageData } from '../hooks/useFinalPageData';
import { useImageSlider } from '../hooks/useImageSlider';
import { useFinalExport } from '../hooks/useFinalExport';

// --- Components ---
import FinalImageGallery from '../components/FinalPage/FinalImageGallery';
import ProductInfoSection from '../components/FinalPage/ProductInfoSection';
import TechnicalDetailsTable from '../components/FinalPage/TechnicalDetailsTable';
import ExportSuccessModal from '../components/FinalPage/ExportSuccessModal';

// --- Utilities ---
import { getAllDisplayDetails } from '../utils/finalPageUtils';

const FinalPage = () => {
  const navigate = useNavigate();
  const contentRef = useRef(null);

  // 1. Logic Hooks
  const { comparisonData, userInfo, allImages } = useFinalPageData();
  const imageSlider = useImageSlider(allImages);
  const exportState = useFinalExport(comparisonData, allImages, userInfo);

  // 2. Handlers
  const handleDownloadPDF = () => {
    const element = contentRef.current;
    const opt = {
      margin: 1,
      filename: `Report_${comparisonData?.originalAsin}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  const onNewSeller = () => {
    localStorage.clear();
    navigate('/data-selection');
  };

  const onNewAsin = () => {
    const sellerId = localStorage.getItem('sellerId');
    ['selectedAsins', 'comparisonPageSelectedAsin', 'existingProduct', 'goldStandardProduct', 'productFilters', 'allProductImages', 'generatedImages']
      .forEach(k => localStorage.removeItem(k));
    navigate(sellerId ? `/setup/${sellerId}` : '/data-selection');
  };

  if (!comparisonData || !userInfo) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Loader2 className="animate-spin h-12 w-12 text-orange-500" />
      </div>
    );
  }

  const displayDetails = getAllDisplayDetails(comparisonData);

  return (
    <div className="min-h-screen bg-white font-sans text-[#0F1111]">
      {/* Top Navbar */}
      <nav className="bg-[#131921] text-white px-6 py-3 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold italic tracking-tight text-[#febd69]">Listro.ai</div>
          <div className="flex items-center gap-6">
            <span className="text-sm text-gray-300 hidden md:inline">Optimizer: <span className="text-white font-medium">{userInfo.name}</span></span>
            <button
              onClick={() => navigate('/seller-list')}
              className="flex items-center gap-2 bg-[#febd69] text-black px-4 py-1.5 rounded-md font-medium hover:bg-[#f3a847] transition-colors text-sm"
            >
              <Home size={16} /> Dashboard
            </button>
          </div>
        </div>
      </nav>

      {/* Action Bar */}
      <div className="bg-[#232f3e] text-white px-6 py-2.5 border-t border-gray-700 shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm font-medium uppercase tracking-wider text-gray-400">Review & Publish</span>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <Download size={16} /> Save as PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left: Image Gallery */}
          <div className="lg:col-span-5">
            <FinalImageGallery allImages={allImages} {...imageSlider} />
          </div>

          {/* Right: Product Details */}
          <div className="lg:col-span-7 space-y-8">
            <div ref={contentRef}>
              <ProductInfoSection comparisonData={comparisonData} />
              
              {comparisonData.features && (
                <div className="py-6 border-b border-[#e7e7e7]">
                  <h2 className="text-lg font-bold mb-4">About this item</h2>
                  <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                    {comparisonData.features.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              <TechnicalDetailsTable displayDetails={displayDetails} />
            </div>

            {/* Final Export Controls */}
            <div className="p-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900">Ready to Publish?</h3>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  Clicking "Publish to Amazon" will sync your optimized listing to Google Sheets and BigQuery.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={exportState.handleCombinedSubmit}
                  disabled={exportState.isExporting}
                  className="px-10 py-4 bg-orange-600 text-white rounded-xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  {exportState.isExporting ? <Loader2 className="animate-spin" size={20} /> : '🚀 Publish to Amazon'}
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-10 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3"
                >
                  <Download size={20} /> Download PDF Report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExportSuccessModal 
        isOpen={exportState.showSuccessDialog}
        onClose={() => exportState.setShowSuccessDialog(false)}
        onNewSeller={onNewSeller}
        onNewAsin={onNewAsin}
        asin={comparisonData.originalAsin}
      />
    </div>
  );
};

export default FinalPage;
