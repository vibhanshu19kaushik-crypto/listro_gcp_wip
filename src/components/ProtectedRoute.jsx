// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

/**
 * ProtectedRoute
 * - element: component (not JSX) to render when allowed
 * - allowedRoles: array of role strings; if empty, any logged-in user allowed
 *
 * Behavior:
 * - If no user in localStorage -> redirect to /login
 * - If user exists but role is not in allowedRoles -> redirect to landing page (/)
 * - Otherwise render the component
 */
const ProtectedRoute = ({ element: Component, allowedRoles = [] }) => {
  const raw = localStorage.getItem("user");
  if (!raw) return <Navigate to="/login" replace />;

  try {
    const user = JSON.parse(raw);
    if (!user || !user.email) {
      localStorage.removeItem("user");
      return <Navigate to="/login" replace />;
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      // not authorized for this route -> landing page (or customize)
      return <Navigate to="/" replace />;
    }

    return <Component />;
  } catch (e) {
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
};

export default ProtectedRoute;