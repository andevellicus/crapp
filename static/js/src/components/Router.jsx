// static/js/react/components/Router.jsx
export default function Router({ setTitle }) {
  // Get the current path
  const path = window.location.pathname;

  const { isAuthenticated } = React.useContext(AuthContext);
  
  // Set page title based on the route
  React.useEffect(() => {
    // Load the CPT CSS if on cognitive tests page
    if (path === '/cognitive-tests') {
      if (!document.getElementById('cpt-styles')) {
        const link = document.createElement('link');
        link.id = 'cpt-styles';
        link.rel = 'stylesheet';
        link.href = '/static/css/cpt.css';
        document.head.appendChild(link);
      }
    }

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
      return <SymptomForm />;
    case '/login':
      return <Login />;
    case '/register':
      return <Register />;
    case '/profile':
      return <Profile />;
    case '/devices':
      return <Devices />;
    case '/cognitive-tests':
      return <CognitiveTests />;
    case '/forgot-password':
      return <ForgotPassword />;
    case '/reset-password':
      return <ResetPassword />;
    default:
      return <NotFound />;
  }
}