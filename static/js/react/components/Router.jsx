// Simple router component to handle different pages
function Router() {
    // Get the current path
    const path = window.location.pathname;
    
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