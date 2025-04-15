// src/components/layout/Message.jsx
import React, { useState, useEffect } from 'react';

export default function Message() {
  const [message, setMessage] = useState(null);
  const [type, setType] = useState('success');
  
  // Create a global method to show messages
  useEffect(() => {
    window.showMessage = (text, messageType = 'success') => {
      setMessage(text);
      setType(messageType);
      
      // Auto-hide success messages
      if (messageType === 'success') {
        setTimeout(() => {
          setMessage(null);
        }, 5000);
      }
    };
    
    return () => {
      window.showMessage = null;
    };
  }, []);
  
  if (!message) return null;
  
  return (
    <div className={`message ${type} show`}>
      {message}
    </div>
  );
}