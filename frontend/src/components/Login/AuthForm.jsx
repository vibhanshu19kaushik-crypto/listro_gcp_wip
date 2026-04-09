import React from 'react';

const AuthForm = ({ 
  email, setEmail, 
  password, setPassword, 
  role, setRole, 
  isCreative, 
  onSubmit, 
  isLoading,
  error 
}) => {
  const roleLabel = (r) => {
    if (isCreative) return r === "kam" ? "Imagen Resource" : "Imagen Admin";
    return r === "kam" ? "KAM Resource" : "Admin";
  };

  return (
    <>
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "20px" }}>
        {["kam", "lead"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            style={{
              padding: "10px 16px",
              borderRadius: "12px",
              border: role === r ? (isCreative ? "1px solid rgba(148, 163, 184, 0.4)" : "2px solid #ff9900") : "1px solid rgba(255,255,255,0.15)",
              background: role === r ? (isCreative ? "rgba(148, 163, 184, 0.1)" : "rgba(255,153,0,0.08)") : "transparent",
              color: isCreative ? "#E2E8F0" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
              transition: "all 0.3s ease",
            }}
          >
            {roleLabel(r)}
          </button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ email, password, role, isCreative }); }}>
        <div style={{ marginBottom: '25px', textAlign: 'left' }}>
          <label style={{ display: 'block', color: isCreative ? '#CBD5E1' : '#b8c1ec', fontSize: '0.95rem', fontWeight: 500, marginBottom: '8px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            required
            className="auth-input"
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: '12px',
              fontSize: '1rem',
              outline: 'none',
              transition: 'all 0.3s ease',
              ...(isCreative && { borderColor: 'rgba(148, 163, 184, 0.3)' })
            }}
          />
        </div>
        
        <div style={{ marginBottom: '25px', textAlign: 'left' }}>
          <label style={{ display: 'block', color: isCreative ? '#CBD5E1' : '#b8c1ec', fontSize: '0.95rem', fontWeight: 500, marginBottom: '8px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            className="auth-input"
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: '12px',
              fontSize: '1rem',
              outline: 'none',
              transition: 'all 0.3s ease',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              background: isCreative ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              ...(isCreative && { borderColor: 'rgba(148, 163, 184, 0.3)' })
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading} 
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: '50px',
            fontWeight: 700,
            fontSize: '1.1rem',
            cursor: 'pointer',
            transition: 'all 0.4s ease',
            color: isCreative ? '#000' : '#fff',
            background: isCreative ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'transparent',
            border: isCreative ? 'none' : '2px solid #ff9900',
            boxShadow: isCreative ? '0 4px 15px rgba(245, 158, 11, 0.4)' : 'none',
          }}
        >
          {isLoading ? "Signing in..." : isCreative ? `Sign in as ${roleLabel(role)}` : `Sign in as ${roleLabel(role)}`}
        </button>
      </form>

      {error && (
        <div style={{
          marginTop: '25px',
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <div style={{ color: '#f87171' }}>⚠️</div>
          <div style={{ color: '#fecaca', fontSize: '0.95rem', lineHeight: 1.4 }}>{error}</div>
        </div>
      )}
    </>
  );
};

export default AuthForm;
