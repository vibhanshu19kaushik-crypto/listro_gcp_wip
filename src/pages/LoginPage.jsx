// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PYTHON_API_BASE_URL } from "../api/config";


const LoginPage = () => {
 const navigate = useNavigate();


 // 🔐 Login states
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [error, setError] = useState("");
 const [isLoading, setIsLoading] = useState(false);


 // 🔁 Forgot Password states
 const [showForgot, setShowForgot] = useState(false);
 const [showModal, setShowModal] = useState(false);
 const [resetEmail, setResetEmail] = useState("");
 const [resetStatus, setResetStatus] = useState("");
 const [resetLoading, setResetLoading] = useState(false);
 const [hovered, setHovered] = useState(false);
 const [particles, setParticles] = useState([]);


 // 🌍 Backend base URL
 const BACKEND_URL = PYTHON_API_BASE_URL;


 // Create background particles
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
         color: 'rgba(255, 255, 255, 0.1)',
       });
     }
     setParticles(newParticles);
   };


   createParticles();
 }, []);


 // Check server health on component mount
 useEffect(() => {
   const checkServerHealth = async () => {
     try {
       await fetch(`${BACKEND_URL}/api/health`, {
         method: "GET",
         headers: { "Content-Type": "application/json" },
       });
     } catch (error) {
       console.warn("⚠️ Python server may not be running");
     }
   };


   checkServerHealth();
 }, [BACKEND_URL]);


 // ✅ Handle login form
 const handleLogin = async (e) => {
   e.preventDefault();
   setError("");
   setIsLoading(true);
   setShowForgot(false);


   // 🔄 TEMPORARY BYPASS FOR TEST ACCOUNTS
   if (email === "test101@gmail.com" && password === "1234") {
     await new Promise(resolve => setTimeout(resolve, 500));
    
     localStorage.setItem(
       "user",
       JSON.stringify({
         email: "test101@gmail.com",
         role: "manager",
         timestamp: new Date().toISOString(),
       })
     );
    
     window.dispatchEvent(new Event('userUpdated'));
     navigate("/seller-allocation");
     setIsLoading(false);
     return;
   }


   if (email === "admin@listro.com" && password === "admin123") {
     await new Promise(resolve => setTimeout(resolve, 500));
    
     localStorage.setItem(
       "user",
       JSON.stringify({
         email: "admin@listro.com",
         role: "admin",
         timestamp: new Date().toISOString(),
       })
     );
    
     window.dispatchEvent(new Event('userUpdated'));
     navigate("/seller-list");
     setIsLoading(false);
     return;
   }


   if (email === "test@listro.com" && password === "test@listro.com") {
     await new Promise(resolve => setTimeout(resolve, 500));
    
     localStorage.setItem(
       "user",
       JSON.stringify({
         email: "test@listro.com",
         role: "user",
         timestamp: new Date().toISOString(),
       })
     );
    
     window.dispatchEvent(new Event('userUpdated'));
     navigate("/seller-list");
     setIsLoading(false);
     return;
   }


   // For other users, try connecting to Python server
   try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 5000);


     const response = await fetch(`${BACKEND_URL}/login`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
       },
       body: JSON.stringify({ email, password }),
       signal: controller.signal,
     });


     clearTimeout(timeoutId);


     if (!response.ok) {
       throw new Error(`Server returned ${response.status}`);
     }


     const data = await response.json();


     if (data.success) {
       localStorage.setItem(
         "user",
         JSON.stringify({
           email,
           role: data.role || "user",
           timestamp: new Date().toISOString(),
         })
       );
      
       window.dispatchEvent(new Event('userUpdated'));


       if (data.first_time) {
         navigate(`/change-password?email=${encodeURIComponent(email)}`);
       } else {
         navigate("/seller-list");
       }
     } else {
       setError(data.error || "Invalid email or password");
       setShowForgot(true);
     }
   } catch (err) {
     if (err.name === "AbortError") {
       setError("Server timeout. Please check if Python server is running.");
     } else {
       setError("Cannot connect to authentication server. Please try again later.");
     }
     setShowForgot(true);
   } finally {
     setIsLoading(false);
   }
 };


 // 📧 Forgot Password handler
 const handleResetPassword = async () => {
   setResetStatus("");


   if (!resetEmail.trim()) {
     setResetStatus("Please enter your email.");
     return;
   }


   setResetLoading(true);
  
   try {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 5000);


     const res = await fetch(`${BACKEND_URL}/reset-password`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ email: resetEmail }),
       signal: controller.signal,
     });


     clearTimeout(timeoutId);


     const data = await res.json();


     if (res.ok && data.pending_approval) {
       setResetStatus("⚠️ Please contact your admin for approval.");
     } else if (res.ok && data.success) {
       setResetStatus("✅ Reset link sent to your email!");
     } else {
       setResetStatus(data.error || "Failed to send reset link.");
     }
   } catch (err) {
     if (err.name === "AbortError") {
       setResetStatus("⚠️ Server timeout.");
     } else {
       setResetStatus("⚠️ Server error. Try again later.");
     }
   } finally {
     setResetLoading(false);
   }
 };


 // Amazon Icon (from your ListroDashboard)
 const AmazonIcon = () => (
   <svg width="24" height="24" viewBox="0 0 448 512" fill="currentColor">
     <path d="M257.2 162.7c-48.7 1.8-169.5 15.5-169.5 117.5 0 109.5 138.3 114 183.5 43.2 6.5 10.2 35.4 37.5 45.3 46.8l56.8-56S341 288.9 341 261.4V114.3C341 89 316.5 32 228.7 32 140.7 32 94 87 94 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5 40.7-.1 35.5 29.8 35.5 69.1zm0 86.8c0 80-84.2 68-84.2 17.2 0-47.2 50.5-56.7 84.2-57.8v40.6zm136 163.5c-7.7 10-70 67-174.5 67S34.2 408.5 9.7 379c-6.8-7.7 1-11.3 5.5-8.3C88.5 415.2 203 488.5 387.7 401c7.5-3.7 13.3 2 5.5 12zm39.8 2.2c-6.5 15.8-16 26.8-21.2 31-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2-10.8 1-13 2-14-.3-2.3-5.7 21.7-15.5 37.5-17.5 15.7-1.8 41-.8 46 5.7 3.7 5.1 0 27.1-6.5 43.1z"/>
   </svg>
 );


 // Styles matching the UI image
 const styles = {
   // Main container styles
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
   // Background particles container
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
   // Logo styles - MATCHING ListroDashboard
   logoContainer: {
     marginBottom: '40px',
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
   // Amazon Indicator
   amazonIndicator: {
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     gap: '12px',
     marginBottom: '30px',
     padding: '12px 20px',
     background: 'rgba(255, 153, 0, 0.1)',
     border: '1px solid rgba(255, 153, 0, 0.3)',
     borderRadius: '12px',
     width: 'fit-content',
     margin: '0 auto 30px',
   },
   amazonText: {
     color: '#ff9900',
     fontSize: '1rem',
     fontWeight: 600,
   },
   // Login Card with orange backlight
   loginCard: {
     background: 'rgba(255, 255, 255, 0.05)',
     backdropFilter: 'blur(10px)',
     borderRadius: '20px',
     padding: '50px 40px',
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
     marginBottom: '40px',
     opacity: 0.9,
   },
   // Input styles - FIXED for consistent placeholder size
   inputContainer: {
     marginBottom: '25px',
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
   // Lightning button - Amazon orange theme
   button: {
     width: '100%',
     padding: '18px',
     background: 'transparent',
     borderRadius: '50px',
     fontWeight: 700,
     fontSize: '1.1rem',
     transition: 'all 0.4s ease',
     position: 'relative',
     overflow: 'hidden',
     border: '2px solid',
     letterSpacing: '1px',
     zIndex: 1,
     cursor: 'pointer',
     marginTop: '10px',
     color: '#fff',
   },
   // Error message
   errorContainer: {
     marginTop: '25px',
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
   // Forgot password link
   forgotLink: {
     display: 'inline-block',
     marginTop: '20px',
     color: '#a8c0ff',
     fontSize: '0.95rem',
     textDecoration: 'none',
     transition: 'all 0.3s ease',
     position: 'relative',
     paddingBottom: '2px',
     background: 'none',
     border: 'none',
     cursor: 'pointer',
   },
   forgotLinkHover: {
     color: '#fff',
     textShadow: '0 0 8px rgba(168, 192, 255, 0.5)',
   },
   // Modal styles
   modalOverlay: {
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
   },
   modalContent: {
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
   },
   modalTitle: {
     fontSize: '1.8rem',
     color: '#fff',
     marginBottom: '15px',
     textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
   },
   modalSubtitle: {
     color: '#b8c1ec',
     fontSize: '1rem',
     marginBottom: '30px',
     lineHeight: 1.5,
     opacity: 0.9,
   },
   // Success/Error message in modal
   statusMessage: {
     padding: '16px',
     borderRadius: '12px',
     marginTop: '20px',
     display: 'flex',
     alignItems: 'flex-start',
     gap: '12px',
     fontSize: '0.95rem',
     lineHeight: 1.4,
   },
   successMessage: {
     background: 'rgba(34, 197, 94, 0.1)',
     border: '1px solid rgba(34, 197, 94, 0.3)',
     color: '#bbf7d0',
   },
   errorMessage: {
     background: 'rgba(239, 68, 68, 0.1)',
     border: '1px solid rgba(239, 68, 68, 0.3)',
     color: '#fecaca',
   },
   // Cancel button
   cancelButton: {
     background: 'transparent',
     border: '1px solid rgba(255, 255, 255, 0.2)',
     color: '#b8c1ec',
     padding: '12px 24px',
     borderRadius: '50px',
     fontSize: '0.95rem',
     cursor: 'pointer',
     transition: 'all 0.3s ease',
     marginTop: '20px',
   },
 };


 // CSS animations
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
  
   @keyframes spin {
     from { transform: rotate(0deg); }
     to { transform: rotate(360deg); }
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


 // Button hover effect component
 const ButtonHoverEffect = ({ isHovered }) => {
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
         background: 'linear-gradient(45deg, #ff9900, #ff6600, #ff9900)',
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
    
     {/* Background particles */}
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
         {/* Logo - Consistent with ListroDashboard */}
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
             <span style={styles.amazonText}>Amazon Listing Platform</span>
           </div>
         </div>
        
         {/* Login Card with Orange Backlight */}
         <div style={styles.loginCard}>
           {/* Orange backlight effect */}
           <div style={styles.orangeGlow} />
          
           <h2 style={styles.title}>Sign In</h2>
           <p style={styles.subtitle}>Access your Amazon listing dashboard</p>
          
           <form onSubmit={handleLogin}>
             <div style={styles.inputContainer}>
               <label style={styles.label}>Email Address</label>
               <input
                 type="email"
                 placeholder="Enter your email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 required
                 disabled={isLoading}
                 style={{
                   ...styles.input,
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = 'rgba(255, 153, 0, 0.5)';
                   e.target.style.boxShadow = '0 0 0 2px rgba(255, 153, 0, 0.2)';
                   e.target.style.background = 'rgba(255, 255, 255, 0.12)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                   e.target.style.boxShadow = 'none';
                   e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                 }}
               />
             </div>
            
             <div style={styles.inputContainer}>
               <label style={styles.label}>Password</label>
               <input
                 type="password"
                 placeholder="Enter your password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 required
                 disabled={isLoading}
                 style={{
                   ...styles.input,
                 }}
                 onFocus={(e) => {
                   e.target.style.borderColor = 'rgba(255, 153, 0, 0.5)';
                   e.target.style.boxShadow = '0 0 0 2px rgba(255, 153, 0, 0.2)';
                   e.target.style.background = 'rgba(255, 255, 255, 0.12)';
                 }}
                 onBlur={(e) => {
                   e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                   e.target.style.boxShadow = 'none';
                   e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                 }}
               />
             </div>


             <button
               type="submit"
               disabled={isLoading}
               onMouseEnter={() => setHovered('login')}
               onMouseLeave={() => setHovered(false)}
               style={{
                 ...styles.button,
                 borderColor: hovered === 'login' ? 'transparent' : '#ff9900',
                 color: hovered === 'login' ? '#fff' : '#ff9900',
                 transform: hovered === 'login' ? 'translateY(-3px)' : 'translateY(0)',
                 boxShadow: hovered === 'login' ? '0 10px 25px rgba(255, 153, 0, 0.5)' : 'none',
                 opacity: isLoading ? 0.7 : 1,
                 cursor: isLoading ? 'not-allowed' : 'pointer',
               }}
             >
               {isLoading ? (
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                   <div style={{
                     width: '20px',
                     height: '20px',
                     border: '2px solid #ff9900',
                     borderTopColor: 'transparent',
                     borderRadius: '50%',
                     animation: 'spin 1s linear infinite'
                   }} />
                   <span>Signing in...</span>
                 </div>
               ) : (
                 'Sign In'
               )}
               <ButtonHoverEffect isHovered={hovered === 'login' && !isLoading} />
             </button>
           </form>


           {/* Forgot Password link */}
           <button
             type="button"
             onClick={() => setShowModal(true)}
             onMouseEnter={() => setHovered('forgot')}
             onMouseLeave={() => setHovered(false)}
             style={{
               ...styles.forgotLink,
               ...(hovered === 'forgot' ? styles.forgotLinkHover : {}),
             }}
           >
             Forgot your password?
           </button>


           {/* Error Message */}
           {error && (
             <div style={styles.errorContainer}>
               <div style={styles.errorIcon}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                   <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                 </svg>
               </div>
               <p style={styles.errorText}>{error}</p>
             </div>
           )}
         </div>
       </div>
     </div>


     {/* Forgot Password Modal */}
     {showModal && (
       <div style={styles.modalOverlay} onClick={() => {
         setShowModal(false);
         setResetStatus("");
         setResetEmail("");
       }}>
         <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
           <h3 style={styles.modalTitle}>Reset Password</h3>
           <p style={styles.modalSubtitle}>
             Enter your email to receive a password reset link.
           </p>


           <input
             type="email"
             placeholder="Enter your email"
             value={resetEmail}
             onChange={(e) => setResetEmail(e.target.value)}
             style={{
               ...styles.input,
             }}
             onFocus={(e) => {
               e.target.style.borderColor = 'rgba(255, 153, 0, 0.5)';
               e.target.style.boxShadow = '0 0 0 2px rgba(255, 153, 0, 0.2)';
               e.target.style.background = 'rgba(255, 255, 255, 0.12)';
             }}
             onBlur={(e) => {
               e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
               e.target.style.boxShadow = 'none';
               e.target.style.background = 'rgba(255, 255, 255, 0.08)';
             }}
           />


           <button
             onClick={handleResetPassword}
             disabled={resetLoading}
             onMouseEnter={() => setHovered('reset')}
             onMouseLeave={() => setHovered(false)}
             style={{
               ...styles.button,
               borderColor: hovered === 'reset' ? 'transparent' : '#ff9900',
               color: hovered === 'reset' ? '#fff' : '#ff9900',
               transform: hovered === 'reset' ? 'translateY(-3px)' : 'translateY(0)',
               boxShadow: hovered === 'reset' ? '0 10px 25px rgba(255, 153, 0, 0.5)' : 'none',
               opacity: resetLoading ? 0.7 : 1,
               cursor: resetLoading ? 'not-allowed' : 'pointer',
               marginTop: '20px',
             }}
           >
             {resetLoading ? 'Sending...' : 'Send Reset Link'}
             <ButtonHoverEffect isHovered={hovered === 'reset' && !resetLoading} />
           </button>


           {resetStatus && (
             <div style={{
               ...styles.statusMessage,
               ...(resetStatus.startsWith("✅") ? styles.successMessage : styles.errorMessage),
             }}>
               <div style={{ flexShrink: 0, marginTop: '2px' }}>
                 {resetStatus.startsWith("✅") ? (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                   </svg>
                 ) : (
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                   </svg>
                 )}
               </div>
               <p>{resetStatus}</p>
             </div>
           )}


           <div style={{ textAlign: 'center', marginTop: '30px' }}>
             <button
               onClick={() => {
                 setShowModal(false);
                 setResetStatus("");
                 setResetEmail("");
               }}
               style={styles.cancelButton}
               onMouseEnter={(e) => {
                 e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                 e.target.style.color = '#fff';
                 e.target.style.borderColor = 'rgba(255, 153, 0, 0.3)';
               }}
               onMouseLeave={(e) => {
                 e.target.style.background = 'transparent';
                 e.target.style.color = '#b8c1ec';
                 e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
               }}
             >
               Cancel
             </button>
           </div>
         </div>
       </div>
     )}
   </>
 );
};


export default LoginPage;

