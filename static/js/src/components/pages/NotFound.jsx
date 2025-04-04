export default function NotFound() {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <a href="/" className="submit-button" style={{ display: 'inline-block', marginTop: '20px' }}>
          Return to Home
        </a>
      </div>
    );
  }