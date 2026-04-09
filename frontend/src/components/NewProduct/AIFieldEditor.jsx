import React from 'react';
import { Wand2, Check, Edit2, Hash } from 'lucide-react';

const AIFieldEditor = ({
  label,
  value,
  acceptedValue,
  isEditing,
  isGenerating,
  goldenValue,
  placeholder,
  type = 'text', // text, textarea, sku
  onGenerate,
  onAccept,
  onCancel,
  onEdit,
  onChange
}) => {
  const Icon = type === 'sku' ? Hash : Wand2;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-700">{label}</h3>
        <h3 className="text-lg font-semibold text-gray-700">{label}</h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-lg p-4 h-full flex items-center">
          <div className="bg-white/60 rounded-md p-3 border border-yellow-200 w-full text-sm text-gray-800">
            {goldenValue || `No ${label} available`}
          </div>
        </div>

        <div className="h-full flex flex-col">
          {isEditing ? (
            <div className="space-y-3">
              {type === 'textarea' ? (
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white resize-none min-h-[80px]"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  placeholder={placeholder}
                />
              ) : (
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  placeholder={placeholder}
                />
              )}
              <div className="flex gap-2">
                <button className="bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center gap-1" onClick={onAccept}><Check size={16}/> Accept</button>
                <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm" onClick={onCancel}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50 min-h-[60px] flex items-center">
                {acceptedValue || <span className="text-gray-400 italic">No {label.toLowerCase()} yet</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm disabled:opacity-50"
                  onClick={onGenerate}
                  disabled={isGenerating}
                >
                  <Icon className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Generating...' : 'Listro Generate'}</span>
                </button>
                <button className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm" onClick={onEdit}>
                  <Edit2 className="h-4 w-4" />
                  <span>Edit</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIFieldEditor;
