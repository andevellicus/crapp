// Main App component that wraps everything with providers
function App() {
    return (
      <AuthProvider>
        <NotificationProvider>
          <Router />
        </NotificationProvider>
      </AuthProvider>
    );
  }