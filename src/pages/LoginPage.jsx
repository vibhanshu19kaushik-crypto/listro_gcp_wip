// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PYTHON_API_BASE_URL } from "../api/config";
import { AlertCircle, Check } from "lucide-react";

const LoginPage = () => {
  const navigate = useNavigate();

  // 🔐 Login states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 🔁 Forgot Password states
  const [showForgot, setShowForgot] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // 🌍 Backend base URL
  const BACKEND_URL = PYTHON_API_BASE_URL;

  // Check server health on component mount
  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        await fetch(`${BACKEND_URL}/api/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.warn("⚠️ Python server may not be running");
      }
    };

    checkServerHealth();
  }, [BACKEND_URL]);

  // ✅ Handle login form
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setShowForgot(false);

    // 🔄 TEMPORARY BYPASS FOR TEST ACCOUNTS
    if (email === "test101@gmail.com" && password === "1234") {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: "test101@gmail.com",
          role: "manager",
          timestamp: new Date().toISOString(),
        })
      );
      
      window.dispatchEvent(new Event('userUpdated'));
      navigate("/seller-allocation");
      setIsLoading(false);
      return;
    }

    if (email === "admin@listro.com" && password === "admin123") {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: "admin@listro.com",
          role: "admin",
          timestamp: new Date().toISOString(),
        })
      );
      
      window.dispatchEvent(new Event('userUpdated'));
      navigate("/seller-list");
      setIsLoading(false);
      return;
    }

    if (email === "test@listro.com" && password === "test@listro.com") {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      localStorage.setItem(
        "user",
        JSON.stringify({
          email: "test@listro.com",
          role: "user",
          timestamp: new Date().toISOString(),
        })
      );
      
      window.dispatchEvent(new Event('userUpdated'));
      navigate("/seller-list");
      setIsLoading(false);
      return;
    }

    // For other users, try connecting to Python server
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${BACKEND_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            email,
            role: data.role || "user",
            timestamp: new Date().toISOString(),
          })
        );
        
        window.dispatchEvent(new Event('userUpdated'));

        if (data.first_time) {
          navigate(`/change-password?email=${encodeURIComponent(email)}`);
        } else {
          navigate("/seller-list");
        }
      } else {
        setError(data.error || "Invalid email or password");
        setShowForgot(true);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Server timeout. Please check if Python server is running.");
      } else {
        setError("Cannot connect to authentication server. Please try again later.");
      }
      setShowForgot(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 📧 Forgot Password handler
  const handleResetPassword = async () => {
    setResetStatus("");

    if (!resetEmail.trim()) {
      setResetStatus("Please enter your email.");
      return;
    }

    setResetLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${BACKEND_URL}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (res.ok && data.pending_approval) {
        setResetStatus("⚠️ Please contact your admin for approval.");
      } else if (res.ok && data.success) {
        setResetStatus("✅ Reset link sent to your email!");
      } else {
        setResetStatus(data.error || "Failed to send reset link.");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setResetStatus("⚠️ Server timeout.");
      } else {
        setResetStatus("⚠️ Server error. Try again later.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-orange-600 text-3xl font-bold mb-2">Listro</div>
          <p className="text-gray-600">Sign in to continue</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-orange-600 hover:bg-orange-700 text-white shadow-md hover:shadow-lg"
            }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Signing in...</span>
              </div>
            ) : (
              "Sign In"
            )}
          </button>

          {/* Forgot Password link */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Forgot your password?
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-semibold text-gray-800 mb-3">
              Reset Password
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Enter your email and we'll send you a reset link.
            </p>

            <input
              type="email"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />

            <button
              onClick={handleResetPassword}
              disabled={resetLoading}
              className={`w-full py-3 rounded-lg font-semibold mb-3 ${
                resetLoading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-700 text-white"
              }`}
            >
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </button>

            {resetStatus && (
              <div className={`p-3 rounded flex items-start space-x-2 ${
                resetStatus.startsWith("✅")
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
              >
                {resetStatus.startsWith("✅") ? (
                  <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm">{resetStatus}</p>
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setShowModal(false);
                  setResetStatus("");
                  setResetEmail("");
                }}
                className="text-sm text-gray-600 hover:text-gray-800 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;