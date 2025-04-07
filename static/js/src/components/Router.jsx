// static/js/react/components/Router.jsx
export default function Router({ setTitle }) {
  // Get the current path
  const path = window.location.pathname;

  const { isAuthenticated } = React.useContext(AuthContext);
  
  // Set page title based on the route
  React.useEffect(() => {
    switch (path) {
      case '/login':
        setTitle("Login - CRAPP");
        break;
      case '/register':
        setTitle("Register - CRAPP");
        break;
      case '/profile':
        setTitle("Profile - CRAPP");
        break;
      // Add more routes as needed
      default:
        setTitle("CRAPP: Cognitive Reporting Application");
    }
  }, [path, setTitle]);

  // If not authenticated, force the login page for protected routes
  if (!isAuthenticated && 
    !['/login', '/register', '/forgot-password', '/reset-password'].includes(path)) {
  return <Login />;
}
  
  // Render different components based on path
  switch (path) {
    case '/':
      return <Form />;
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    case '/profile':
      return <Profile />;
    case '/devices':
      return <Devices />;
    case '/forgot-password':
      return <ForgotPassword />;
    case '/reset-password':
      return <ResetPassword />;
    default:
      return <NotFound />;
  }
}