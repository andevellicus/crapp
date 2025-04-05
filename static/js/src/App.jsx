// static/js/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Context providers
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

// Layout components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Message from './components/layout/Message';

// Page components
import Form from './components/pages/Form';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Profile from './components/pages/Profile';
import Devices from './components/pages/Devices';
import CognitiveTests from './components/pages/CognitiveTests';
import NotFound from './components/pages/NotFound';

const App = () => {
  return (
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
                <Route path="/" element={
                  <ProtectedRoute>
                    <Form />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/devices" element={
                  <ProtectedRoute>
                    <Devices />
                  </ProtectedRoute>
                } />
                <Route path="/cognitive-tests" element={
                  <ProtectedRoute>
                    <CognitiveTests />
                  </ProtectedRoute>
                } />
                
                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Footer />
            </div>
          </div>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;