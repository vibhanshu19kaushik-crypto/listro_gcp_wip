import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

// --- Global Components ---
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';

// --- Pages ---
import LoginPage from './pages/LoginPage';
import DataSelectionPage from './pages/DataSelectionPage';
import ComparisonSetupPage from './pages/ComparisonSetupPage';
import FinalPage from './pages/FinalPage';
import ProductComparatorPage from './pages/ProductComparatorPage';
import ImageComparisonPage from './pages/ImageComparisonPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ListroDashboard from './pages/ListroDashboard';
import SellerAllocationPage from './pages/SellerAllocationPage';

// --- Styles ---
import './App.css';

// Google Client ID
const CLIENT_ID = "507142910829-kj72j2imtd4tiuu2rae4cep6nr11acof.apps.googleusercontent.com";

const AppContent = () => {
  const location = useLocation();
  const hideNavbar = ['/login', '/', '/change-password'].includes(location.pathname);
  
  const updateSellerId = (id) => {
    localStorage.setItem('sellerId', id);
    // Dispatch custom event for Navbar to listen
    window.dispatchEvent(new CustomEvent('sellerIdUpdated', { detail: id }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ScrollToTop />
      {!hideNavbar && <Navbar />}
      <Routes>
          {/* Public Routes */}
          <Route path="/" element={<ListroDashboard />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Protected Routes */}
          <Route 
            path="/data-selection" 
            element={<ProtectedRoute element={() => <DataSelectionPage updateSellerId={updateSellerId} />} />} 
          />
          <Route 
            path="/seller-list" 
            element={<ProtectedRoute element={() => <DataSelectionPage updateSellerId={updateSellerId} />} />} 
          />
          
          <Route 
             path="/setup/:sellerId" 
             element={<ProtectedRoute element={ComparisonSetupPage} />} 
          />
          
          <Route 
            path="/edit-product/:productId" 
            element={<ProtectedRoute element={ProductComparatorPage} />} 
          />

          <Route 
            path="/new-product" 
            element={<ProtectedRoute element={NewProductCreationPage} />} 
          />

          <Route 
            path="/compare-images" 
            element={<ProtectedRoute element={ImageComparisonPage} />} 
          />
          
          <Route 
            path="/final" 
            element={<ProtectedRoute element={FinalPage} />} 
          />

          <Route 
            path="/final-page" 
            element={<ProtectedRoute element={FinalPage} />} 
          />

          {/* Admin/Manager Routes */}
          <Route 
            path="/seller-allocation" 
            element={<ProtectedRoute element={SellerAllocationPage} allowedRoles={['admin', 'manager', 'lead']} />} 
          />

          {/* Catch-all */}
          <Route path="*" element={<ListroDashboard />} />
        </Routes>
    </div>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <Router>
        <AppContent />
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;