import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import CPTTest from '../cpt/CPTTest';


export default function Form() {
  const [stateId, setStateId] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [previousAnswer, setPreviousAnswer] = useState(null);
  const [formAnswers, setFormAnswers] = useState({});
  const [formData, setFormData] = useState({
      answers: {},
      interactionData: null,
      cptResults: null
  });
  const [cptResults, setCptResults] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDoingCognitiveTest, setIsDoingCognitiveTest] = useState(false);
  
  const { isAuthenticated, loading } = useAuth();
    
    // Initialize form on component mount
    React.useEffect(() => {
      // If we haven't checked auth yet, do nothing (show a loading spinner or something)
      if (loading) return;

      // Check authentication
      if (!isAuthenticated) {
        window.location.href = '/login';
        return;
      }
      
      // If we have a stateId, we are already in the form
      // and don't need to initialize again
      if (stateId) {
        return;
      }

      // Initialize form
      initForm();
      
      // Initialize and setup interaction tracking
      if (window.interactionTracker) {
        // Reset tracker to start fresh
        window.interactionTracker.reset();
        
        // Set up interval to periodically capture interaction data
        const trackingInterval = setInterval(() => {
          if (window.interactionTracker) {
            try {
              // Get current interaction data
              const currentData = window.interactionTracker.getData();
              
              // Update form data with latest interaction tracking
              setFormData(prevData => ({
                ...prevData,
                interactionData: currentData
              }));
            } catch (err) {
              console.error('Error capturing interaction data:', err);
            }
          }
        }, 10000); // Update every 10 seconds
        
        // Cleanup interval on unmount
        return () => clearInterval(trackingInterval);
      }
   }, [isAuthenticated, loading, stateId]);
    
    // Initialize form state
    const initForm = async (forceNew = false) => {
      try {
        const response = await fetch('/api/form/init', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ force_new: forceNew })
        });
        
        if (!response.ok) {
          throw new Error('Failed to initialize form');
        }
        
        const data = await response.json();
        setStateId(data.id);

        // Reset form data for new form
        setFormData({
          answers: {},
          interactionData: null,
          cptResults: null
        });
        
        // Load first question
        loadCurrentQuestion(data.id);
      } catch (error) {
        console.error('Error initializing form:', error);
      }
    };
    
    // Load current question
    const loadCurrentQuestion = async (id = stateId) => {
      try {
        const response = await fetch(`/api/form/state/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to load question');
        }
        
        const data = await response.json();
        
        // Check if we're at the submission screen
        if (data.state === 'complete') {
          setIsComplete(true);
          setFormData(prev => ({
              ...prev,
              answers: data.answers || {}
          }));
        } else {
          setCurrentQuestion(data.question);
          setCurrentStep(data.current_step);
          setTotalSteps(data.total_steps);
          setPreviousAnswer(data.previous_answer);
          
          // Store previous answer in formAnswers
          if (data.previous_answer && data.question) {
            setFormData(prev => ({
              ...prev,
              answers: {
                  ...prev.answers,
                  [data.question.id]: data.previous_answer
              }
            }));
          }
        }
      } catch (error) {
        console.error('Error loading question:', error);
      }
    };
    
    // Navigate between questions
    const navigate = async (direction) => {
      // Get answer for current question
      const answer = currentQuestion && 
                    getQuestionAnswer(currentQuestion.id);
      
      // Validate if going forward
      if (direction === 'next' && currentQuestion.required && answer == undefined) {
        setValidationError('This question is required');
        return;
      }
      
      // Clear validation error
      setValidationError(null);
      
      try {
        // Get latest interaction data
        let currentInteractionData = null;
        if (window.interactionTracker) {
          currentInteractionData = window.interactionTracker.getData();
        }
        
        const response = await fetch(`/api/form/state/${stateId}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            question_id: currentQuestion.id,
            answer: answer,
            direction: direction,
            // Include latest data with each navigation
            interaction_data: currentInteractionData,
            cpt_data: formData.cptResults
          })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            setValidationError(errorData.error || 'Failed to save answer');
            return;
        }
        
        // Load next question
        loadCurrentQuestion();
      } catch (error) {
          console.error('Error navigating:', error);
          setValidationError('An error occurred. Please try again.');
      }
    };
    
    // Get answer for a question
    const getQuestionAnswer = (questionId) => {
        return formData.answers[questionId];
    };
    
    // Handle answer change
    const handleAnswerChange = (questionId, answer) => {
      setFormData(prev => ({
        ...prev,
        answers: {
            ...prev.answers,
            [questionId]: answer
        }
      }));
    };
    
    // Submit form
    const submitForm = async () => {
      setIsSubmitting(true);
      
      try {
        // Get final interaction data snapshot
        let finalInteractionData = null;
        if (window.interactionTracker) {
          try {
            finalInteractionData = window.interactionTracker.getData();
          } catch (err) {
            console.error('Error getting final interaction data:', err);
          }
        }
        
        // Submit all data together
        const response = await fetch(`/api/form/state/${stateId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'X-Device-ID': localStorage.getItem('device_id') || ''
          },
          body: JSON.stringify({
            // Only include final interaction data and CPT results
            interaction_data: finalInteractionData,
            cpt_data: cptResults
          })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit form');
        }
        
        // Show success message
        showMessage('Your assessment has been submitted successfully!', 'success');
        
        // Reset form after delay
        setTimeout(() => {
          initForm(true);
          window.location.href = '/';
        }, 500);
      } catch (error) {
        console.error('Error submitting form:', error);
        showMessage('Failed to submit assessment: ' + error.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    };
    
    // Show message
    const showMessage = (message, type) => {
      const messageDiv = document.getElementById('message');
      if (!messageDiv) return;
      
      messageDiv.textContent = message;
      messageDiv.className = `message ${type}`;
      messageDiv.style.display = 'block';
      
      // Auto-hide success messages
      if (type === 'success') {
        setTimeout(() => {
          messageDiv.style.display = 'none';
        }, 5000);
      }
    };
    
    // Reset form
    const resetForm = () => {
      if (window.confirm('Are you sure you want to start over? All your current answers will be lost.')) {
        showMessage('Starting a new assessment...', 'success');
        initForm(true);
        // Redirect to index
        window.location.href = '/';
      }
    };
    
    // Render CPT test
    const renderCPTTest = (question) => {
      // Initialize settings with default values
      let testSettings = {
        testDuration: 120000,
        stimulusDuration: 250,
        interStimulusInterval: 2000,
        targetProbability: 0.7,
        targets: ['X'],
        nonTargets: ['A', 'B', 'C', 'E', 'F', 'H', 'K', 'L']
      };
      
      if (question && question.options && Array.isArray(question.options)) {
        question.options.forEach(option => {
            if (option.label && option.value !== undefined) {
                let value = option.value;
                
                if (typeof value === 'string') {
                    if (!isNaN(value) && !isNaN(parseFloat(value))) {
                        value = parseFloat(value);
                    } else if (value.includes(',')) {
                        value = value.split(',').map(item => item.trim());
                    } else if (option.label === 'targets') {
                        value = [value];
                    }
                }
                
                testSettings[option.label] = value;
            }
        });
      }
      
      return (
        <CPTTest
          settings={testSettings}
          questionId={question.id}
          onTestEnd={(results) => {
            // Store CPT results
            setCptResults(results);
            
            // Also update formData for consistency
            setFormData(prev => ({
              ...prev,
              cptResults: results
            }));
            
            setIsDoingCognitiveTest(false);
          }}
          onTestStart={() => {
            setIsDoingCognitiveTest(true);
          }}
        />
      );
    };
    
    // Render radio question
    const renderRadioQuestion = (question) => {
      const answer = getQuestionAnswer(question.id);
      
      return (
        <div className="symptom-scale">
          {question.options.map(option => (
            <label key={option.value} className="option-label">
              <input
                type="radio"
                name={question.id}
                value={option.value}
                checked={answer === option.value}
                onChange={() => handleAnswerChange(question.id, option.value)}
                required={question.required}
              />
              <div className="option-text">
                <strong>{option.label}</strong>
                {option.description && <div>{option.description}</div>}
              </div>
            </label>
          ))}
        </div>
      );
    };
    
    // Render dropdown question
    const renderDropdownQuestion = (question) => {
      const answer = getQuestionAnswer(question.id);
      
      return (
        <select
          name={question.id}
          value={answer || ''}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          required={question.required}
        >
          {question.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    };
    
    // Render text question
    const renderTextQuestion = (question) => {
      const answer = getQuestionAnswer(question.id);
      
      return (
        <textarea
          name={question.id}
          value={answer || ''}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          placeholder={question.placeholder}
          maxLength={question.max_length}
          required={question.required}
        />
      );
    };
    
    // Render question based on type
    const renderQuestion = (question) => {
      switch (question.type) {
        case 'radio':
          return renderRadioQuestion(question);
        case 'dropdown':
          return renderDropdownQuestion(question);
        case 'text':
          return renderTextQuestion(question);
        case 'cognitive_test':
          return renderCPTTest(question);
        default:
          return <p>Unsupported question type: {question.type}</p>;
      }
    };
    
    // Render submission screen
    const renderSubmitScreen = () => (
      <div>
        <p className="completion-message">
          You have answered all the questions. Please submit your responses.
        </p>
        
        <div className="navigation-buttons">
          <button
            type="button"
            className="nav-button prev-button"
            onClick={() => navigate('prev')}
            disabled={isSubmitting}
          >
            Back to Questions
          </button>
          
          <button
            type="button"
            className="submit-button"
            onClick={submitForm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
        
        <div>
          <button
            type="button"
            className="reset-button"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Start Over
          </button>
        </div>
      </div>
    );
    
    // Render form
    if (!stateId) {
      return <div>Loading...</div>;
    }
    
    if (isComplete) {
      return renderSubmitScreen();
    }
    
    if (!currentQuestion) {
      return <div>Loading question...</div>;
    }
    
    return (
      <form id="symptom-form">
      <div className="progress-indicator">
          Question {currentStep} of {totalSteps}
      </div>
      
      <div className="form-group" data-question-id={currentQuestion?.id}>
          <h3>{currentQuestion?.title}</h3>
          
          {currentQuestion?.description && (
              <p>{currentQuestion.description}</p>
          )}
          
          {currentQuestion && renderQuestion(currentQuestion)}
          
          {validationError && (
              <div className="validation-message">{validationError}</div>
          )}
      </div>
        
      {!isDoingCognitiveTest && (
                <div className="navigation-buttons" id="nav-buttons">
                    {currentStep > 1 && (
                        <button
                            type="button"
                            className="nav-button prev-button"
                            onClick={() => navigate('prev')}
                        >
                            Previous
                        </button>
                    )}
                    
                    <button
                        type="button"
                        className="nav-button next-button"
                        onClick={() => navigate('next')}
                    >
                        Next
                    </button>
                </div>
            )}
        </form>
    );
}