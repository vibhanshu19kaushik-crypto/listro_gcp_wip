import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


const ListroDashboard = () => {
 const [hoveredCard, setHoveredCard] = useState(null);
 const [hoveredButton, setHoveredButton] = useState(null);
 const navigate = useNavigate();

 useEffect(() => {
  const user = localStorage.getItem("user");

  if (!user) {
    navigate("/login", { replace: true });
  }
}, [navigate]);


 useEffect(() => {
   // Create background particles
   const createParticles = () => {
     const particlesContainer = document.getElementById('particles');
     if (!particlesContainer) return;
    
     // Clear existing particles
     particlesContainer.innerHTML = '';
    
     const particleCount = 30;
    
     for (let i = 0; i < particleCount; i++) {
       const particle = document.createElement('div');
       particle.className = 'particle';
      
       // Random size
       const size = Math.random() * 100 + 20;
       particle.style.width = `${size}px`;
       particle.style.height = `${size}px`;
      
       // Random position
       particle.style.left = `${Math.random() * 100}%`;
       particle.style.top = `${Math.random() * 100}%`;
      
       // Random opacity
       particle.style.opacity = Math.random() * 0.1 + 0.05;
      
       // Random animation duration and delay
       const duration = Math.random() * 30 + 20;
       const delay = Math.random() * 5;
       particle.style.animationDuration = `${duration}s`;
       particle.style.animationDelay = `${delay}s`;
      
       particlesContainer.appendChild(particle);
     }
   };


   createParticles();
  
   // Cleanup function
   return () => {
     const particlesContainer = document.getElementById('particles');
     if (particlesContainer) {
       particlesContainer.innerHTML = '';
     }
   };
 }, []);


 const handlePlatformClick = (platform) => {
   if (platform === 'Amazon') {
     navigate('/login');
   } else {
     alert(`${platform} Listing management is coming soon!`);
   }
 };


 // Amazon Icon
 const AmazonIcon = () => (
   <svg width="44" height="44" viewBox="0 0 448 512" fill="currentColor">
     <path d="M257.2 162.7c-48.7 1.8-169.5 15.5-169.5 117.5 0 109.5 138.3 114 183.5 43.2 6.5 10.2 35.4 37.5 45.3 46.8l56.8-56S341 288.9 341 261.4V114.3C341 89 316.5 32 228.7 32 140.7 32 94 87 94 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5 40.7-.1 35.5 29.8 35.5 69.1zm0 86.8c0 80-84.2 68-84.2 17.2 0-47.2 50.5-56.7 84.2-57.8v40.6zm136 163.5c-7.7 10-70 67-174.5 67S34.2 408.5 9.7 379c-6.8-7.7 1-11.3 5.5-8.3C88.5 415.2 203 488.5 387.7 401c7.5-3.7 13.3 2 5.5 12zm39.8 2.2c-6.5 15.8-16 26.8-21.2 31-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2-10.8 1-13 2-14-.3-2.3-5.7 21.7-15.5 37.5-17.5 15.7-1.8 41-.8 46 5.7 3.7 5.1 0 27.1-6.5 43.1z"/>
   </svg>
 );


 // Flipkart Icon
 const FlipkartIcon = () => (
   <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
     <path d="M3.833 1.333a.993.993 0 0 0-.333.061V1c0-.551.449-1 1-1h14.667c.551 0 1 .449 1 1v.333H3.833zm17.334 2.334H2.833c-.551 0-1 .449-1 1V23c0 .551.449 1 1 1h7.3l1.098-5.645h-2.24c-.051 0-5.158-.241-5.158-.241l4.639-.327-.078-.366-1.978-.285 1.882-.158-.124-.449-3.075-.467s3.341-.373 3.392-.373h3.232l.247-1.331c.289-1.616.945-2.807 1.973-3.693 1.033-.892 2.344-1.332 3.937-1.332.643 0 1.053.151 1.231.463.118.186.201.516.279.859.074.352.140.671.095.903-.057.345-.461.465-1.197.465h-.253c-1.327 0-2.134.763-2.405 2.31l-.243 1.355h1.54c.574 0 .781.402.622 1.306-.17.941-.539 1.36-1.111 1.36H14.9L13.804 24h7.362c.551 0 1-.449 1-1V4.667a1 1 0 0 0-.999-1zM20.5 2.333A.334.334 0 0 0 20.167 2H3.833a.334.334 0 0 0-.333.333V3h17v-.667z"/>
   </svg>
 );


 // Meesho Icon
 const MeeshoIcon = () => (
   <svg width="44" height="44" viewBox="0 0 24 24" fill="currentColor">
     <path d="M4 4h4v10a2 2 0 0 1-4 0V4zm12 0h4v10a2 2 0 0 1-4 0V4z" opacity="0.5"/>
     <path d="M2 6a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6z" fill="none" stroke="currentColor" strokeWidth="2"/>
     <path d="M7 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
   </svg>
 );


 const platformData = [
   {
     id: 'amazon',
     name: 'Amazon Listing',
     icon: <AmazonIcon />,
     description: 'Optimize your Amazon product listings with advanced AI tools. Increase visibility, improve conversions, and boost your sales performance.',
     iconBg: 'linear-gradient(135deg, #ff9900, #ff6600)',
     cardBg: 'rgba(255, 255, 255, 0.05)',
     borderColor: 'rgba(255, 255, 255, 0.1)',
     hoverBorderColor: 'rgba(255, 153, 0, 0.3)',
     glow: '0 0 30px rgba(255, 153, 0, 0.2)',
     buttonBorder: '#ff9900',
     buttonText: '#ff9900',
     buttonHoverBg: 'linear-gradient(45deg, #ff9900, #ff6600, #ff9900)',
     buttonShadow: '0 10px 25px rgba(255, 153, 0, 0.3)',
     iconShadow: '0 0 20px rgba(255, 153, 0, 0.2)',
     iconHoverShadow: '0 0 30px rgba(255, 153, 0, 0.4)',
     lightColor: '#ff9900',
     gradientStart: '#ff9900',
     gradientEnd: '#ff6600'
   },
   {
     id: 'flipkart',
     name: 'Flipkart Listing',
     icon: <FlipkartIcon />,
     description: 'Enhance visibility and sales on Flipkart marketplaces. Leverage powerful analytics and optimization tools for maximum impact.',
     iconBg: 'linear-gradient(135deg, #047bd5, #1a4f8c)',
     cardBg: 'rgba(255, 255, 255, 0.05)',
     borderColor: 'rgba(255, 255, 255, 0.1)',
     hoverBorderColor: 'rgba(4, 123, 213, 0.3)',
     glow: '0 0 30px rgba(4, 123, 213, 0.2)',
     buttonBorder: '#047bd5',
     buttonText: '#047bd5',
     buttonHoverBg: 'linear-gradient(45deg, #047bd5, #1a4f8c, #047bd5)',
     buttonShadow: '0 10px 25px rgba(4, 123, 213, 0.3)',
     iconShadow: '0 0 20px rgba(4, 123, 213, 0.2)',
     iconHoverShadow: '0 0 30px rgba(4, 123, 213, 0.4)',
     lightColor: '#047bd5',
     gradientStart: '#047bd5',
     gradientEnd: '#1a4f8c'
   },
   {
     id: 'meesho',
     name: 'Meesho Listing',
     icon: <MeeshoIcon />,
     description: 'Manage and grow your Meesho store with powerful insights. Streamline operations and maximize your marketplace potential.',
     iconBg: 'linear-gradient(135deg, #f43397, #d10363)',
     cardBg: 'rgba(255, 255, 255, 0.05)',
     borderColor: 'rgba(255, 255, 255, 0.1)',
     hoverBorderColor: 'rgba(244, 51, 151, 0.3)',
     glow: '0 0 30px rgba(244, 51, 151, 0.2)',
     buttonBorder: '#f43397',
     buttonText: '#f43397',
     buttonHoverBg: 'linear-gradient(45deg, #f43397, #d10363, #f43397)',
     buttonShadow: '0 10px 25px rgba(244, 51, 151, 0.3)',
     iconShadow: '0 0 20px rgba(244, 51, 151, 0.2)',
     iconHoverShadow: '0 0 30px rgba(244, 51, 151, 0.4)',
     lightColor: '#f43397',
     gradientStart: '#f43397',
     gradientEnd: '#d10363'
   }
 ];


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
     maxWidth: '1200px',
     width: '100%',
     textAlign: 'center',
     zIndex: 1,
     position: 'relative',
   },
   // Logo styles
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
   // Title section with glow effect
   titleContainer: {
     marginBottom: '50px',
     opacity: 0,
     transform: 'translateY(-20px)',
     animation: 'fadeInUp 0.8s ease 0.2s forwards',
   },
   title: {
     fontSize: '2.7rem',
     background: 'linear-gradient(90deg, #fff, #a8c0ff, #fff)',
     WebkitBackgroundClip: 'text',
     backgroundClip: 'text',
     color: 'transparent',
     marginBottom: '15px',
     textShadow: '0 0 10px rgba(168, 192, 255, 0.3)',
     animation: 'titleGlow 3s ease-in-out infinite alternate',
   },
   subtitle: {
     fontSize: '1.2rem',
     color: '#b8c1ec',
     maxWidth: '600px',
     margin: '0 auto',
     lineHeight: 1.6,
   },
   // Platform cards container
   platformsContainer: {
     display: 'flex',
     flexWrap: 'wrap',
     justifyContent: 'center',
     gap: '30px',
     marginTop: '30px',
   },
   // Platform card
   platformCard: {
     background: 'rgba(255, 255, 255, 0.05)',
     backdropFilter: 'blur(10px)',
     borderRadius: '20px',
     boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
     width: '320px',
     padding: '40px 30px',
     textAlign: 'center',
     transition: 'all 0.4s ease',
     cursor: 'pointer',
     border: '1px solid rgba(255, 255, 255, 0.1)',
     position: 'relative',
     overflow: 'hidden',
     opacity: 0,
     transform: 'translateY(30px)',
     animation: `cardAppear 0.8s ease forwards`,
   },
   // Platform icon
   platformIcon: {
     width: '90px',
     height: '90px',
     borderRadius: '50%',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     margin: '0 auto 25px',
     fontSize: '2.8rem',
     color: 'white',
     position: 'relative',
     transition: 'all 0.4s ease',
     zIndex: 2,
   },
   // Platform name
   platformName: {
     fontSize: '1.9rem',
     color: '#fff',
     marginBottom: '20px',
     fontWeight: 700,
     textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
     zIndex: 2,
     position: 'relative',
   },
   // Platform description
   platformDescription: {
     color: '#b8c1ec',
     lineHeight: 1.6,
     fontSize: '1.05rem',
     zIndex: 2,
     position: 'relative',
   },
   // Lightning button
   ctaButton: {
     display: 'inline-block',
     marginTop: '30px',
     padding: '15px 35px',
     background: 'transparent',
     borderRadius: '50px',
     textDecoration: 'none',
     fontWeight: 700,
     fontSize: '1.1rem',
     transition: 'all 0.4s ease',
     position: 'relative',
     overflow: 'hidden',
     border: '2px solid',
     letterSpacing: '1px',
     zIndex: 2,
     cursor: 'pointer',
   },
   // Footer
   footer: {
     marginTop: '80px',
     color: '#b8c1ec',
     fontSize: '0.95rem',
     padding: '20px',
     borderTop: '1px solid rgba(255, 255, 255, 0.1)',
     width: '100%',
     maxWidth: '800px',
   },
 };


 // Add dynamic animations based on card hover
 const getCardStyle = (platform, index) => {
   const isHovered = hoveredCard === platform.id;
   return {
     ...styles.platformCard,
     animationDelay: `${0.4 + (index * 0.2)}s`,
     transform: isHovered ? 'translateY(-10px)' : 'translateY(0)',
     boxShadow: isHovered
       ? `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 40px ${platform.lightColor}15`
       : '0 10px 30px rgba(0, 0, 0, 0.2)',
     borderColor: isHovered ? platform.hoverBorderColor : platform.borderColor,
   };
 };


 // Get button style based on hover state
 const getButtonStyle = (platform) => {
   const isButtonHovered = hoveredButton === platform.id;
   return {
     ...styles.ctaButton,
     borderColor: isButtonHovered ? 'transparent' : platform.buttonBorder,
     color: isButtonHovered ? '#fff' : platform.buttonText,
     transform: isButtonHovered ? 'translateY(-3px)' : 'translateY(0)',
     boxShadow: isButtonHovered ? platform.buttonShadow : 'none',
   };
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
     to { text-shadow: 0 0 25px rgba(168, 192, 255, 0.8), 0 0 40px rgba(168, 192, 255, 0.5); }
   }
  
   @keyframes titleGlow {
     from { text-shadow: 0 0 10px rgba(168, 192, 255, 0.3); }
     to { text-shadow: 0 0 20px rgba(168, 192, 255, 0.8), 0 0 35px rgba(168, 192, 255, 0.5); }
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
  
   @keyframes borderLight {
     0% {
       transform: translateX(-100%);
     }
     100% {
       transform: translateX(200%);
     }
   }
  
   @keyframes subtleGlow {
     0%, 100% {
       opacity: 0.2;
     }
     50% {
       opacity: 0.4;
     }
   }
  
   .particle {
     position: absolute;
     background: rgba(255, 255, 255, 0.1);
     border-radius: 50%;
     animation: float 20s infinite linear;
   }
 `;


 return (
   <>
     <style>{animations}</style>
    
     {/* Background particles */}
     <div id="particles" style={styles.particlesContainer} />
    
     <div style={styles.container}>
       <div style={styles.contentContainer}>
         {/* Logo */}
         <div style={styles.logoContainer}>
           <h1 style={styles.logo}>LISTRO</h1>
           <div style={styles.tagline}>Advanced E-commerce Management Solutions</div>
         </div>
        
         {/* Title Section with Glow Effect */}
         <div style={styles.titleContainer}>
           <h2 style={styles.title}>Select Your Platform</h2>
           <p style={styles.subtitle}>
             Choose a marketplace to manage, optimize, and supercharge your product listings with our advanced tools.
           </p>
         </div>
        
         {/* Platform Cards */}
         <div style={styles.platformsContainer}>
           {platformData.map((platform, index) => {
             const isCardHovered = hoveredCard === platform.id;
             const isButtonHovered = hoveredButton === platform.id;
            
             return (
               <div
                 key={platform.id}
                 style={{
                   position: 'relative',
                 }}
                 onMouseEnter={() => setHoveredCard(platform.id)}
                 onMouseLeave={() => setHoveredCard(null)}
                 onClick={() => handlePlatformClick(platform.name.split(' ')[0])}
               >
                 {/* Border Light Effect - Top */}
                 <div style={{
                   position: 'absolute',
                   top: '-2px',
                   left: '-2px',
                   right: '-2px',
                   height: '2px',
                   background: `linear-gradient(90deg, transparent, ${platform.lightColor}, transparent)`,
                   borderRadius: '2px',
                   animation: isCardHovered ? 'borderLight 2s linear infinite' : 'none',
                   opacity: isCardHovered ? 0.8 : 0,
                   transition: 'opacity 0.3s ease',
                   zIndex: 2,
                 }} />
                
                 {/* Border Light Effect - Right */}
                 <div style={{
                   position: 'absolute',
                   top: '-2px',
                   right: '-2px',
                   bottom: '-2px',
                   width: '2px',
                   background: `linear-gradient(180deg, transparent, ${platform.lightColor}, transparent)`,
                   borderRadius: '2px',
                   animation: isCardHovered ? 'borderLight 2s linear infinite 0.5s' : 'none',
                   opacity: isCardHovered ? 0.8 : 0,
                   transition: 'opacity 0.3s ease',
                   zIndex: 2,
                 }} />
                
                 {/* Border Light Effect - Bottom */}
                 <div style={{
                   position: 'absolute',
                   bottom: '-2px',
                   left: '-2px',
                   right: '-2px',
                   height: '2px',
                   background: `linear-gradient(90deg, transparent, ${platform.lightColor}, transparent)`,
                   borderRadius: '2px',
                   animation: isCardHovered ? 'borderLight 2s linear infinite 1s' : 'none',
                   opacity: isCardHovered ? 0.8 : 0,
                   transition: 'opacity 0.3s ease',
                   zIndex: 2,
                 }} />
                
                 {/* Border Light Effect - Left */}
                 <div style={{
                   position: 'absolute',
                   top: '-2px',
                   left: '-2px',
                   bottom: '-2px',
                   width: '2px',
                   background: `linear-gradient(180deg, transparent, ${platform.lightColor}, transparent)`,
                   borderRadius: '2px',
                   animation: isCardHovered ? 'borderLight 2s linear infinite 1.5s' : 'none',
                   opacity: isCardHovered ? 0.8 : 0,
                   transition: 'opacity 0.3s ease',
                   zIndex: 2,
                 }} />
                
                 <div
                   style={getCardStyle(platform, index)}
                 >
                   {/* Card Background Gradient */}
                   {isCardHovered && (
                     <div style={{
                       position: 'absolute',
                       top: 0,
                       left: 0,
                       right: 0,
                       bottom: 0,
                       background: `linear-gradient(
                         135deg,
                         ${platform.lightColor}05,
                         ${platform.lightColor}10,
                         ${platform.lightColor}05
                       )`,
                       borderRadius: '20px',
                       zIndex: 1,
                     }} />
                   )}
                  
                   {/* Corner Accents */}
                   <div style={{
                     position: 'absolute',
                     top: '12px',
                     left: '12px',
                     width: '12px',
                     height: '12px',
                     borderTop: `2px solid ${platform.lightColor}40`,
                     borderLeft: `2px solid ${platform.lightColor}40`,
                     opacity: isCardHovered ? 0.8 : 0.3,
                     transition: 'opacity 0.3s ease',
                     zIndex: 1,
                   }} />
                   <div style={{
                     position: 'absolute',
                     top: '12px',
                     right: '12px',
                     width: '12px',
                     height: '12px',
                     borderTop: `2px solid ${platform.lightColor}40`,
                     borderRight: `2px solid ${platform.lightColor}40`,
                     opacity: isCardHovered ? 0.8 : 0.3,
                     transition: 'opacity 0.3s ease',
                     zIndex: 1,
                   }} />
                   <div style={{
                     position: 'absolute',
                     bottom: '12px',
                     left: '12px',
                     width: '12px',
                     height: '12px',
                     borderBottom: `2px solid ${platform.lightColor}40`,
                     borderLeft: `2px solid ${platform.lightColor}40`,
                     opacity: isCardHovered ? 0.8 : 0.3,
                     transition: 'opacity 0.3s ease',
                     zIndex: 1,
                   }} />
                   <div style={{
                     position: 'absolute',
                     bottom: '12px',
                     right: '12px',
                     width: '12px',
                     height: '12px',
                     borderBottom: `2px solid ${platform.lightColor}40`,
                     borderRight: `2px solid ${platform.lightColor}40`,
                     opacity: isCardHovered ? 0.8 : 0.3,
                     transition: 'opacity 0.3s ease',
                     zIndex: 1,
                   }} />
                  
                   <div
                     style={{
                       ...styles.platformIcon,
                       background: platform.iconBg,
                       boxShadow: isCardHovered
                         ? platform.iconHoverShadow
                         : platform.iconShadow,
                       transform: isCardHovered
                         ? 'scale(1.1)'
                         : 'scale(1)',
                     }}
                   >
                     {platform.icon}
                   </div>
                  
                   <h3 style={styles.platformName}>
                     {platform.name}
                   </h3>
                  
                   <p style={styles.platformDescription}>
                     {platform.description}
                   </p>
                  
                   <button
                     style={getButtonStyle(platform)}
                     onMouseEnter={() => setHoveredButton(platform.id)}
                     onMouseLeave={() => setHoveredButton(null)}
                     onClick={(e) => {
                       e.stopPropagation();
                       handlePlatformClick(platform.name.split(' ')[0]);
                     }}
                   >
                     {isButtonHovered && (
                       <>
                         <div style={{
                           position: 'absolute',
                           top: 0,
                           left: '-100%',
                           width: '100%',
                           height: '100%',
                           background: `linear-gradient(90deg, transparent, ${platform.lightColor}30, transparent)`,
                           animation: 'borderLight 1s forwards',
                           zIndex: -1,
                         }} />
                         <div style={{
                           position: 'absolute',
                           top: '-2px',
                           left: '-2px',
                           right: '-2px',
                           bottom: '-2px',
                           background: platform.buttonHoverBg,
                           borderRadius: '50px',
                           zIndex: -2,
                           opacity: 1,
                         }} />
                       </>
                     )}
                     Select Platform
                   </button>
                 </div>
               </div>
             );
           })}
         </div>
        
         {/* Footer */}
         <div style={styles.footer}>
           <p>©LISTRO All rights reserved. | Advanced E-commerce Optimization Platform</p>
         </div>
       </div>
     </div>
   </>
 );
};


export default ListroDashboard;

