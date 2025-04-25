// src/components/pages/Form.jsx
import React, { useState, useEffect } from 'react'; // Keep React and useState for answers/results
import { useFormNavigation } from '../../hooks/useFormNavigation'; // Import the custom hook

import QuestionRenderer from './QuestionRenderer'; 
import SubmissionScreen from './SubmissionScreen'; 
import LoadingSpinner from '../common/LoadingSpinner'; // Use a loading spinner
import NavigationButtons from './NavigationButtons';

// Interaction tracker initialization (if not handled globally or in another hook)
import '../../interaction-tracker'; // - Ensure tracker runs

export default function Form() {
  // Use the custom hook for navigation state and handlers
  const {
    stateId,
    currentStep,
    totalSteps,
    currentQuestion,
    isComplete,
    isLoading, // Use loading state from hook
    isSubmitting,
    validationError,
    handleNavigate,
    handleSubmit,
    handleReset,
    setValidationError // Get error setter from hook
  } = useFormNavigation();

  // State managed within Form.jsx: Answers and Cognitive Test Results
  const [answers, setAnswers] = useState({});
  const [cptResults, setCptResults] = useState(null);
  const [tmtResults, setTmtResults] = useState(null);
  const [digitSpanResults, setDigitSpanResults] = useState(null);
  const [isDoingCognitiveTest, setIsDoingCognitiveTest] = useState(false); // Keep this local

  // Effect to reset local answers when the question changes (navigated)
  // Or potentially fetch previous answer from the hook if needed.
  useEffect(() => {
      if (currentQuestion) {
        // Reset cognitive test state when moving to a non-test question
        if (!['cpt', 'tmt', 'digit_span'].includes(currentQuestion.type)) {
            setIsDoingCognitiveTest(false);
        }
        // Reset specific cognitive test results when navigating away
        // (optional, depends if you want to preserve results temporarily)
        // setCptResults(null);
        // setTmtResults(null);
        // setDigitSpanResults(null);
      }
  }, [currentQuestion]);

  // Handle answer changes locally
  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
    // Clear validation error on change
    if (validationError) {
        setValidationError(null);
    }
  };

  // --- Prepare data for navigation/submission ---
  const getCurrentAnswerData = () => {
      const answer = currentQuestion ? answers[currentQuestion.id] : undefined;
      return {
          answer,
          cptResults,
          tmtResults,
          digitSpanResults
      };
  };

  // --- Render Logic ---

  if (isLoading && !stateId) { // Show initial loading spinner
    return <LoadingSpinner message="Initializing assessment..." />;
  }

  if (isComplete) {
    return (
      <SubmissionScreen
        onSubmit={() => handleSubmit(getCurrentAnswerData())} // Pass final results
        onBack={() => handleNavigate('prev', getCurrentAnswerData())} // Pass current data when going back
        onReset={handleReset}
        isSubmitting={isSubmitting}
      />
    );
  }

  if (!currentQuestion) { // Handle case where question isn't loaded yet after init
     return <LoadingSpinner message="Loading question..." />;
  }

  return (
    <form id="symptom-form" onSubmit={(e) => e.preventDefault()}> {/* Prevent default form submission */}
      <div className="progress-indicator">
        Question {currentStep} of {totalSteps}
      </div>

      {/* Display validation errors */}
       {validationError && (
            <div className="message error show" style={{marginBottom: '15px'}}>
                {validationError}
            </div>
       )}

       {/* Use QuestionRenderer */}
      <QuestionRenderer
          question={currentQuestion}
          answer={answers[currentQuestion.id]}
          onChange={handleAnswerChange}
          // Pass setters and handlers for cognitive tests
          setTmtResults={setTmtResults}
          setCptResults={setCptResults}
          setDigitSpanResults={setDigitSpanResults}
          setIsDoingCognitiveTest={setIsDoingCognitiveTest} // Let renderer control this
      />

      {/* Conditionally render navigation buttons */}
      { !isDoingCognitiveTest && (
          <NavigationButtons
              currentStep={currentStep}
              totalSteps={totalSteps}
              onPrev={() => handleNavigate('prev', getCurrentAnswerData())}
              onNext={() => handleNavigate('next', getCurrentAnswerData())}
              // Disable buttons while submitting or loading next question
              disabled={isSubmitting || isLoading}
          />
      )}
    </form>
  );
}