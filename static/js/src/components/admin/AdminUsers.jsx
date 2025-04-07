// src/components/admin/AdminUsers.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch users based on search query and pagination
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const skip = (pagination.page - 1) * pagination.limit;
      let url = `/admin/api/users/search?skip=${skip}&limit=${pagination.limit}`;
      
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }

      const data = await api.get(url);
      
      setUsers(data.users);
      setPagination(prev => ({
        ...prev,
        total: data.total
      }));
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchUsers();
  }, [pagination.page]); // Fetch when page changes

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    // Reset to first page when searching
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
    fetchUsers();
  };

  // Handle search input change
  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle pagination
  const goToNextPage = () => {
    if (pagination.page < Math.ceil(pagination.total / pagination.limit)) {
      setPagination(prev => ({
        ...prev,
        page: prev.page + 1
      }));
    }
  };

  const goToPrevPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({
        ...prev,
        page: prev.page - 1
      }));
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Send reminder
  const sendReminder = async (userEmail, method) => {
    try {
      setSuccessMessage('');
      await api.post('/admin/api/send-reminder', {
        email: userEmail,
        method: method // 'email' or 'push'
      });
      
      setSuccessMessage(`${method.charAt(0).toUpperCase() + method.slice(1)} reminder sent to ${userEmail}`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (err) {
      console.error(`Error sending ${method} reminder:`, err);
      setError(`Failed to send ${method} reminder: ${err.message}`);
      
      // Clear error message after 5 seconds
      setTimeout(() => {
        setError('');
      }, 5000);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h2>User Management</h2>
      </div>
      
      {successMessage && (
        <div className="message success" style={{ display: 'block' }}>
          {successMessage}
        </div>
      )}
      
      {error && (
        <div className="message error" style={{ display: 'block' }}>
          {error}
        </div>
      )}
      
      <div className="search-container">
        <form onSubmit={handleSearch}>
          <input 
            type="text" 
            id="search-input" 
            placeholder="Search users by email or name..." 
            value={searchQuery}
            onChange={handleSearchInputChange}
          />
          <button type="submit" id="search-button">Search</button>
        </form>
      </div>

      {loading ? (
        <div id="loading" className="loading">
          <div className="spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div id="no-results" className="no-results" style={{ display: 'block' }}>
          <p>No users found matching your search.</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Created</th>
                <th>Last Login</th>
                <th>Last Assessment</th>
                <th>Actions</th>
                <th>Reminders</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              {users.map(user => (
                <tr key={user.email}>
                  <td>{user.email}</td>
                  <td>{`${user.first_name || ''} ${user.last_name || ''}`.trim() || '-'}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>{formatDate(user.last_login)}</td>
                  <td>{formatDate(user.last_assessment)}</td>
                  <td>
                    <Link 
                      to={`/admin/charts?user_id=${encodeURIComponent(user.email)}`} 
                      className="action-button"
                    >
                      View Data
                    </Link>
                  </td>
                  <td>
                    <button 
                      className="action-button"
                      onClick={() => sendReminder(user.email, 'email')}
                      style={{ marginRight: '5px' }}
                    >
                      Email
                    </button>
                    <button 
                      className="action-button"
                      onClick={() => sendReminder(user.email, 'push')}
                    >
                      Push
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <button 
          id="prev-page" 
          className="pagination-button" 
          onClick={goToPrevPage}
          disabled={pagination.page <= 1}
        >
          Previous
        </button>
        <span id="page-info">
          Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit) || 1}
        </span>
        <button 
          id="next-page" 
          className="pagination-button" 
          onClick={goToNextPage}
          disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminUsers;