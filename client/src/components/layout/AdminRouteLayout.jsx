// src/components/layout/AdminRouteLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import AdminRoute from '../admin/AdminRoute';

const AdminRouteLayout = () => {
  return (
    <AdminRoute>
      {/* Outlet renders the matched child route component */}
      <Outlet />
    </AdminRoute>
  );
};

export default AdminRouteLayout;