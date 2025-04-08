// src/components/common/LoadingSpinner.jsx
const LoadingSpinner = ({ message = 'Loading...' }) => {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>{message}</p>
      </div>
    );
  };
  
  export default LoadingSpinner;