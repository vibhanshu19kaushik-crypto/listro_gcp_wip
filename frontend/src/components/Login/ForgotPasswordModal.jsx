import React from 'react';

const ForgotPasswordModal = ({ 
  isOpen, 
  onClose, 
  onReset, 
  email, 
  setEmail, 
  status, 
  isLoading 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div className="modal-content" style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(15px)',
        borderRadius: '20px',
        padding: '40px 35px',
        width: '100%',
        maxWidth: '420px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3), 0 0 40px rgba(255, 153, 0, 0.1)',
      }}>
        <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '15px' }}>Reset Password</h2>
        <p style={{ color: '#b8c1ec', fontSize: '1rem', marginBottom: '30px', opacity: 0.9 }}>
          Enter your email to receive a password reset link.
        </p>

        <div style={{ marginBottom: '25px', textAlign: 'left' }}>
          <label style={{ display: 'block', color: '#b8c1ec', fontSize: '0.95rem', marginBottom: '8px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '12px',
              color: '#fff',
              outline: 'none',
            }}
          />
        </div>

        <button
          onClick={onReset}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '18px',
            background: 'linear-gradient(90deg, #ff9900, #ff6600)',
            border: 'none',
            borderRadius: '50px',
            color: '#fff',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          {isLoading ? "Sending..." : "Send Reset Link"}
        </button>

        {status && (
          <div style={{
            padding: '16px',
            borderRadius: '12px',
            marginTop: '20px',
            background: status.includes("✅") ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${status.includes("✅") ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: status.includes("✅") ? '#bbf7d0' : '#fecaca',
            fontSize: '0.95rem',
          }}>
            {status}
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#b8c1ec',
            padding: '12px 24px',
            borderRadius: '50px',
            fontSize: '0.95rem',
            cursor: 'pointer',
            marginTop: '15px',
            width: '100%'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;
