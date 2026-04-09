import React from 'react';

const AmazonIcon = () => (
  <svg width="24" height="24" viewBox="0 0 448 512" fill="currentColor">
    <path d="M257.2 162.7c-48.7 1.8-169.5 15.5-169.5 117.5 0 109.5 138.3 114 183.5 43.2 6.5 10.2 35.4 37.5 45.3 46.8l56.8-56S341 288.9 341 261.4V114.3C341 89 316.5 32 228.7 32 140.7 32 94 87 94 136.3l73.5 6.8c16.3-49.5 54.2-49.5 54.2-49.5 40.7-.1 35.5 29.8 35.5 69.1zm0 86.8c0 80-84.2 68-84.2 17.2 0-47.2 50.5-56.7 84.2-57.8v40.6zm136 163.5c-7.7 10-70 67-174.5 67S34.2 408.5 9.7 379c-6.8-7.7 1-11.3 5.5-8.3C88.5 415.2 203 488.5 387.7 401c7.5-3.7 13.3 2 5.5 12zm39.8 2.2c-6.5 15.8-16 26.8-21.2 31-5.5 4.5-9.5 2.7-6.5-3.8s19.3-46.5 12.7-55c-6.5-8.3-37-4.3-48-3.2-10.8 1-13 2-14-.3-2.3-5.7 21.7-15.5 37.5-17.5 15.7-1.8 41-.8 46 5.7 3.7 5.1 0 27.1-6.5 43.1z"/>
  </svg>
);

const AuthHeader = ({ isCreative }) => {
  return (
    <div className="logo-container" style={{ marginBottom: '40px', animation: 'fadeInUp 0.8s ease forwards' }}>
      {isCreative ? (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px' }}>
          <h1 style={{ 
            fontSize: '4.5rem', fontWeight: 900, letterSpacing: '3px', marginBottom: '15px',
            background: 'linear-gradient(135deg, #FFFFFF, #E2E8F0)', WebkitBackgroundClip: 'text', color: 'transparent'
          }}>LISTRO</h1>
          <h2 style={{ 
            fontSize: '2rem', fontWeight: 700, letterSpacing: '1px', paddingBottom: '8px',
            background: 'linear-gradient(135deg, #FFFFFF, #E2E8F0)', WebkitBackgroundClip: 'text', color: 'transparent'
          }}>IMAGEN</h2>
        </div>
      ) : (
        <h1 style={{
          fontSize: '3.8rem', fontWeight: 800, letterSpacing: '2px', marginBottom: '10px',
          background: 'linear-gradient(90deg, #fff, #a8c0ff, #fff)', WebkitBackgroundClip: 'text', color: 'transparent',
          textShadow: '0 0 15px rgba(168, 192, 255, 0.3)', animation: 'logoGlow 3s ease-in-out infinite alternate'
        }}>LISTRO</h1>
      )}
      <div style={{ fontSize: '1.2rem', color: '#b8c1ec', fontWeight: 500, letterSpacing: '1px' }}>
        {isCreative ? "Listro-Powered Image Creation" : "Advanced E-commerce Management Solutions"}
      </div>
   
      {!isCreative && (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
        margin: '25px auto 40px', padding: '12px 20px', background: 'rgba(255, 153, 0, 0.1)',
        border: '1px solid rgba(255, 153, 0, 0.3)', borderRadius: '12px', width: 'fit-content'
      }}>
        <div style={{ color: '#ff9900' }}><AmazonIcon /></div>
        <div style={{ color: '#ff9900', fontSize: '1rem', fontWeight: 600 }}>Now with Amazon Integration!</div>
      </div>
      )}
    </div>
  );
};

export default AuthHeader;
