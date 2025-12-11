// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

const ProtectedRoute = ({ element: Element, allowedRoles = [] }) => {
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(null); // null = loading
  
  useEffect(() => {
    const checkAuthorization = () => {
      const user = JSON.parse(localStorage.getItem("user") || '{}');
      
      if (!user || !user.email) {
        setIsAuthorized(false);
        return;
      }
      
      // SPECIAL CASE: test101@gmail.com should always have access to seller-allocation
      if (user.email === 'test101@gmail.com' && location.pathname === '/seller-allocation') {
        setIsAuthorized(true);
        return;
      }
      
      // For other routes, check if roles are specified
      if (allowedRoles && allowedRoles.length > 0) {
        if (!user.role || !allowedRoles.includes(user.role)) {
          setIsAuthorized(false);
          return;
        }
      }
      
      setIsAuthorized(true);
    };
    
    checkAuthorization();
  }, [location.pathname, allowedRoles]);
  
  // Show loading state while checking
  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Checking authorization...</p>
        </div>
      </div>
    );
  }
  
  // Not authorized - redirect to login
  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }
  
  // Render the element
  if (typeof Element === "function") {
    return <Element />;
  }
  return <Element />;
};

export default ProtectedRoute;