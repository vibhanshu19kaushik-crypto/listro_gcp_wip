import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PYTHON_API_BASE_URL } from "../api/config";

export default function ChangePasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [particles, setParticles] = useState([]);
  const navigate = useNavigate();

  const email = searchParams.get("email");
  const token = searchParams.get("token");

  // ✅ Python backend base URL (Cloud Run or localhost)
  const API_BASE = PYTHON_API_BASE_URL;

  // Create background particles (same as login page)
  useEffect(() => {
    const createParticles = () => {
      const newParticles = [];
      for (let i = 0; i < 25; i++) {
        newParticles.push({
          id: i,
          size: Math.random() * 70 + 30,
          left: Math.random() * 100,
          top: Math.random() * 100,
          opacity: Math.random() * 0.08 + 0.02,
          duration: Math.random() * 30 + 20,
          delay: Math.random() * 5,
          color: "rgba(255, 255, 255, 0.1)",
        });
      }
      setParticles(newParticles);
    };

    createParticles();
  }, []);

  useEffect(() => {
    // If no email in URL, try to get it from localStorage
    if (!email) {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.email && user.needsPasswordChange) {
            // We have email in localStorage and user needs password change
            // Navigate to same page with email parameter
            navigate(`/change-password?email=${encodeURIComponent(user.email)}`, { replace: true });
            return;
          }
        } catch (e) {
          console.error("Error parsing user from localStorage:", e);
        }
      }
      
      setError("Missing email. Please login first.");
    }
  }, [email, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    if (!password || !confirmPassword) {
      setError("Please fill all fields.");
      setIsLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/update-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email || getEmailFromLocalStorage(),
          password: password,
          token: token || ""  // Token is optional for this flow
        }),
      });

      // ✅ Handle non-JSON error pages (like 404 HTML)
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response. Please check backend URL.");
      }

      if (response.ok && data.success) {
        setMessage(data.message || "Password updated successfully!");
        
        // Clear the user from localStorage
        localStorage.removeItem("user");
        window.dispatchEvent(new Event("userUpdated"));
        
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.error || "Error updating password.");
      }
    } catch (err) {
      setError(err.message || "Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get email from localStorage
  const getEmailFromLocalStorage = () => {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return user.email;
      } catch (e) {
        return "";
      }
    }
    return "";
  };

  // Amazon Icon (same as login page)
  const AmazonIcon = () => (
    <svg width="24" height="24" viewBox="0 0 448 512" fill="currentColor">
      <path d="M257.2 162.7c-48.7 1.8-169.5 15.5-169.5 117.5 0 109.5 138.3 114 183.5 43.2 6.5 10.2 35.4 37.5 45.3 46.8l56.8-56S341 288.9 341 261.4V114.3C341 89 316.5 32 228.7 32 140.7 32 94 87 94 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5 40.7-.1 35.5 29.8 35.5 69.1zm0 86.8c0 80-84.2 68-84.2 17.2 0-47.2 50.5-56.7 84.2-57.8v40.6zm136 163.5c-7.7 10-70 67-174.5 67S34.2 408.5 9.7 379c-6.8-7.7 1-11.3 5.5-8.3C88.5 415.2 203 488.5 387.7 401c7.5-3.7 13.3 2 5.5 12zm39.8 2.2c-6.5 15.8-16 26.8-21.2 31-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2-10.8 1-13 2-14-.3-2.3-5.7 21.7-15.5 37.5-17.5 15.7-1.8 41-.8 46 5.7 3.7 5.1 0 27.1-6.5 43.1z"/>
    </svg>
  );

  // Styles matching the Login Page
  const styles = {
    // Main container styles (same as login)
    container: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(-45deg, #0f0c29, #302b63, #24243e, #0f0c29)',
      backgroundSize: '400% 400%',
      animation: 'gradientBG 15s ease infinite',
    },
    // Background particles container (same as login)
    particlesContainer: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 0,
      overflow: 'hidden',
      pointerEvents: 'none',
    },
    // Main content container
    contentContainer: {
      width: '100%',
      maxWidth: '450px',
      textAlign: 'center',
      zIndex: 1,
      position: 'relative',
    },
    // Logo styles - MATCHING Login Page
    logoContainer: {
      marginBottom: '30px',
      opacity: 0,
      transform: 'translateY(-20px)',
      animation: 'fadeInUp 0.8s ease forwards',
    },
    logo: {
      fontSize: '3.8rem',
      fontWeight: 800,
      background: 'linear-gradient(90deg, #fff, #a8c0ff, #fff)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      letterSpacing: '2px',
      marginBottom: '10px',
      textShadow: '0 0 15px rgba(168, 192, 255, 0.3)',
      animation: 'logoGlow 3s ease-in-out infinite alternate',
    },
    tagline: {
      fontSize: '1.2rem',
      color: '#b8c1ec',
      fontWeight: 500,
      letterSpacing: '1px',
    },
    // Amazon Indicator (same as login)
    amazonIndicator: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      marginBottom: '25px',
      padding: '12px 20px',
      background: 'rgba(255, 153, 0, 0.1)',
      border: '1px solid rgba(255, 153, 0, 0.3)',
      borderRadius: '12px',
      width: 'fit-content',
      margin: '0 auto 25px',
    },
    amazonText: {
      color: '#ff9900',
      fontSize: '1rem',
      fontWeight: 600,
    },
    // Card with orange backlight (same style as login)
    card: {
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      borderRadius: '20px',
      padding: '40px 35px',
      textAlign: 'center',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden',
      opacity: 0,
      transform: 'translateY(30px)',
      animation: 'cardAppear 0.8s ease 0.3s forwards',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 153, 0, 0.1)',
    },
    // Orange backlight effect
    orangeGlow: {
      position: 'absolute',
      top: '-10px',
      left: '-10px',
      right: '-10px',
      bottom: '-10px',
      background: 'linear-gradient(45deg, rgba(255, 153, 0, 0.2), rgba(255, 107, 0, 0.1), rgba(255, 153, 0, 0.2))',
      borderRadius: '25px',
      zIndex: -1,
      filter: 'blur(20px)',
      opacity: 0.7,
    },
    // Title
    title: {
      fontSize: '2rem',
      color: '#fff',
      marginBottom: '10px',
      textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
      fontWeight: 600,
    },
    subtitle: {
      fontSize: '1rem',
      color: '#b8c1ec',
      marginBottom: '25px',
      opacity: 0.9,
    },
    // Input styles - same as login
    inputContainer: {
      marginBottom: '20px',
      textAlign: 'left',
    },
    label: {
      display: 'block',
      color: '#b8c1ec',
      fontSize: '0.95rem',
      fontWeight: 500,
      marginBottom: '8px',
      letterSpacing: '0.5px',
    },
    input: {
      width: '100%',
      padding: '16px 20px',
      background: 'rgba(255, 255, 255, 0.08)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '1rem',
      fontFamily: 'inherit',
      transition: 'all 0.3s ease',
      outline: 'none',
    },
    inputFocus: {
      borderColor: 'rgba(255, 153, 0, 0.5)',
      boxShadow: '0 0 0 2px rgba(255, 153, 0, 0.2)',
      background: 'rgba(255, 255, 255, 0.12)',
    },
    // Button - same style as login
    button: {
      width: '100%',
      padding: '16px',
      background: 'transparent',
      borderRadius: '50px',
      fontWeight: 700,
      fontSize: '1.1rem',
      transition: 'all 0.4s ease',
      position: 'relative',
      overflow: 'hidden',
      border: '2px solid #ff9900',
      letterSpacing: '1px',
      zIndex: 1,
      cursor: 'pointer',
      marginTop: '10px',
      color: '#fff',
    },
    secondaryButton: {
      width: '100%',
      padding: '16px',
      background: 'transparent',
      borderRadius: '50px',
      fontWeight: 700,
      fontSize: '1.1rem',
      transition: 'all 0.4s ease',
      position: 'relative',
      overflow: 'hidden',
      border: '2px solid rgba(255, 255, 255, 0.2)',
      letterSpacing: '1px',
      zIndex: 1,
      cursor: 'pointer',
      marginTop: '15px',
      color: '#b8c1ec',
    },
    // Error message (same as login)
    errorContainer: {
      marginTop: '20px',
      padding: '16px',
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    },
    errorText: {
      color: '#fecaca',
      fontSize: '0.95rem',
      lineHeight: 1.4,
    },
    errorIcon: {
      color: '#f87171',
      flexShrink: 0,
      marginTop: '2px',
    },
    // Success message
    successContainer: {
      marginTop: '20px',
      padding: '16px',
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '12px',
      textAlign: 'center',
      color: '#bbf7d0',
      fontSize: '0.95rem',
      lineHeight: 1.4,
    },
    // Email display
    emailDisplay: {
      textAlign: 'center',
      color: '#b8c1ec',
      fontSize: '0.9rem',
      marginBottom: '20px',
      padding: '10px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
    },
  };

  // CSS animations (same as login)
  const animations = `
    @keyframes gradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  
    @keyframes float {
      0% { transform: translateY(0) translateX(0) rotate(0deg); }
      100% { transform: translateY(-1000px) translateX(500px) rotate(720deg); }
    }
  
    @keyframes logoGlow {
      from { text-shadow: 0 0 10px rgba(168, 192, 255, 0.3); }
      to { text-shadow: 0 0 20px rgba(168, 192, 255, 0.7), 0 0 30px rgba(168, 192, 255, 0.4); }
    }
  
    @keyframes buttonGlow {
      0% { filter: brightness(1); }
      100% { filter: brightness(1.3); }
    }
  
    @keyframes fadeInUp {
      to { opacity: 1; transform: translateY(0); }
    }
  
    @keyframes cardAppear {
      to { opacity: 1; transform: translateY(0); }
    }
  
    @keyframes sweep {
      from { left: -100%; }
      to { left: 100%; }
    }
  
    .particle {
      position: absolute;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      animation: float 20s infinite linear;
    }

    /* Fix for placeholder text size */
    input::placeholder {
      color: rgba(184, 193, 236, 0.7) !important;
      font-size: 1rem !important;
      font-family: inherit !important;
      opacity: 0.8;
    }

    input:focus::placeholder {
      color: rgba(184, 193, 236, 0.5) !important;
    }
  `;

  // Button hover effect component (same as login)
  const ButtonHoverEffect = ({ isHovered, color = "#ff9900" }) => {
    if (!isHovered) return null;
  
    return (
      <>
        <div style={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
          animation: 'sweep 0.5s forwards',
          zIndex: -1,
        }} />
        <div style={{
          position: 'absolute',
          top: '-2px',
          left: '-2px',
          right: '-2px',
          bottom: '-2px',
          background: `linear-gradient(45deg, ${color}, ${color}dd, ${color})`,
          borderRadius: '50px',
          zIndex: -2,
          opacity: 1,
          animation: 'buttonGlow 1.5s ease-in-out infinite alternate',
        }} />
      </>
    );
  };

  return (
    <>
      <style>{animations}</style>
    
      {/* Background particles (same as login) */}
      <div style={styles.particlesContainer}>
        {particles.map(particle => (
          <div
            key={particle.id}
            className="particle"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              opacity: particle.opacity,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              background: particle.color,
            }}
          />
        ))}
      </div>
    
      <div style={styles.container}>
        <div style={styles.contentContainer}>
          {/* Logo - Consistent with Login Page */}
          <div style={styles.logoContainer}>
            <h1 style={styles.logo}>LISTRO.</h1>
            <div style={styles.tagline}>Advanced E-commerce Management Solutions</div>
          
            {/* Amazon Indicator */}
            <div style={styles.amazonIndicator}>
              <div style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff9900',
              }}>
                <AmazonIcon />
              </div>
              <div style={styles.amazonText}>Now with Amazon Integration!</div>
            </div>
          </div>

          {/* Change Password Card - Orange backlight */}
          <div style={styles.card}>
            <h2 style={styles.title}>Set Your New Password</h2>
            <p style={styles.subtitle}>
              Please create a strong password for your account
            </p>

            {/* Email display */}
            {email && (
              <div style={styles.emailDisplay}>
                Changing password for: <strong style={{color: '#fff'}}>{email}</strong>
              </div>
            )}

            {/* Error message display */}
            {error && (
              <div style={styles.errorContainer}>
                <div style={styles.errorIcon}>⚠️</div>
                <div style={styles.errorText}>{error}</div>
              </div>
            )}

            {/* Success message display */}
            {message && (
              <div style={styles.successContainer}>
                ✅ {message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={styles.inputContainer}>
                <label style={styles.label}>New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={styles.input}
                  onFocus={(e) => e.target.style = {...styles.input, ...styles.inputFocus}}
                  onBlur={(e) => e.target.style = styles.input}
                />
              </div>

              <div style={styles.inputContainer}>
                <label style={styles.label}>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  style={styles.input}
                  onFocus={(e) => e.target.style = {...styles.input, ...styles.inputFocus}}
                  onBlur={(e) => e.target.style = styles.input}
                />
              </div>

              {/* Submit button with hover effect */}
              <button 
                type="submit" 
                disabled={isLoading}
                style={styles.button}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <ButtonHoverEffect isHovered={hovered} color="#ff9900" />
                {isLoading ? "Updating..." : "Update Password"}
              </button>

              {/* Back to Login button */}
              <button
                type="button"
                onClick={() => navigate("/login")}
                style={styles.secondaryButton}
                onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#b8c1ec'}
              >
                ← Back to Login
              </button>
            </form>

            {/* Orange backlight animation (same as login) */}
            <div style={styles.orangeGlow} />
          </div>
        </div>
      </div>
    </>
  );
}
