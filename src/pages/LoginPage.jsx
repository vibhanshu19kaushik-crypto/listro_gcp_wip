// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PYTHON_API_BASE_URL } from "../api/config";




const LoginPage = () => {
 const navigate = useNavigate();


 // 🔐 Login states
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [role, setRole] = useState("kam"); // "kam" = KAM Resource, "lead" = Lead
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
 const [creativeMode, setCreativeMode] = useState(false);


 // 🌍 Backend base URL
 const BACKEND_URL = PYTHON_API_BASE_URL;
 useEffect(() => {
  // 🔐 FORCE RESET LOGIN STATE
  localStorage.removeItem("user");
  localStorage.removeItem("selectedAsins");
  localStorage.removeItem("actionType");

  setEmail("");
  setPassword("");
  setError("");
  setIsLoading(false);

  // Notify other components
  window.dispatchEvent(new Event("userUpdated"));
}, []);


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
         color: "rgba(255, 255, 255, 0.1)",
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


   // 🎨 Creative Mode (Listro Imagen) Login Flow
   // Step 1: Send credentials to Listro Imagen backend on port 7000
   // Imagen backend validates against Google Sheet
   if (creativeMode === true) {
     try {
       setError("");
       console.log("🎨 Logging in with Creative Mode - Imagen credentials");
       
       // Create abort controller for timeout
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
       
       const response = await fetch("http://localhost:7000/auth/login", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
           email: email,
           password: password,
         }),
         signal: controller.signal,
       });

       clearTimeout(timeoutId);

       const data = await response.json();
       console.log("📊 Imagen backend response:", data);

       // Step 2: Check if Imagen backend validated credentials successfully
       if (data.success) {
         // Step 3: Redirect to Listro Imagen dashboard on port 8000
         // Pass email as query parameter for dashboard context
         console.log("✅ Imagen login successful, redirecting to dashboard...");
         window.location.href = `http://localhost:8000/dashboard?email=${encodeURIComponent(data.email || email)}`;
         return;
       } else {
         // Backend returned unsuccessful response
         console.log("❌ Imagen login failed:", data.error);
         setError(data.error || "Invalid Imagen credentials");
         setShowForgot(true);
         setIsLoading(false);
         return;
       }
     } catch (err) {
       console.error("❌ Imagen login error:", err);
       
       if (err.name === "AbortError") {
         setError("⚠️ Timeout: Listro Imagen backend (port 7000) is not responding. Please ensure it's running.");
       } else if (err.message.includes("Failed to fetch")) {
         setError("⚠️ Cannot connect to Listro Imagen backend. Is port 7000 running?");
       } else {
         setError("⚠️ Error connecting to Listro Imagen auth server: " + err.message);
       }
       
       setShowForgot(true);
       setIsLoading(false);
       return;
     }
   }


   // --- New Lead flow: call backend /lead-login ---
   if (role === "lead") {
     try {
       const controller = new AbortController();
       const timeoutId = setTimeout(() => controller.abort(), 5000);


       const response = await fetch(`${BACKEND_URL}/lead-login`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
         },
         body: JSON.stringify({ email, password }),
         signal: controller.signal,
       });


       clearTimeout(timeoutId);


       if (!response.ok) {
         let errText = `Server returned ${response.status}`;
         try {
           const errJson = await response.json();
           if (errJson && errJson.error) errText = errJson.error;
         } catch (_) {}
         setError(errText);
         setShowForgot(true);
         setIsLoading(false);
         return;
       }


       const data = await response.json();
       if (data.success) {
         localStorage.setItem(
           "user",
           JSON.stringify({
             email,
             role: "lead",
             timestamp: new Date().toISOString(),
           })
         );
         window.dispatchEvent(new Event("userUpdated"));


         // DEBUG: confirm stored user and perform navigation
         console.log("Lead login success — localStorage user:", localStorage.getItem("user"));
         navigate("/seller-allocation", { replace: true });
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
     return; // ensure KAM flow is not executed for Lead
   }


   // 🔄 TEMPORARY BYPASS FOR TEST ACCOUNTS (KAM / existing flow remains unchanged)
   if (email === "test101@gmail.com" && password === "1234") {
     await new Promise((resolve) => setTimeout(resolve, 500));


     localStorage.setItem(
       "user",
       JSON.stringify({
         email: "test101@gmail.com",
         role: "manager",
         timestamp: new Date().toISOString(),
       })
     );


     window.dispatchEvent(new Event("userUpdated"));
     navigate("/seller-allocation");
     setIsLoading(false);
     return;
   }


   if (email === "admin@listro.com" && password === "admin123") {
     await new Promise((resolve) => setTimeout(resolve, 500));


     localStorage.setItem(
       "user",
       JSON.stringify({
         email: "admin@listro.com",
         role: "admin",
         timestamp: new Date().toISOString(),
       })
     );


     window.dispatchEvent(new Event("userUpdated"));
     navigate("/seller-list");
     setIsLoading(false);
     return;
   }


   if (email === "test@listro.com" && password === "test@listro.com") {
     await new Promise((resolve) => setTimeout(resolve, 500));


     localStorage.setItem(
       "user",
       JSON.stringify({
         email: "test@listro.com",
         role: "user",
         timestamp: new Date().toISOString(),
       })
     );


     window.dispatchEvent(new Event("userUpdated"));
     navigate("/seller-list");
     setIsLoading(false);
     return;
   }


   // For other users, try connecting to Python server (KAM flow)
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


     // UPDATED SECTION: Handle KAM login with temp password check
     if (data.success) {
       // Check if this is first login OR temporary password
       if (data.first_time === true || data.is_temp_password === true) {
         console.log("First time login or temp password detected, redirecting to change password");
        
         // Redirect to change password page with email as parameter
         localStorage.setItem(
           "user",
           JSON.stringify({
             email,
             role: data.role || "user",
             needsPasswordChange: true,
             timestamp: new Date().toISOString(),
           })
         );
        
         window.dispatchEvent(new Event("userUpdated"));
        
         // Navigate to change password with email as query parameter
         navigate(`/change-password?email=${encodeURIComponent(email)}`);
         setIsLoading(false);
         return;
       }
      
       // Regular login for non-first-time users
       localStorage.setItem(
         "user",
         JSON.stringify({
           email,
           role: data.role || "user",
           timestamp: new Date().toISOString(),
         })
       );
       window.dispatchEvent(new Event("userUpdated"));
      
       // Navigate based on role
       if (data.role === "admin") {
         navigate("/seller-list");
       } else {
         navigate("/seller-list"); // Or wherever KAM users should go
       }
     } else {
       setError(data.error || "Invalid credentials");
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




 // 📧 Forgot Password handler - CORRECTED VERSION
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


     // Use the correct endpoint name
     const res = await fetch(`${BACKEND_URL}/reset-password`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
         email: resetEmail.trim().toLowerCase()
       }),
       signal: controller.signal,
     });


     clearTimeout(timeoutId);


     const data = await res.json();


     if (res.ok && data.success) {
       // Check if it's pending approval (from backend response)
       if (data.pending_approval === true) {
         setResetStatus("✅ Password reset request submitted! Admin approval required.");
       } else {
         setResetStatus("✅ Reset link sent to your email!");
       }
      
       // Clear email field after successful request
       setResetEmail("");
       // Auto-close modal after 3 seconds
       setTimeout(() => {
         setShowModal(false);
         setResetStatus("");
       }, 3000);
     } else {
       setResetStatus(data.error || "Email not found or request failed.");
     }
   } catch (err) {
     if (err.name === "AbortError") {
       setResetStatus("⚠️ Server timeout. Please try again.");
     } else {
       setResetStatus("⚠️ Server error. Please try again later.");
       console.error("Reset password error:", err);
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


 // 🎨 Creative Mode Styles - Listro Imagen Theme (Modern & Minimalistic)
 const creativeStyles = {
   container: {
     minHeight: '100vh',
     display: 'flex',
     flexDirection: 'column',
     alignItems: 'center',
     justifyContent: 'center',
     padding: '20px',
     position: 'relative',
     overflow: 'hidden',
     background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
   },
   logoContainer: {
     marginBottom: '40px',
     opacity: 0,
     transform: 'translateY(-20px)',
     animation: 'fadeInUp 0.8s ease forwards',
   },
   logo: {
     fontSize: '4.5rem',
     fontWeight: 900,
     background: 'linear-gradient(135deg, #FFFFFF, #E2E8F0)',
     backgroundSize: '200% 200%',
     WebkitBackgroundClip: 'text',
     backgroundClip: 'text',
     color: 'transparent',
     letterSpacing: '3px',
     marginBottom: '15px',
   },
   tagline: {
     fontSize: '1.3rem',
     color: '#94A3B8',
     fontWeight: 500,
     letterSpacing: '1px',
   },
   loginCard: {
     background: 'rgba(30, 41, 59, 0.7)',
     backdropFilter: 'blur(20px)',
     borderRadius: '20px',
     padding: '50px 40px',
     textAlign: 'center',
     border: '1px solid rgba(148, 163, 184, 0.1)',
     position: 'relative',
     overflow: 'hidden',
     opacity: 0,
     transform: 'translateY(30px)',
     animation: 'cardAppear 0.8s ease 0.3s forwards',
     boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
   },
   glow: {
     position: 'absolute',
     top: '-50%',
     left: '-50%',
     width: '200%',
     height: '200%',
     background: 'radial-gradient(circle, rgba(59, 130, 246, 0.05) 0%, transparent 70%)',
     animation: 'rotateGlow 10s linear infinite',
     zIndex: -1,
   },
   toggle: {
     padding: '10px 20px',
     borderRadius: '25px',
     border: '1px solid rgba(148, 163, 184, 0.3)',
     background: 'rgba(148, 163, 184, 0.05)',
     color: '#E2E8F0',
     cursor: 'pointer',
     fontWeight: 600,
     fontSize: '0.9rem',
     transition: 'all 0.3s ease',
     textTransform: 'uppercase',
     letterSpacing: '1px',
   },
 };


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
    @keyframes logoGlowCreative {
     0% { filter: brightness(1); }
     50% { filter: brightness(1.1); }
     100% { filter: brightness(1); }
   }
    @keyframes rotateGlow {
     0% { transform: rotate(0deg); }
     100% { transform: rotate(360deg); }
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

   /* Lightning animations */
   @keyframes lightning {
     0%, 100% { opacity: 0; }
     5% { opacity: 0; }
     10% { opacity: 1; }
     15% { opacity: 0.2; }
     20% { opacity: 1; }
     25% { opacity: 0; }
     30%, 100% { opacity: 0; }
   }

   @keyframes flash {
     0%, 100% { opacity: 0; }
     10% { opacity: 0.6; }
     15% { opacity: 0.2; }
     20% { opacity: 0.5; }
     25%, 100% { opacity: 0; }
   }

   .lightning-bolt {
     position: absolute;
     width: 4px;
     height: 100%;
     background: linear-gradient(180deg, transparent, #F59E0B, #D97706, #F59E0B, transparent);
     box-shadow: 0 0 30px #F59E0B, 0 0 60px #D97706, 0 0 90px #F59E0B;
     animation: lightning 6s infinite;
     opacity: 0;
     filter: blur(1px);
   }

   .lightning-flash {
     position: fixed;
     top: 0;
     left: 0;
     width: 100%;
     height: 100%;
     background: radial-gradient(circle, rgba(245, 158, 11, 0.3) 0%, rgba(217, 119, 6, 0.15) 50%, transparent 80%);
     pointer-events: none;
     animation: flash 6s infinite;
     opacity: 0;
     z-index: 1;
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

     {/* Lightning effects for Creative Mode */}
     {creativeMode && (
       <>
         <div className="lightning-flash" style={{ animationDelay: '0s' }} />
         <div className="lightning-flash" style={{ animationDelay: '3s' }} />
         <div 
           className="lightning-bolt" 
           style={{ 
             left: '10%', 
             animationDelay: '0s',
             transform: 'skew(-15deg)'
           }} 
         />
         <div 
           className="lightning-bolt" 
           style={{ 
             left: '30%', 
             animationDelay: '0.2s',
             transform: 'skew(10deg)'
           }} 
         />
         <div 
           className="lightning-bolt" 
           style={{ 
             left: '65%', 
             animationDelay: '3s',
             transform: 'skew(-8deg)'
           }} 
         />
         <div 
           className="lightning-bolt" 
           style={{ 
             left: '88%', 
             animationDelay: '3.2s',
             transform: 'skew(12deg)'
           }} 
         />
       </>
     )}
  
     <div style={creativeMode ? creativeStyles.container : styles.container}>
       <div style={styles.contentContainer}>
         {/* Logo - Consistent with ListroDashboard */}
         <div style={styles.logoContainer}>
           {creativeMode ? (
             <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px' }}>
               <h1 style={creativeStyles.logo}>LISTRO</h1>
               <h2 style={{ 
                 fontSize: '2rem', 
                 fontWeight: 700,
                 background: 'linear-gradient(135deg, #FFFFFF, #E2E8F0)',
                 WebkitBackgroundClip: 'text',
                 backgroundClip: 'text',
                 color: 'transparent',
                 margin: 0,
                 paddingBottom: '8px',
                 letterSpacing: '1px'
               }}>IMAGEN</h2>
             </div>
           ) : (
             <h1 style={styles.logo}>LISTRO</h1>
           )}
           <div style={styles.tagline}>{creativeMode ? "Listro-Powered Image Creation" : "Advanced E-commerce Management Solutions"}</div>
        
           {/* Amazon Indicator - Hide in creative mode */}
           {!creativeMode && (
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
           )}
         </div>


         {/* Login Card - Orange backlight (Creative styling when ON) */}
         <div style={creativeMode ? creativeStyles.loginCard : styles.loginCard}>
           {/* Creative Mode Glow Effect */}
           {creativeMode && <div style={creativeStyles.glow} />}
           {/* Creative Mode Toggle */}
           <div style={{ display: "flex", justifyContent: "center", marginBottom: "25px" }}>
             <button
               type="button"
               onClick={() => setCreativeMode(!creativeMode)}
               style={creativeMode ? {
                 ...creativeStyles.toggle,
                 background: 'rgba(59, 130, 246, 0.1)',
                 borderColor: 'rgba(59, 130, 246, 0.4)',
                 color: '#60A5FA',
               } : {
                 padding: "10px 18px",
                 borderRadius: "25px",
                 border: "2px solid rgba(255,255,255,0.2)",
                 background: "transparent",
                 color: "#b8c1ec",
                 cursor: "pointer",
                 fontWeight: 600,
                 fontSize: "0.9rem",
                 transition: "all 0.3s ease",
               }}
             >
               Creative Mode: {creativeMode ? "ON" : "OFF"}
             </button>
           </div>

           {/* Role selector - Different options for Creative Mode */}
           <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "20px" }}>
              <button
                type="button"
                onClick={() => setRole("kam")}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: role === "kam" ? (creativeMode ? "1px solid rgba(148, 163, 184, 0.4)" : "2px solid #ff9900") : "1px solid rgba(255,255,255,0.15)",
                  background: role === "kam" ? (creativeMode ? "rgba(148, 163, 184, 0.1)" : "rgba(255,153,0,0.08)") : "transparent",
                  color: creativeMode ? "#E2E8F0" : "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.3s ease",
                }}
              >
                {creativeMode ? "Imagen Resource" : "KAM Resource"}
              </button>
              <button
                type="button"
                onClick={() => setRole("lead")}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: role === "lead" ? (creativeMode ? "1px solid rgba(148, 163, 184, 0.4)" : "2px solid #ff9900") : "1px solid rgba(255,255,255,0.15)",
                  background: role === "lead" ? (creativeMode ? "rgba(148, 163, 184, 0.1)" : "rgba(255,153,0,0.08)") : "transparent",
                  color: creativeMode ? "#E2E8F0" : "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.3s ease",
                }}
              >
                {creativeMode ? "Imagen Admin" : "Admin"}
              </button>
            </div>


           {/* Email and password inputs */}
           <form onSubmit={handleLogin}>
             <div style={styles.inputContainer}>
               <label style={{...styles.label, color: creativeMode ? '#CBD5E1' : '#b8c1ec'}}>Email</label>
               <input
                 type="email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 placeholder="Enter your email"
                 autoComplete="email"
                 required
                 style={{
                   ...styles.input,
                   ...(creativeMode && {
                     borderColor: 'rgba(148, 163, 184, 0.3)',
                     background: 'rgba(15, 23, 42, 0.5)',
                     color: '#F1F5F9',
                   })
                 }}
               />
             </div>
             <div style={styles.inputContainer}>
               <label style={{...styles.label, color: creativeMode ? '#CBD5E1' : '#b8c1ec'}}>Password</label>
               <input
                 type="password"
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 placeholder="Enter your password"
                 autoComplete="current-password"
                 required
                 style={{
                   ...styles.input,
                   ...(creativeMode && {
                     borderColor: 'rgba(148, 163, 184, 0.3)',
                     background: 'rgba(15, 23, 42, 0.5)',
                     color: '#F1F5F9',
                   })
                 }}
               />
             </div>


             {/* Submit button with role indication */}
             <button 
               type="submit" 
               disabled={isLoading} 
               style={{
                 ...styles.button,
                 ...(creativeMode && {
                   background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                   border: 'none',
                   color: '#000',
                   fontWeight: 700,
                   boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                 })
               }}
             >
               {isLoading ? "Signing in..." : creativeMode ? `Sign in as ${role === "kam" ? "Imagen Resource" : "Imagen Admin"}` : `Sign in as ${role === "kam" ? "KAM Resource" : "Admin"}`}
             </button>
           </form>


           {/* Error message display */}
           {error && (
             <div style={styles.errorContainer}>
               <div style={styles.errorIcon}>⚠️</div>
               <div style={styles.errorText}>{error}</div>
             </div>
           )}


           {/* Forgot password link */}
           <button
             onClick={() => setShowModal(true)}
             style={styles.forgotLink}
             className={hovered ? "hovered" : ""}
             onMouseEnter={() => setHovered(true)}
             onMouseLeave={() => setHovered(false)}
           >
             Forgot your password?
           </button>


           {/* Orange backlight animation */}
           <div style={styles.orangeGlow} />
         </div>
       </div>
     </div>


     {/* Forgot Password Modal */}
     {showModal && (
       <div style={styles.modalOverlay}>
         <div style={styles.modalContent}>
           <h2 style={styles.modalTitle}>Reset Password</h2>
           <p style={styles.modalSubtitle}>
             Enter your email to receive a password reset link.
           </p>


           <div style={styles.inputContainer}>
             <label style={styles.label}>Email</label>
             <input
               type="email"
               value={resetEmail}
               onChange={(e) => setResetEmail(e.target.value)}
               placeholder="Enter your email"
               required
               style={styles.input}
             />
           </div>


           <button
             onClick={handleResetPassword}
             disabled={resetLoading}
             style={{
               ...styles.button,
               marginTop: '10px',
               background: 'linear-gradient(90deg, #ff9900, #ff6600)',
               border: 'none',
               padding: '12px',
             }}
           >
             {resetLoading ? "Sending..." : "Send Reset Link"}
           </button>


           {/* Status message for reset action */}
           {resetStatus && (
             <div style={{
               ...styles.statusMessage,
               ...(resetStatus.includes("success") ? styles.successMessage : styles.errorMessage),
             }}>
               {resetStatus}
             </div>
           )}


           {/* Close button */}
           <button
             onClick={() => setShowModal(false)}
             style={{
               ...styles.cancelButton,
               marginTop: '15px',
             }}
           >
             Close
           </button>
         </div>
       </div>
     )}
   </>
 );
};


export default LoginPage;

