// src/App.jsx
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import DataSelectionPage from './pages/DataSelectionPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ComparisonSetupPage from './pages/ComparisonSetupPage';
import FinalPage from './pages/FinalPage';
import NewProductCreationPage from './pages/NewProductCreationPage';
import ImageComparisonPage from './pages/ImageComparisonPage';
import ProductComparator from './pages/ProductComparatorPage';
import SellerAllocationPage from './pages/SellerAllocationPage';
import { GoogleOAuthProvider } from '@react-oauth/google';
import ProtectedRoute from './components/ProtectedRoute';
import ListroDashboard from './pages/ListroDashboard';

function AppContent() {
  const location = useLocation();
  
  // Hide navbar on dashboard, login, and change-password pages
  const hideNavbar = location.pathname === '/' || 
                     location.pathname === '/login' || 
                     location.pathname === '/change-password';

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
        {/* ==================== PUBLIC ROUTES ==================== */}
        
        {/* Landing/Dashboard Page */}
        <Route path="/" element={<ListroDashboard />} />
        
        {/* Login Page */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Change Password Page */}
        <Route path="/change-password" element={<ChangePasswordPage />} />
        
        {/* ==================== PROTECTED ROUTES ==================== */}
        
        {/* Seller Allocation - Special access for test101@gmail.com and admins/managers */}
        <Route 
          path="/seller-allocation" 
          element={
            <ProtectedRoute 
              element={SellerAllocationPage}
              allowedRoles={['admin', 'manager']} 
            />
          } 
        />
        
        {/* Main Seller List/Data Selection */}
        <Route 
          path="/seller-list" 
          element={
            <ProtectedRoute 
              element={() => <DataSelectionPage updateSellerId={updateSellerId} />}
            />
          } 
        />
        
        {/* Product Management Routes */}
        <Route 
          path="/setup/:sellerId" 
          element={
            <ProtectedRoute element={ComparisonSetupPage} />
          } 
        />
        
        <Route 
          path="/edit-product/:productId" 
          element={
            <ProtectedRoute element={ProductComparator} />
          } 
        />
        
        <Route 
          path="/new-product" 
          element={
            <ProtectedRoute element={NewProductCreationPage} />
          } 
        />
        
        {/* Image and Final Review Routes */}
        <Route 
          path="/compare-images" 
          element={
            <ProtectedRoute element={ImageComparisonPage} />
          } 
        /> 
        
        <Route 
          path="/final-page" 
          element={
            <ProtectedRoute element={FinalPage} />
          } 
        />
        
        {/* ==================== FALLBACK ROUTES ==================== */}
        
        {/* Redirect any unknown routes to dashboard */}
        <Route path="*" element={<ListroDashboard />} />
      </Routes>
    </div>
  );
}

function App() {
  const CLIENT_ID = "507142910829-kj72j2imtd4tiuu2rae4cep6nr11acof.apps.googleusercontent.com";

  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <Router>
        <AppContent />
      </Router>
    </GoogleOAuthProvider>
  );
}

export default App;