// Entry point for the React application
document.addEventListener('DOMContentLoaded', function() {
    const rootElement = document.getElementById('react-root');
    
    if (rootElement) {
      const root = ReactDOM.createRoot(rootElement);
      root.render(<App />);
    }
  });