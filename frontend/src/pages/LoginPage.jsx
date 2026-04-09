import { useState, useEffect, useMemo } from "react";
import "./LoginPage.css";

// --- Custom Hooks ---
import { useAuth } from "../hooks/useAuth";
import { usePasswordReset } from "../hooks/usePasswordReset";

// --- UI Components ---
import BackgroundParticles from "../components/Login/BackgroundParticles";
import AuthHeader from "../components/Login/AuthHeader";
import AuthForm from "../components/Login/AuthForm";
import ForgotPasswordModal from "../components/Login/ForgotPasswordModal";

// --- Utilities ---
import { clearAuthSession, generateParticles } from "../utils/authUtils";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("kam");
  const [creativeMode, setCreativeMode] = useState(false);
  const [hovered, setHovered] = useState(false);

  // 1. Hooks
  const auth = useAuth();
  const reset = usePasswordReset();
  const particles = useMemo(() => generateParticles(25), []);

  // 2. Initial Setup
  useEffect(() => {
    clearAuthSession();
  }, []);

  return (
    <div className={`login-container ${creativeMode ? 'creative' : ''}`}>
      <BackgroundParticles particles={particles} />

      {/* Lightning effects for Creative Mode */}
      {creativeMode && (
        <div className="creative-fx">
          <div className="lightning-flash" style={{ animationDelay: '0s' }} />
          <div className="lightning-flash" style={{ animationDelay: '3s' }} />
          {[10, 30, 65, 88].map((pos, i) => (
            <div 
              key={pos}
              className="lightning-bolt" 
              style={{ left: `${pos}%`, animationDelay: `${i * 0.5}s`, transform: `skew(${i % 2 === 0 ? '-15deg' : '10deg'})` }} 
            />
          ))}
        </div>
      )}
   
      <div className="content-container">
        <AuthHeader isCreative={creativeMode} />

        <div className={`login-card ${creativeMode ? 'creative' : ''}`} style={{ animation: 'cardAppear 0.8s ease 0.3s forwards', opacity: 0 }}>
          {creativeMode && <div className="creative-glow" />}
          
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
            <button
              type="button"
              onClick={() => setCreativeMode(!creativeMode)}
              style={{
                padding: '10px 20px', borderRadius: '25px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.3s ease',
                border: creativeMode ? "1px solid rgba(148, 163, 184, 0.4)" : "2px solid rgba(255,255,255,0.2)",
                background: creativeMode ? "rgba(59, 130, 245, 0.1)" : "transparent",
                color: creativeMode ? "#60A5FA" : "#b8c1ec"
              }}
            >
              Creative Mode: {creativeMode ? "ON" : "OFF"}
            </button>
          </div>

          <AuthForm 
            email={email} setEmail={setEmail}
            password={password} setPassword={setPassword}
            role={role} setRole={setRole}
            isCreative={creativeMode}
            onSubmit={auth.handleLogin}
            isLoading={auth.isLoading}
            error={auth.error}
          />

          <button
            onClick={() => reset.setShowModal(true)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              display: 'inline-block', marginTop: '20px', color: hovered ? '#fff' : '#a8c0ff', fontSize: '0.95rem',
              textDecoration: 'none', transition: 'all 0.3s ease', background: 'none', border: 'none', cursor: 'pointer'
            }}
          >
            Forgot your password?
          </button>

          {!creativeMode && <div className="orange-glow" />}
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={reset.showModal}
        onClose={() => reset.setShowModal(false)}
        onReset={reset.handleResetPassword}
        email={reset.resetEmail}
        setEmail={reset.setResetEmail}
        status={reset.resetStatus}
        isLoading={reset.isLoading}
      />
    </div>
  );
};

export default LoginPage;
