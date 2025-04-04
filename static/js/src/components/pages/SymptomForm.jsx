import { useAuth } from '../../context/AuthContext';
import CPTTest from '../cpt/CPTTest';

export default function SymptomForm() {
    const [stateId, setStateId] = React.useState(null);
    const [currentStep, setCurrentStep] = React.useState(0);
    const [totalSteps, setTotalSteps] = React.useState(0);
    const [currentQuestion, setCurrentQuestion] = React.useState(null);
    const [previousAnswer, setPreviousAnswer] = React.useState(null);
    const [formAnswers, setFormAnswers] = React.useState({});
    const [isComplete, setIsComplete] = React.useState(false);
    const [validationError, setValidationError] = React.useState(null);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const {isAuthenticated, loading } = useAuth();
    
    // Initialize form on component mount
    React.useEffect(() => {
      // If we haven't checked auth yet, do nothing (show a loading spinner or something)
      if (loading) return;

      // Check authentication
      if (!isAuthenticated) {
        window.location.href = '/login';
        return;
      }
      
      // Initialize form
      initForm();
      
      // Initialize interaction tracking if available
      if (window.interactionTracker) {
        window.interactionTracker.reset();
      }
    }, []);
    
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
          setFormAnswers(data.answers || {});
        } else {
          setCurrentQuestion(data.question);
          setCurrentStep(data.current_step);
          setTotalSteps(data.total_steps);
          setPreviousAnswer(data.previous_answer);
          
          // Store previous answer in formAnswers
          if (data.previous_answer && data.question) {
            setFormAnswers(prev => ({
              ...prev,
              [data.question.id]: data.previous_answer
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
      if (direction === 'next' && currentQuestion.required && !answer) {
        setValidationError('This question is required');
        return;
      }
      
      // Clear validation error
      setValidationError(null);
      
      try {
        const response = await fetch(`/api/form/state/${stateId}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            question_id: currentQuestion.id,
            answer: answer,
            direction: direction
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
      return formAnswers[questionId];
    };
    
    // Handle answer change
    const handleAnswerChange = (questionId, answer) => {
      setFormAnswers(prev => ({
        ...prev,
        [questionId]: answer
      }));
    };
    
    // Submit form
    const submitForm = async () => {
      setIsSubmitting(true);
      
      try {
        // Get interaction data if available
        let interactionData = {};
        if (window.interactionTracker) {
          interactionData = window.interactionTracker.getData();
        }
        
        // Extract cognitive test results
        const cognitiveTestResults = [];
        for (const [questionId, answer] of Object.entries(formAnswers)) {
          if (typeof answer === 'object' && answer !== null && 
              answer.stimuliPresented && answer.responses) {
            cognitiveTestResults.push({
              question_id: questionId,
              results: answer
            });
          }
        }
        
        // Submit form
        const response = await fetch(`/api/form/state/${stateId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'X-Device-ID': localStorage.getItem('device_id') || ''
          },
          body: JSON.stringify({
            interaction_data: interactionData,
            cognitive_tests: cognitiveTestResults
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
        }, 2000);
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
      }
    };
    
    // Render CPT test
    const renderCPTTest = (question) => {
      return (
        <CPTTest
          onTestEnd={(results) => {
            handleAnswerChange(question.id, results);
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
                checked={answer?.toString() === option.value?.toString()}
                onChange={() => handleAnswerChange(question.id, option.value)}
                required={question.required}
              />
              <div className="option-text">
                <strong>{option.label}</strong>
                {option.description && (
                  <>
                    <br />
                    {option.description}
                  </>
                )}
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
        
        <div className="form-group" data-question-id={currentQuestion.id}>
          <h3>{currentQuestion.title}</h3>
          
          {currentQuestion.description && (
            <p>{currentQuestion.description}</p>
          )}
          
          {renderQuestion(currentQuestion)}
          
          {validationError && (
            <div className="validation-message">{validationError}</div>
          )}
        </div>
        
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
      </form>
    );
  }