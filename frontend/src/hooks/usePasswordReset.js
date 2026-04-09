import { useState, useCallback } from 'react';
import { api } from '../api/apiService';
export const usePasswordReset = () => {
  const [showModal, setShowModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = useCallback(async () => {
    if (!resetEmail.trim()) {
      setResetStatus("Please enter your email.");
      return;
    }

    setIsLoading(true);
    setResetStatus("");
    
    try {
      const data = await api.auth.resetPassword(resetEmail.trim().toLowerCase());
      
      if (data.success) {
        setResetStatus(data.pending_approval ? "✅ Request submitted! Admin approval required." : "✅ Reset link sent to your email!");
        setResetEmail("");
        setTimeout(() => {
          setShowModal(false);
          setResetStatus("");
        }, 3000);
      } else {
        setResetStatus(data.error || "Email not found or request failed.");
      }
    } catch (err) {
      setResetStatus("⚠️ Server error. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, [resetEmail]);

  return {
    showModal, setShowModal,
    resetEmail, setResetEmail,
    resetStatus, isLoading,
    handleResetPassword
  };
};
