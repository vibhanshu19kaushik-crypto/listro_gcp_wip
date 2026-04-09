import { useState, useCallback } from 'react';

export const useAttributeGrid = (initialAttributes = {}, initialUsed = new Set()) => {
  const [productAttributes, setProductAttributes] = useState(initialAttributes);
  const [usedAttributes, setUsedAttributes] = useState(initialUsed);
  const [showAddAttribute, setShowAddAttribute] = useState(false);
  const [newAttributeKey, setNewAttributeKey] = useState('');
  const [newAttributeValue, setNewAttributeValue] = useState('');
  const [selectedAttributeType, setSelectedAttributeType] = useState('');

  const handleAttributeChange = useCallback((key, value) => {
    setProductAttributes(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAddAttribute = useCallback(() => {
    const attributeKey = selectedAttributeType === 'custom'
      ? newAttributeKey.trim().toLowerCase().replace(/\s+/g, '')
      : selectedAttributeType;
   
    if (attributeKey && newAttributeValue.trim()) {
      setProductAttributes(prev => ({
        ...prev,
        [attributeKey]: newAttributeValue.trim()
      }));
      
      if (selectedAttributeType !== 'custom') {
        setUsedAttributes(prev => new Set([...prev, selectedAttributeType]));
      }
      
      setNewAttributeKey('');
      setNewAttributeValue('');
      setSelectedAttributeType('');
      setShowAddAttribute(false);
    }
  }, [selectedAttributeType, newAttributeKey, newAttributeValue]);

  return {
    productAttributes, setProductAttributes,
    usedAttributes, setUsedAttributes,
    showAddAttribute, setShowAddAttribute,
    newAttributeKey, setNewAttributeKey,
    newAttributeValue, setNewAttributeValue,
    selectedAttributeType, setSelectedAttributeType,
    handleAttributeChange,
    handleAddAttribute
  };
};
