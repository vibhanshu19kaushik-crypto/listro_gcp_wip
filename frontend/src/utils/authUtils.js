import { CREATIVE_FRONTEND_URL } from "../api/config";

/**
 * Reset local storage on logout/mount
 */
export const clearAuthSession = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("selectedAsins");
  localStorage.removeItem("actionType");
  localStorage.removeItem("existingProduct");
  localStorage.removeItem("goldStandardProduct");
  localStorage.removeItem("productFilters");
  
  // Trigger navbar update
  window.dispatchEvent(new Event("userUpdated"));
};

/**
 * Generate background particles
 */
export const generateParticles = (count = 25) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 70 + 30,
    left: Math.random() * 100,
    top: Math.random() * 100,
    opacity: Math.random() * 0.08 + 0.02,
    duration: Math.random() * 30 + 20,
    delay: Math.random() * 5,
    color: "rgba(255, 255, 255, 0.1)",
  }));
};

/**
 * Handle Creative Mode Redirection
 */
export const redirectToCreativeDashboard = (email) => {
  window.location.href = `${CREATIVE_FRONTEND_URL}/dashboard?email=${encodeURIComponent(email)}`;
};
