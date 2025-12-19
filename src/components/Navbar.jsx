// src/components/Navbar.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Package, LogOut, HelpCircle, Info, Home, Users } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sellerId, setSellerId] = useState('');
  const [user, setUser] = useState(null);
  
  // Function to load user from localStorage
  const loadUser = () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        console.log("👤 Navbar loaded user:", parsedUser.email);
        setUser(parsedUser);
      } else {
        console.log("👤 No user found in localStorage");
        setUser(null);
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
      setUser(null);
    }
  };

  // Listen for sellerId and user updates
  useEffect(() => {
    // Initial load
    const storedSellerId = localStorage.getItem('sellerId');
    if (storedSellerId) {
      setSellerId(storedSellerId);
    }

    loadUser(); // Load user on mount

    // Listen for custom sellerId update events
    const handleSellerIdUpdate = (event) => {
      console.log("📦 Seller ID updated:", event.detail);
      setSellerId(event.detail);
    };

    // Listen for user login/logout events
    const handleUserUpdate = () => {
      console.log("🔄 User data changed, reloading...");
      setTimeout(loadUser, 100); // Small delay to ensure localStorage is updated
    };

    // Listen for storage changes
    const handleStorageChange = (e) => {
      if (e.key === 'sellerId') {
        setSellerId(e.newValue || '');
      }
      if (e.key === 'user') {
        setTimeout(loadUser, 100);
      }
    };

    // Add event listeners
    window.addEventListener('sellerIdUpdated', handleSellerIdUpdate);
    window.addEventListener('userUpdated', handleUserUpdate);
    window.addEventListener('storage', handleStorageChange);

    // Cleanup
    return () => {
      window.removeEventListener('sellerIdUpdated', handleSellerIdUpdate);
      window.removeEventListener('userUpdated', handleUserUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // Don't show navbar on dashboard, login, or change-password pages
  if (location.pathname === '/' || 
      location.pathname === '/login' || 
      location.pathname === '/change-password') {
    return null;
  }

  const showSellerId = true;
  const showSellerInfo = location.pathname !== '/seller-list';

  // Check if user should see Seller Allocation link
  const shouldShowSellerAllocation = user?.email === 'test101@gmail.com' || 
                                     user?.role === 'admin' || 
                                     user?.role === 'manager';

  const handleLogout = () => {
    console.log("🚪 Logging out user:", user?.email);
    localStorage.removeItem('user');
    localStorage.removeItem('sellerId');
    setUser(null);
    setSellerId('');
    
    // Dispatch event to notify other components
    window.dispatchEvent(new Event('userLoggedOut'));
    
    navigate('/login');
  };

  const handleSellerAllocationClick = () => {
    navigate('/seller-allocation');
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-600 text-white';
      case 'manager':
        return 'bg-purple-600 text-white';
      case 'reviewer':
        return 'bg-blue-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const getRoleDisplayName = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      case 'reviewer':
        return 'Reviewer';
      case 'user':
        return 'User';
      default:
        return role || 'User';
    }
  };

  return (
    <nav className="bg-gray-900 border-b border-orange-400 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Logo - Disabled from clicking */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Package className="h-6 w-6 text-orange-400" />
              <h1 className="text-lg font-bold text-white">
                Listro
              </h1>
            </div>
            
            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              {/* Seller Allocation Link (Conditional) */}
              {shouldShowSellerAllocation && (
                <button
                  onClick={handleSellerAllocationClick}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    location.pathname === '/seller-allocation'
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-300 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Seller Allocation</span>
                </button>
              )}
            </div>
          </div>

          {/* Seller and User Info */}
          {showSellerId && (
            <>
              <div className="h-6 w-px bg-gray-600"></div>
              <div className="flex items-center space-x-4">
                
                {showSellerInfo && sellerId && (
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-400">Seller ID:</span>
                      <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-semibold">
                        {sellerId}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-gray-600"></div>
                  </>
                )}
                
                {/* User Email */}
                {user?.email && (
                  <>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-400">Email:</span>
                      <span className="text-xs text-white font-medium">
                        {user.email}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-gray-600"></div>
                  </>
                )}
                
                {/* User Role */}
                {user?.role && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-400">Role:</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                  </div>
                )}
                
                {/* Special Badge for test101@gmail.com */}
                {user?.email === 'test101@gmail.com' && (
                  <>
                    <div className="h-6 w-px bg-gray-600"></div>
                    <span className="px-2 py-1 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded text-xs font-semibold">
                      Test Account
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right side buttons */}
        <div className="flex items-center space-x-2">
          <button 
            className="flex items-center space-x-1 px-3 py-1.5 text-gray-300 hover:text-white text-sm rounded hover:bg-gray-800 transition-colors"
            onClick={() => {
              window.open('https://github.com/your-repo/docs', '_blank');
            }}
          >
            <HelpCircle className="h-4 w-4" />
            <span>Help</span>
          </button>
          <button 
            className="flex items-center space-x-1 px-3 py-1.5 text-gray-300 hover:text-white text-sm rounded hover:bg-gray-800 transition-colors"
            onClick={() => {
              alert('Listro - Amazon Listing Optimization Tool\nVersion 2.0\n© 2024 Listro Inc.');
            }}
          >
            <Info className="h-4 w-4" />
            <span>About</span>
          </button>
          {user && (
            <button 
              onClick={handleLogout} 
              className="flex items-center space-x-1 px-3 py-1.5 text-white text-sm rounded hover:bg-red-700 transition-colors bg-red-600"
              title={`Logout ${user.email}`}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden mt-2">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {shouldShowSellerAllocation && (
            <button
              onClick={handleSellerAllocationClick}
              className={`flex-shrink-0 px-2 py-1 rounded text-xs ${
                location.pathname === '/seller-allocation'
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center space-x-1">
                <Users className="h-3 w-3" />
                <span>Allocation</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;