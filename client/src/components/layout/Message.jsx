export default function Message() {
    const [message, setMessage] = React.useState(null);
    const [type, setType] = React.useState('success');
    
    // Create a global method to show messages
    React.useEffect(() => {
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
      <div className={`message ${type}`} style={{display: 'block'}}>
        {message}
      </div>
    );
  }