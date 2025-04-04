// static/js/react/index.jsx
document.addEventListener('DOMContentLoaded', function() {
  try {
    const rootElement = document.getElementById('react-root');
    
    if (rootElement) {
      // Check if React and ReactDOM are available
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        throw new Error('React or ReactDOM is not loaded');
      }

      console.log("Attempting to render App...");
      
      // Try legacy render method first
      ReactDOM.render(<App />, rootElement);
      console.log("App rendered successfully with legacy method");
    }
  } catch (error) {
    console.error("Failed to render App:", error);
    
    // Show error on page
    document.getElementById('react-root').innerHTML = `
      <div style="color: red; border: 1px solid red; padding: 20px; margin: 20px;">
        <h3>React Error:</h3>
        <p>${error.message}</p>
        <p>Check console for more details.</p>
      </div>
    `;
  }
});