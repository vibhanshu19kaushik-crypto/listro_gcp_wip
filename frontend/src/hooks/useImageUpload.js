import { useState, useCallback } from 'react';
import { api } from '../api/apiService';

export const useImageUpload = (setGeneratedImages) => {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadTargetIndex, setUploadTargetIndex] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadLinkInput, setUploadLinkInput] = useState('');
  const [uploadMode, setUploadMode] = useState(null); // 'machine', 'gdrive', 'link'

  const handleManualUpload = useCallback(async (file) => {
    if (!file || uploadTargetIndex === null) return;
    setUploadLoading(true);
    setUploadError(null);
    setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: true } : img));
    
    try {
      const gcsUrl = await api.images.upload(file);
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { url: gcsUrl, isLoading: false, source: 'uploaded' } : img));
      setShowUploadDialog(false);
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: false } : img));
    } finally {
      setUploadLoading(false);
    }
  }, [uploadTargetIndex, setGeneratedImages]);

  const handleLinkUpload = useCallback(async () => {
    if (!uploadLinkInput || uploadTargetIndex === null) return;
    setUploadLoading(true);
    setUploadError(null);
    setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: true } : img));

    try {
      const gcsUrl = await api.images.uploadFromLink(uploadLinkInput);
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { url: gcsUrl, isLoading: false, source: 'uploaded' } : img));
      setShowUploadDialog(false);
      setUploadLinkInput('');
    } catch (err) {
      setUploadError(err.message || 'Link upload failed');
      setGeneratedImages(prev => prev.map((img, i) => i === uploadTargetIndex ? { ...img, isLoading: false } : img));
    } finally {
      setUploadLoading(false);
    }
  }, [uploadLinkInput, uploadTargetIndex, setGeneratedImages]);

  return {
    showUploadDialog, setShowUploadDialog,
    uploadTargetIndex, setUploadTargetIndex,
    uploadLoading, uploadError, setUploadError,
    uploadLinkInput, setUploadLinkInput,
    uploadMode, setUploadMode,
    handleManualUpload, handleLinkUpload
  };
};
