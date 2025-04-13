export default function Head(props) {
    // TODO his is a placeholder - in a production app, you'd use React Helmet 
    // or handle document.head updates in useEffect
    React.useEffect(() => {
      document.title = props.title || "CRAPP: Cognitive Reporting Application";
    }, [props.title]);
    
    return null; // This component doesn't render anything visible
  }