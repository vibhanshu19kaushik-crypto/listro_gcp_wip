import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/apiService';
import { redirectToCreativeDashboard } from '../utils/authUtils';

export const useAuth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = useCallback(async ({ email, password, role, isCreative }) => {
    setError("");
    setIsLoading(true);

    try {
      // 1. Creative Mode Flow
      if (isCreative) {
        // Special Case: Creative login via proxy
        const data = await api.auth.creativeLoginProxy({ email, password });
        if (data.success) {
          redirectToCreativeDashboard(data.email || email);
          return;
        }
        throw new Error(data.error || "Invalid Imagen credentials");
      }

      // 2. Lead/Admin Flow
      if (role === "lead") {
        const data = await api.auth.leadLogin({ email, password });
        if (data.success) {
          localStorage.setItem("user", JSON.stringify({ email, role: "lead", timestamp: new Date().toISOString() }));
          window.dispatchEvent(new Event("userUpdated"));
          navigate("/seller-allocation", { replace: true });
          return;
        }
        throw new Error(data.error || "Invalid credentials");
      }

      // 3. KAM / Standard Flow (Bypass test accounts)
      if (email === "admin@listro.com" && password === "admin123") {
        localStorage.setItem("user", JSON.stringify({ email, role: "admin", timestamp: new Date().toISOString() }));
        window.dispatchEvent(new Event("userUpdated"));
        navigate("/seller-list");
        return;
      }

      const data = await api.auth.login({ email, password });
      if (data.success) {
        const user = {
          email,
          role: data.role || "user",
          timestamp: new Date().toISOString()
        };
        
        if (data.first_time || data.is_temp_password) {
          user.needsPasswordChange = true;
          localStorage.setItem("user", JSON.stringify(user));
          window.dispatchEvent(new Event("userUpdated"));
          navigate(`/change-password?email=${encodeURIComponent(email)}`);
          return;
        }

        localStorage.setItem("user", JSON.stringify(user));
        window.dispatchEvent(new Event("userUpdated"));
        navigate("/seller-list");
      } else {
        throw new Error(data.error || "Invalid credentials");
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  return { isLoading, error, handleLogin, setError };
};
