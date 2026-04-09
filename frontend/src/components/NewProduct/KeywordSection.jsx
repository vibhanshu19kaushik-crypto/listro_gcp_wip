import React from 'react';
import { Wand2, Check, Edit2 } from 'lucide-react';

const KeywordSection = ({ 
  goldenProduct,
  keywords,
  keywordStats,
  isGeneratingKeywords,
  isEditingKeywords,
  tempKeywords,
  setTempKeywords,
  onGenerate,
  onStartEdit,
  onSaveEdit,
  onCancelEdit
}) => {
  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-700">Reference Keywords</h3>
          <p className="text-sm text-gray-500 mt-1">Keywords from gold standard (for reference)</p>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-700">Listing Keywords</h3>
            <button
              className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
              onClick={onGenerate}
              disabled={isGeneratingKeywords}
            >
              <Wand2 className={`h-4 w-4 ${isGeneratingKeywords ? 'animate-spin' : ''}`} />
              <span>{isGeneratingKeywords ? 'Generating...' : 'Listro Generate'}</span>
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">Enter 7-8 keywords (separated by ;) - Max 250 characters</p>
        </div>
      </div>
     
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4 min-h-[144px]">
          <div className="bg-white/60 rounded-md p-3 border border-yellow-200 h-full flex flex-col">
            <div className="flex flex-wrap gap-2 mb-2">
              {goldenProduct?.title?.split(/\s+/).slice(0, 6).map((kw, i) => (
                <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {isEditingKeywords ? (
            <div className="space-y-3">
              <textarea
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white resize-none min-h-[100px]"
                value={tempKeywords}
                onChange={e => setTempKeywords(e.target.value)}
                maxLength={250}
              />
              <div className="flex gap-2">
                <button className="bg-green-600 text-white px-3 py-1.5 rounded text-sm" onClick={onSaveEdit}><Check size={16}/> Save</button>
                <button className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm" onClick={onCancelEdit}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative min-h-[144px] border border-gray-300 rounded-md p-3 bg-white">
                <div className="flex flex-wrap gap-2">
                  {keywords?.split(';').map(k => k.trim()).filter(k => k).map((kw, i) => (
                    <span key={i} className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">{kw}</span>
                  ))}
                </div>
                {!keywords && <p className="text-gray-400 italic">No keywords yet...</p>}
                <div className="absolute bottom-2 right-2 text-xs text-gray-500">{keywordStats.charCount}/250</div>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>{keywordStats.count}/8 recommended</span>
                <button onClick={onStartEdit} className="text-blue-600 flex items-center gap-1"><Edit2 size={14}/> Edit</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeywordSection;
