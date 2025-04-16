import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import CPTest from '../cognitive/CPTest';
import TMTest from '../cognitive/TMTest';
import api from '../../services/api';

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
      cptResults: null,
      tmtResults: null
  });
  const [cptResults, setCptResults] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDoingCognitiveTest, setIsDoingCognitiveTest] = useState(false);
  const {isAuthenticated, loading } = useAuth();
  const nav = useNavigate();
   
  // Initialize form on component mount
  useEffect(() => {
    // If we haven't checked auth yet, do nothing (show a loading spinner or something)
    if (loading) return;

    // Check authentication
    if (!isAuthenticated) {
      nav('/login');
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
    if (forceNew) {
      return resetFormState(true);
    }
    
    try {
      const data = await api.post('/api/form/init', { force_new: forceNew });
      if (!data) {
        throw new Error('Error with form init request');
      }
      setStateId(data.id);
      loadCurrentQuestion(data.id);
    } catch (error) {
      console.error('Error initializing form:', error);
    }
  };

  // A centralized function to reset the entire form
  const resetFormState = async (createNewForm = true) => {
    // First reset all local state
    setCurrentQuestion(null);
    setCurrentStep(0);
    setTotalSteps(0);
    setPreviousAnswer(null);
    setFormAnswers({});
    setFormData({
      answers: {},
      interactionData: null,
      cptResults: null,
      tmtResults: null
    });
    setCptResults(null);
    setIsComplete(false);
    setValidationError(null);
    
    // Reset interaction tracker if available
    if (window.interactionTracker) {
      window.interactionTracker.reset();
    }
    
    // If requested, create a new form on the server
    if (createNewForm) {
      try {
        const data = await api.post('/api/form/init', { force_new: true });
        if (data) {
          setStateId(data.id);
          return loadCurrentQuestion(data.id);
        }
      } catch (error) {
        console.error('Error initializing form:', error);
        throw error;
      }
    }
  };
  
  // Load current question
  const loadCurrentQuestion = async (id = stateId) => {
    try {
      const data = await api.get(`/api/form/state/${id}`)

      if (!data) {
        throw new Error('Error with question request')
      }
      
      // Check if we're at the submission screen
      if (data.state === 'complete') {
        setIsComplete(true);
        setCurrentQuestion(data.question)
        setFormData(prev => ({
            ...prev,
            answers: data.answers || {}
        }));
      } else {
        updateQuestion(data)
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
      
      const data = await api.post(`/api/form/state/${stateId}/answer`, {
          question_id: currentQuestion.id,
          answer: answer,
          direction: direction,
          // Include latest data with each navigation
          interaction_data: currentInteractionData,
          cpt_data: formData.cptResults,
          tmt_data: formData.tmtResults
        }
      )

      if (!data) {
        setValidationError(errorData.error || 'Failed to save answer');
        throw new Error('Error with form_state answer request')

      }
      
      // Load next question
      loadCurrentQuestion();
      if (isComplete && direction === 'prev') {
        setIsComplete(false)
      }
    } catch (error) {
        console.error('Error navigating:', error);
        setValidationError('An error occurred. Please try again.');
    }
  };

  const updateQuestion = (data) => {
    setCurrentQuestion(data.question);
    setCurrentStep(data.current_step);
    setTotalSteps(data.total_steps);
    setPreviousAnswer(data.previous_answer);
    
    // Store previous answer in formAnswers if available
    if (data.previous_answer && data.question) {
      setFormData(prev => ({
        ...prev,
        answers: {
          ...prev.answers,
          [data.question.id]: data.previous_answer
        }
      }));
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
      
      const data = await api.post(`/api/form/state/${stateId}/submit`, {
          interaction_data: finalInteractionData,
          cpt_data: cptResults,
          tmt_data: formData.tmtResults
        }
      );

      if (!data) {
        throw new Error('Failed to submit form');
      }
      
      // Show success message
      if (window.showMessage) {
        window.showMessage('Your assessment has been submitted successfully!', 'success');
      } else {
        alert('Your assessment has been submitted successfully!');
      }
      
      // Reset form state and create a new form
      await resetFormState(true);
      
      // Focus on top of page
      window.scrollTo(0, 0);
      
    } catch (error) {
      console.error('Error submitting form:', error);
      if (window.showMessage) {
        window.showMessage('Failed to submit assessment: ' + (error.message || 'Unknown error'), 'error');
      } else {
        alert('Failed to submit assessment: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }; 

  // Reset form
  const resetForm = () => {
    if (window.confirm('Are you sure you want to start over? All your current answers will be lost.')) {
      // Show message
      if (window.showMessage) {
        window.showMessage('Starting a new assessment...', 'success');
      }
      
      // Reset form state and create a new form
      resetFormState(true);
      
      // Focus on top of page
      window.scrollTo(0, 0);
    }
  };
  
  // Render CPT test
  const renderCPTest = (question) => {
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
      <CPTest
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

  // Render Trail Making Test
  const renderTrailTest = (question) => {
    let testSettings = {
      partATimeLimit: 60000,
      partBTimeLimit: 120000,
      partAItems: 25,
      partBItems: 25,
      includePartB: true,
      minDistance: 60
    };
    
    if (question && question.options && Array.isArray(question.options)) {
      question.options.forEach(option => {
        if (option.label && option.value !== undefined) {
          let value = option.value;
          
          if (typeof value === 'string') {
            if (!isNaN(value) && !isNaN(parseFloat(value))) {
              value = parseFloat(value);
            } else if (value.toLowerCase() === 'true') {
              value = true;
            } else if (value.toLowerCase() === 'false') {
              value = false;
            }
          }
          
          testSettings[option.label] = value;
        }
      });
    }
    
    return (
      <TMTest
        settings={testSettings}
        questionId={question.id}
        onTestEnd={(results) => {
          // Store Trail Making Test results
          setFormData(prev => ({
            ...prev,
            tmtResults: results
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
      case 'cpt':
        return renderCPTest(question);
      case 'tmt':
          return renderTrailTest(question);          
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