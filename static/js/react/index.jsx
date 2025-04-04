  try {
    const rootElement = document.getElementById('react-root');
    if (rootElement) {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        throw new Error('React or ReactDOM is not loaded');
      }
      console.log("Attempting to render App...");
      const root = ReactDOM.createRoot(rootElement);
      root.render(<App />);
      console.log("App rendered successfully with React 18 createRoot");
    }
  } catch (error) {
    console.error("Failed to render App:", error);
    document.getElementById('react-root').innerHTML = `
      <div style="color: red; border: 1px solid red; padding: 20px; margin: 20px;">
        <h3>React Error:</h3>
        <p>${error.message}</p>
        <p>Check console for more details.</p>
      </div>
    `;
  }