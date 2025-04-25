// src/hooks/useFormNavigation.js
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export function useFormNavigation() {
  const [stateId, setStateId] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Added loading state
  const [validationError, setValidationError] = useState(null);

  const { isAuthenticated, loading: authLoading } = useAuth();
  const nav = useNavigate();

  // --- Core Functions (moved from Form.jsx) ---

  const loadCurrentQuestion = useCallback(async (id) => {
    if (!id) return;
    setIsLoading(true); // Set loading true when fetching
    try {
      const data = await api.get(`/api/form/state/${id}`); //
      if (!data) throw new Error('Error loading form state'); //

      setCurrentQuestion(data.question); //
      setCurrentStep(data.current_step); //
      setTotalSteps(data.total_steps); //
      setIsComplete(data.state === 'complete'); //
      setValidationError(null); // Clear previous errors
    } catch (error) {
      console.error('Error loading question:', error);
      setValidationError('Failed to load the current step.');
      // Handle specific errors like 515 if needed, potentially calling reset
    } finally {
      setIsLoading(false); // Set loading false after fetching
    }
  }, []); // Add dependencies if needed, though `api` is stable

  const resetFormState = useCallback(async (createNewForm = true) => {
    // Reset local state
    setCurrentQuestion(null);
    setCurrentStep(0);
    setTotalSteps(0);
    setIsComplete(false);
    setValidationError(null);
    setIsLoading(true); // Start loading for init

    if (window.interactionTracker) {
      window.interactionTracker.reset(); //
    }

    if (createNewForm) {
      try {
        const data = await api.post('/api/form/init', { force_new: true }); //
        if (data) {
          setStateId(data.id); //
          await loadCurrentQuestion(data.id); //
        } else {
          throw new Error('Failed to initialize new form state'); //
        }
      } catch (error) {
        console.error('Error initializing form:', error);
        setValidationError('Could not start a new assessment.');
        setIsLoading(false); // Ensure loading is false on error
      }
    } else {
      setStateId(null); // Clear stateId if not creating new
      setIsLoading(false); // Set loading false if not creating
    }
  }, [loadCurrentQuestion]); // Dependency on loadCurrentQuestion

  // Initialize form on mount and auth change
  useEffect(() => {
    if (authLoading) return; // Wait for auth check

    if (!isAuthenticated) {
      nav('/login'); // Redirect if not logged in
      return;
    }

    // Only initialize if stateId is not set
    if (!stateId) {
        const initialize = async () => {
            setIsLoading(true);
            try {
                const data = await api.post('/api/form/init', { force_new: false }); //
                if (!data) throw new Error('Error initializing form'); //
                setStateId(data.id); //
                await loadCurrentQuestion(data.id); //
            } catch (error) {
                console.error('Error initializing form:', error);
                setValidationError('Failed to initialize form. Trying to start a new one.');
                // Attempt to force a new form if init fails
                await resetFormState(true);
            } finally {
               // Loading state is handled within loadCurrentQuestion/resetFormState
            }
        };
        initialize();
    }
  }, [isAuthenticated, authLoading, stateId, nav, loadCurrentQuestion, resetFormState]); // Add dependencies

  // --- Event Handlers ---

  const handleNavigate = useCallback(async (direction, currentAnswerData) => {
    // Basic validation (can be expanded)
    if (direction === 'next' && currentQuestion?.required && currentAnswerData.answer === undefined) { //
      setValidationError('This question is required'); //
      return;
    }
    setValidationError(null); // Clear error

    // Ensure stateId and currentQuestion are available
    if (!stateId || !currentQuestion) {
        console.error("Cannot navigate, missing stateId or currentQuestion");
        setValidationError('Navigation error. Please refresh.');
        return;
    }

    setIsLoading(true); // Indicate loading during navigation

    try {
      let interactionData = null;
      if (window.interactionTracker) {
        interactionData = window.interactionTracker.getData(); //
      }

      // Include cognitive results if available in currentAnswerData
      const payload = {
        question_id: currentQuestion.id, //
        answer: currentAnswerData.answer, //
        direction: direction, //
        interaction_data: interactionData, //
        cpt_data: currentAnswerData.cptResults, //
        tmt_data: currentAnswerData.tmtResults, //
        digit_span_data: currentAnswerData.digitSpanResults, //
      };

      const data = await api.post(`/api/form/state/${stateId}/answer`, payload); //

      if (!data) throw new Error('Failed to save answer'); //

      // Load the next/previous question state
      await loadCurrentQuestion(stateId); //

    } catch (error) {
      console.error('Error navigating:', error);
      setValidationError(error.message || 'An error occurred saving the answer.');
      setIsLoading(false); // Stop loading on error
    }
    // Loading state is set to false within loadCurrentQuestion on success
  }, [stateId, currentQuestion, loadCurrentQuestion]); // Add dependencies

  const handleSubmit = useCallback(async (finalAnswerData) => {
    if (!stateId) return;
    setIsSubmitting(true);
    setValidationError(null);

    // Placeholder for location logic (consider moving to its own hook)
    const locationResults = { permission: 'prompt', latitude: null, longitude: null, error: null }; // - Simplified

    try {
        let finalInteractionData = null;
        if (window.interactionTracker) {
            finalInteractionData = window.interactionTracker.getData(); //
        }

        const payload = {
            interaction_data: finalInteractionData, //
            cpt_data: finalAnswerData.cptResults, //
            tmt_data: finalAnswerData.tmtResults, //
            digit_span_data: finalAnswerData.digitSpanResults, //
            location_permission: locationResults.permission, //
            latitude: locationResults.latitude, //
            longitude: locationResults.longitude, //
            location_error: locationResults.error, //
        };

        const data = await api.post(`/api/form/state/${stateId}/submit`, payload); //
        if (!data) throw new Error('Failed to submit form'); //

        if (window.showMessage) window.showMessage('Assessment submitted successfully!', 'success'); //
        await resetFormState(true); // Start new form
        window.scrollTo(0, 0); //

    } catch (error) {
        console.error('Error submitting form:', error);
        setValidationError(error.message || 'Failed to submit assessment.');
        if (window.showMessage) window.showMessage(`Submit failed: ${error.message || 'Unknown error'}`, 'error'); //
    } finally {
        setIsSubmitting(false);
    }
  }, [stateId, resetFormState]); // Add dependencies

  const handleReset = useCallback(() => {
    if (window.confirm('Are you sure you want to start over? All answers will be lost.')) { //
      if (window.showMessage) window.showMessage('Starting a new assessment...', 'success'); //
      resetFormState(true); //
      window.scrollTo(0, 0); //
    }
  }, [resetFormState]); // Add dependencies

  return {
    stateId,
    currentStep,
    totalSteps,
    currentQuestion,
    isComplete,
    isLoading, // Return loading state
    isSubmitting,
    validationError,
    handleNavigate,
    handleSubmit,
    handleReset,
    setValidationError // Expose setter for external errors if needed
  };
}