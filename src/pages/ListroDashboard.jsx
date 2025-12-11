import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';


const ListroDashboard = () => {
 const [hoveredCard, setHoveredCard] = useState(null);
 const navigate = useNavigate();


 const handlePlatformClick = (platform) => {
   if (platform === 'Amazon') {
     navigate('/login'); // Redirect to login page for Amazon
   } else {
     alert(`${platform} Listing management is coming soon!`);
   }
 };


 const styles = {
   container: {
     maxWidth: '1200px',
     margin: '0 auto',
     padding: '20px',
     minHeight: '100vh',
     display: 'flex',
     flexDirection: 'column',
     backgroundColor: '#f8f9fa',
     color: '#333',
     fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
     lineHeight: 1.6,
   },
   header: {
     display: 'flex',
     justifyContent: 'center',
     alignItems: 'center',
     padding: '20px 0',
     marginBottom: '40px',
   },
   logo: {
     fontSize: '36px',
     fontWeight: '700',
     color: '#2563eb',
     letterSpacing: '-0.5px',
     textAlign: 'center',
   },
   logoDot: {
     color: '#f59e0b',
   },
   dashboardTitle: {
     fontSize: '32px',
     fontWeight: '700',
     color: '#1f2937',
     marginBottom: '10px',
     textAlign: 'center',
   },
   dashboardSubtitle: {
     color: '#6b7280',
     textAlign: 'center',
     marginBottom: '50px',
     fontSize: '18px',
   },
   platformGrid: {
     display: 'grid',
     gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
     gap: '30px',
     marginTop: '40px',
     marginBottom: '40px',
   },
   platformCard: {
     backgroundColor: 'white',
     borderRadius: '12px',
     padding: '40px 30px',
     textAlign: 'center',
     boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
     transition: 'all 0.3s ease',
     border: '1px solid #e5e7eb',
     cursor: 'pointer',
     display: 'flex',
     flexDirection: 'column',
     alignItems: 'center',
     justifyContent: 'center',
     height: '280px',
   },
   platformCardHover: {
     transform: 'translateY(-5px)',
     boxShadow: '0 10px 15px rgba(0, 0, 0, 0.1)',
     borderColor: '#2563eb',
   },
   platformIcon: (color) => ({
     width: '80px',
     height: '80px',
     borderRadius: '50%',
     display: 'flex',
     alignItems: 'center',
     justifyContent: 'center',
     marginBottom: '25px',
     fontSize: '34px',
     color: 'white',
     background: color,
   }),
   platformName: {
     fontSize: '28px',
     fontWeight: '700',
     marginBottom: '10px',
     color: '#1f2937',
   },
   platformDescription: {
     color: '#6b7280',
     fontSize: '16px',
     maxWidth: '250px',
   },
   footer: {
     textAlign: 'center',
     marginTop: 'auto',
     paddingTop: '30px',
     borderTop: '1px solid #eaeaea',
     color: '#9ca3af',
     fontSize: '14px',
   },
 };


 const platformData = [
   {
     id: 'amazon',
     name: 'Amazon Listing',
     icon: 'A',
     description: 'Optimize your Amazon product listings with advanced tools',
     color: 'linear-gradient(135deg, #ff9900, #ff6b00)'
   },
   {
     id: 'flipkart',
     name: 'Flipkart Listing',
     icon: 'F',
     description: 'Enhance visibility and sales on Flipkart marketplace',
     color: 'linear-gradient(135deg, #047bd5, #1a6cb9)'
   },
   {
     id: 'meesho',
     name: 'Meesho Listing',
     icon: 'M',
     description: 'Manage and grow your Meesho store with powerful tools',
     color: 'linear-gradient(135deg, #f43397, #d82d7e)'
   }
 ];


 return (
   <div style={styles.container}>
     <header style={styles.header}>
       <div style={styles.logo}>
         LISTRO<span style={styles.logoDot}>.</span>
       </div>
     </header>
    
     <main>
       <h1 style={styles.dashboardTitle}>Select Listing Platform</h1>
       <p style={styles.dashboardSubtitle}>
         Choose a platform to manage and optimize your product listings
       </p>
      
       <div style={styles.platformGrid}>
         {platformData.map((platform) => (
           <div
             key={platform.id}
             style={{
               ...styles.platformCard,
               ...(hoveredCard === platform.id ? styles.platformCardHover : {})
             }}
             onClick={() => handlePlatformClick(platform.name.split(' ')[0])}
             onMouseEnter={() => setHoveredCard(platform.id)}
             onMouseLeave={() => setHoveredCard(null)}
           >
             <div style={styles.platformIcon(platform.color)}>
               {platform.icon}
             </div>
             <h2 style={styles.platformName}>{platform.name}</h2>
             <p style={styles.platformDescription}>{platform.description}</p>
           </div>
         ))}
       </div>
     </main>
    
     <footer style={styles.footer}>
       <p>© 2025 Listro. All rights reserved.</p>
     </footer>
   </div>
 );
};


export default ListroDashboard;

