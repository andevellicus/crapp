// static/js/react/components/Router.jsx
function Router({ setTitle }) {
  // Get the current path
  const path = window.location.pathname;
  
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