import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Package, LogOut, HelpCircle, Info, Home, Users, Settings } from 'lucide-react';


const Navbar = () => {
 const location = useLocation();
 const navigate = useNavigate();
 const [sellerId, setSellerId] = useState('');
 const [user, setUser] = useState(null);
  // Listen for sellerId updates from localStorage and custom events
 useEffect(() => {
   // Initial load from localStorage
   const storedSellerId = localStorage.getItem('sellerId');
   if (storedSellerId) {
     setSellerId(storedSellerId);
   }


   // Load user info
   const userData = localStorage.getItem('user');
   if (userData) {
     try {
       setUser(JSON.parse(userData));
     } catch (e) {
       console.error('Error parsing user data:', e);
     }
   }


   // Listen for custom sellerId update events
   const handleSellerIdUpdate = (event) => {
     setSellerId(event.detail);
   };


   // Listen for storage changes (from other tabs/windows)
   const handleStorageChange = (e) => {
     if (e.key === 'sellerId') {
       setSellerId(e.newValue || '');
     }
     if (e.key === 'user') {
       try {
         setUser(e.newValue ? JSON.parse(e.newValue) : null);
       } catch (error) {
         console.error('Error parsing user data:', error);
       }
     }
   };


   window.addEventListener('sellerIdUpdated', handleSellerIdUpdate);
   window.addEventListener('storage', handleStorageChange);


   return () => {
     window.removeEventListener('sellerIdUpdated', handleSellerIdUpdate);
     window.removeEventListener('storage', handleStorageChange);
   };
 }, []);
  // Show seller ID on pages that have it in the URL
 const showSellerId = true;
 const showSellerInfo = location.pathname !== '/seller-list';


 // Check if user should see Seller Allocation link
 const shouldShowSellerAllocation = user?.email === 'test101@gmail.com' ||
                                    user?.role === 'admin' ||
                                    user?.role === 'manager';


 const handleLogout = () => {
   localStorage.clear();
   navigate('/');
 };


 const handleHomeClick = () => {
   navigate('/seller-list');
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
         {/* Logo and Navigation Links */}
         <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-2 cursor-pointer" onClick={handleHomeClick}>
             <Package className="h-6 w-6 text-orange-400" />
             <h1 className="text-lg font-bold text-white hover:text-orange-400 transition-colors">
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
            
             {/* Seller List Link */}
             <button
               onClick={handleHomeClick}
               className={`flex items-center space-x-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                 location.pathname === '/seller-list'
                   ? 'bg-orange-500 text-white'
                   : 'text-gray-300 hover:text-white hover:bg-gray-800'
               }`}
             >
               <Home className="h-4 w-4" />
               <span>Seller List</span>
             </button>
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
               <div className="flex items-center space-x-2">
                 <span className="text-xs font-medium text-gray-400">Email:</span>
                 <span className="text-xs text-white font-medium">
                   {user?.email || 'Guest'}
                 </span>
               </div>
               <div className="h-6 w-px bg-gray-600"></div>
              
               {/* User Role */}
               <div className="flex items-center space-x-2">
                 <span className="text-xs font-medium text-gray-400">Role:</span>
                 <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleBadgeColor(user?.role)}`}>
                   {getRoleDisplayName(user?.role)}
                 </span>
               </div>
              
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
             // Add help functionality
             alert('Help documentation coming soon!');
           }}
         >
           <HelpCircle className="h-4 w-4" />
           <span>Help</span>
         </button>
         <button
           className="flex items-center space-x-1 px-3 py-1.5 text-gray-300 hover:text-white text-sm rounded hover:bg-gray-800 transition-colors"
           onClick={() => {
             // Add about functionality
             alert('Listro - Amazon Listing Optimization Tool\nVersion 2.0');
           }}
         >
           <Info className="h-4 w-4" />
           <span>About</span>
         </button>
         <button
           onClick={handleLogout}
           className="flex items-center space-x-1 px-3 py-1.5 hover:text-white text-sm rounded hover:bg-red-600 transition-colors border border-gray-700 bg-gray-800"
         >
           <LogOut className="h-4 w-4" />
           <span>Logout</span>
         </button>
       </div>
     </div>


     {/* Mobile Navigation (Optional) */}
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
        
         <button
           onClick={handleHomeClick}
           className={`flex-shrink-0 px-2 py-1 rounded text-xs ${
             location.pathname === '/seller-list'
               ? 'bg-orange-500 text-white'
               : 'text-gray-300 hover:text-white hover:bg-gray-800'
           }`}
         >
           <div className="flex items-center space-x-1">
             <Home className="h-3 w-3" />
             <span>Seller List</span>
           </div>
         </button>
       </div>
     </div>
   </nav>
 );
};


export default Navbar;

