// src/components/layout/ProtectedRouteLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import ProtectedRoute from '../auth/ProtectedRoute';

const ProtectedRouteLayout = () => {
  return (
    <ProtectedRoute>
      {/* Outlet renders the matched child route component */}
      <Outlet />
    </ProtectedRoute>
  );
};

export default ProtectedRouteLayout;