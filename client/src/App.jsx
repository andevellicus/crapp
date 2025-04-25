import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

// Context providers
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Layout components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Message from './components/layout/Message';
import ProtectedRouteLayout from './components/layout/ProtectedRouteLayout';
import AdminRouteLayout from './components/layout/AdminRouteLayout'; 

// Page components
import Form from './components/pages/Form';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import Profile from './components/pages/Profile';
import AdminUsers from './components/admin/AdminUsers';
import AdminUserCharts from './components/admin/AdminUserCharts';
import NotFound from './components/pages/NotFound';

// Import styles 
import './styles/index.css';

const App = () => {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <div className="app">
              <div className="container">
                <Header />
                <Message />
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Protected routes */}
                  <Route element={<ProtectedRouteLayout />}>
                    <Route path="/" element={<Form />} />
                    <Route path="/profile" element={<Profile />} />
                  </Route>

                  {/* Admin routes */}
                  <Route element={<AdminRouteLayout />}>
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/charts" element={<AdminUserCharts />} />
                  </Route>

                  {/* Catch-all route */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Footer />
              </div>
            </div>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
};

export default App;