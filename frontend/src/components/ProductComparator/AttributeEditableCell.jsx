import React, { useState } from 'react';
import { Check, Edit2 } from 'lucide-react';

/**
 * Component for editable attributes.
 * Provides a clean interface for editing, cancelling, and accepting attribute changes.
 * 
 * @param {string} attributeKey - The name of the attribute (e.g., "Material")
 * @param {string} initialValue - The current value of the attribute
 * @param {function} onAccept - Callback when the "Accept" button is clicked
 * @param {boolean} isAccepted - Whether this attribute has already been accepted
 */
const AttributeEditableCell = ({ attributeKey, initialValue, onAccept, isAccepted }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [acceptedValue, setAcceptedValue] = useState(initialValue);

  const handleAccept = () => {
    setAcceptedValue(value);
    setIsEditing(false);
    onAccept();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-gray-600">{attributeKey}</div>
        {isAccepted && (
          <div className="flex items-center text-green-600">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <input
            type="text"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              className="flex items-center space-x-1 px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
              onClick={handleAccept}
            >
              <Check className="h-3.5 w-3.5" />
              <span>Accept</span>
            </button>
            <button
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors text-sm"
              onClick={() => {
                setValue(acceptedValue);
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-gray-800 text-sm flex-1">{acceptedValue}</p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3 w-3" />
              <span>Edit</span>
            </button>
            {!isAccepted && (
              <button
                className="flex items-center space-x-1 px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs"
                onClick={handleAccept}
              >
                <Check className="h-3 w-3" />
                <span>Accept</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttributeEditableCell;
