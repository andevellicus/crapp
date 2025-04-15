// src/components/layout/Header.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      const dropdown = document.querySelector('.user-dropdown');
      const trigger = document.querySelector('.user-menu-trigger');
      
      if (dropdown && trigger && 
          !dropdown.contains(event.target) && 
          !trigger.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  return (
    <header>
      <div className="header-main">
        <h1>CRAPP</h1>
        <h2>Cognitive Reporting Application</h2>
      </div>
      
      <nav className="main-nav">
        <div className="nav-links">
          <Link to="/">Home</Link>
          {isAuthenticated && user && user.is_admin && (
            <Link to="/admin/users">Manage Users</Link>
          )}
        </div>
        
        <div className="auth-nav">
          {isAuthenticated && user ? (
            <div className="user-menu">
              <div className="user-menu-trigger" onClick={toggleDropdown}>
                <span>{user.first_name || user.email}</span>
                <span className="dropdown-arrow">▼</span>
              </div>
              <div className={`user-dropdown ${dropdownOpen ? 'show' : ''}`}>
                <Link to="/profile">Profile</Link>
                <Link to="/devices">My Devices</Link>
                {user.is_admin && (
                  <Link to="/admin/users">Admin Dashboard</Link>
                )}
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  logout();
                }} className="logout-button">Logout</a>
              </div>
            </div>
          ) : (
            <div className="guest-nav">
              <Link to="/login" className="nav-button">Login</Link>
              <Link to="/register" className="nav-button highlight">Register</Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;