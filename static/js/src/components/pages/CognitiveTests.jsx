import { useAuth } from '../../context/AuthContext';

export default function CognitiveTests() {
    const [testResults, setTestResults] = React.useState(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState('');
    const [success, setSuccess] = React.useState('');
    
    const { user, deviceId } = useAuth();
    
    // Handle test completion and submission
    const handleTestEnd = async (results) => {
      setTestResults(results);
      
      // Don't auto-submit if results are already set (prevents double submission)
      if (isSubmitting || testResults) {
        return;
      }
      
      await submitTestResults(results);
    };
    
    // Submit test results to the server
    const submitTestResults = async (results) => {
      if (!results) return;
      
      setIsSubmitting(true);
      setError('');
      
      try {
        // Prepare submission data
        const submissionData = {
          user_email: user.email,
          device_id: deviceId || 'unknown',
          test_start_time: new Date(results.testStartTime).toISOString(),
          test_end_time: new Date(results.testEndTime).toISOString(),
          correct_detections: results.correctDetections,
          commission_errors: results.commissionErrors,
          omission_errors: results.omissionErrors,
          average_reaction_time: results.averageReactionTime,
          reaction_time_sd: results.reactionTimeSD,
          detection_rate: results.detectionRate,
          omission_error_rate: results.omissionErrorRate,
          commission_error_rate: results.commissionErrorRate,
          raw_data: JSON.stringify(results)
        };
        
        // Submit to API
        const response = await fetch('/api/cognitive-tests/cpt/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'X-Device-ID': deviceId || ''
          },
          body: JSON.stringify(submissionData)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to submit test results');
        }
        
        setSuccess('Test results saved successfully!');
        
        // Clear success message after a delay
        setTimeout(() => {
          setSuccess('');
        }, 5000);
        
      } catch (err) {
        console.error('Error submitting test results:', err);
        setError(err.message || 'Failed to submit test results');
        
        // Clear error message after a delay
        setTimeout(() => {
          setError('');
        }, 5000);
      } finally {
        setIsSubmitting(false);
      }
    };
    
    return (
      <div>
        <div className="page-header">
          <h2>Cognitive Testing</h2>
          <p>Complete the tests below to assess your cognitive function.</p>
        </div>
        
        {error && (
          <div className="message error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div className="message success" style={{ display: 'block' }}>
            {success}
          </div>
        )}
        
        <div className="cognitive-test-container">
          <h3>Continuous Performance Test (CPT)</h3>
          <p>This test measures your sustained attention and response control.</p>
          
          <CPTTest onTestEnd={handleTestEnd} />
        </div>
      </div>
    );
  }