// static/js/react/components/Header.jsx
export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  
  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };
  
  // Close dropdown when clicking outside
  React.useEffect(() => {
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
          <a href="/">Home</a>
          {isAuthenticated && user && user.is_admin && (
            <a href="/admin/users">Manage Users</a>
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
                <a href="/profile">Profile</a>
                <a href="/devices">My Devices</a>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  logout();
                }} className="logout-button">Logout</a>
              </div>
            </div>
          ) : (
            <div className="guest-nav">
              <a href="/login" className="nav-button">Login</a>
              <a href="/register" className="nav-button highlight">Register</a>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}