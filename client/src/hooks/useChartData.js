// src/hooks/useChartData.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api'; 

// Define metricsByType outside the hook as it's constant
const metricsByType = {
    mouse: [ 
      { value: 'click_precision', label: 'Click Precision' },
      { value: 'path_efficiency', label: 'Path Efficiency' },
      // ... other mouse metrics
       { value: 'overshoot_rate', label: 'Overshoot Rate' }, 
       { value: 'average_velocity', label: 'Average Velocity' },
       { value: 'velocity_variability', label: 'Velocity Variability' }
    ],
    keyboard: [
      { value: 'typing_speed', label: 'Typing Speed' },
      { value: 'average_inter_key_interval', label: 'Inter-Key Interval' },
      // ... other keyboard metrics
       { value: 'typing_rhythm_variability', label: 'Typing Rhythm Variability' },
       { value: 'average_key_hold_time', label: 'Key Hold Time' },
       { value: 'key_press_variability', label: 'Key Press Variability' },
       { value: 'correction_rate', label: 'Correction Rate' },
       { value: 'pause_rate', label: 'Pause Rate' },
       { value: 'immediate_correction_tendency', label: 'Immediate Correction Tendency' },
       { value: 'deep_thinking_pause_rate', label: 'Deep Thinking Pause Rate' },
       { value: 'keyboard_fluency', label: 'Keyboard Fluency Score' }
    ],
    cpt: [ 
      { value: 'reaction_time', label: 'Reaction Time' },
      { value: 'detection_rate', label: 'Detection Rate' },
      // ... other CPT metrics
       { value: 'omission_error_rate', label: 'Omission Error Rate' },
       { value: 'commission_error_rate', label: 'Commission Error Rate' }
    ],
    tmt: [
      { value: 'part_a_time', label: 'Part A Time' },
      { value: 'part_b_time', label: 'Part B Time' },
      // ... other TMT metrics
       { value: 'b_to_a_ratio', label: 'B/A Ratio' },
       { value: 'part_a_errors', label: 'Part A Errors' },
       { value: 'part_b_errors', label: 'Part B Errors' }
    ],
    digit_span: [
        { value: 'highest_span', label: 'Highest Span Achieved' },
        { value: 'correct_trials', label: 'Correct Trials' },
        { value: 'total_trials', label: 'Total Trials' }, 
    ],
};

// Helper to determine question metrics type (can be outside or inside hook)
const getQuestionMetricsType = (question) => {
    if (!question) return 'mouse'; // Default
    if (question.metrics_type) return question.metrics_type; 
    if (question.type === 'text') return 'keyboard'; 
    if (question.type === 'cpt') return 'cpt'; 
    if (question.type === 'tmt') return 'tmt'; 
    if (question.type === 'digit_span') return 'digit_span'; 
    return 'mouse'; // Default
};

export function useChartData() {
    const { user } = useAuth();
    const location = useLocation(); 
    const userId = useMemo(() => new URLSearchParams(location.search).get('user_id'), [location.search]); // Memoize userId extraction

    // State managed by the hook
    const [allQuestions, setAllQuestions] = useState([]); 
    const [selectedSymptom, setSelectedSymptom] = useState(''); 
    const [selectedMetric, setSelectedMetric] = useState(''); 
    const [availableMetrics, setAvailableMetrics] = useState([]); 
    const [isLoading, setIsLoading] = useState(true); 
    const [noData, setNoData] = useState(false); 
    const [errorMessage, setErrorMessage] = useState(''); 
    const [correlationData, setCorrelationData] = useState(null); 
    const [timelineData, setTimelineData] = useState(null); 

    // Derived state: current metrics type based on selected symptom
    const currentMetricsType = useMemo(() => {
        const question = allQuestions.find(q => q.id === selectedSymptom);
        return getQuestionMetricsType(question);
    }, [selectedSymptom, allQuestions]);

    // Load questions on initial mount or when userId changes
    useEffect(() => {
        const loadQuestions = async () => {
            setIsLoading(true);
            setErrorMessage(''); // Clear previous errors
            try {
                const questions = await api.get('/api/questions');
                setAllQuestions(questions); 

                // Set initial default selections only if questions are loaded
                if (questions.length > 0) { 
                     const defaultQuestion = questions.find(q => // Find first suitable question
                        q.type === 'radio' || q.type === 'dropdown' || q.type === 'scale' || q.type === 'cpt' || q.type === 'tmt' || q.type === 'digit_span' // Include tests
                    ) || questions[0]; // Fallback to first question

                    if (defaultQuestion) {
                        const initialSymptomId = defaultQuestion.id;
                        const initialMetricsType = getQuestionMetricsType(defaultQuestion);
                        const initialMetrics = metricsByType[initialMetricsType] || []; 

                        setSelectedSymptom(initialSymptomId); 
                        setAvailableMetrics(initialMetrics); 

                        if (initialMetrics.length > 0) { 
                            setSelectedMetric(initialMetrics[0].value); 
                        } else {
                            setSelectedMetric(''); // Reset if no metrics available
                        }
                    }
                } else {
                     // Handle case with no questions loaded
                     setSelectedSymptom('');
                     setSelectedMetric('');
                     setAvailableMetrics([]);
                }

            } catch (error) {
                console.error('Failed to load question definitions:', error); 
                setErrorMessage('Failed to load question definitions.'); 
                setAllQuestions([]); // Clear questions on error
            } finally {
                 // Loading state will be set by the chart update effect
                 // setIsLoading(false); // - Let the next effect handle loading state
            }
        };
        loadQuestions(); 
        // Dependency: userId ensures questions reload if user changes via URL
    }, [userId]);

    // Update charts when selections or userId change
    useEffect(() => {
        const updateCharts = async () => { 
             // Don't run if initial selections aren't ready or no questions loaded
             if (!selectedSymptom || !selectedMetric || allQuestions.length === 0) {
                 // If questions failed to load earlier, don't try to fetch chart data
                 if (errorMessage.includes('question definitions')) {
                    setIsLoading(false); // Stop loading if questions failed
                    setNoData(true);
                 } else {
                     // Still waiting for initial selections or question load
                     setIsLoading(true); // Ensure loading is true while waiting
                 }
                 return;
             }

            setIsLoading(true); 
            setNoData(false); 
            setErrorMessage(''); 
            setCorrelationData(null); // Reset correlation data
            setTimelineData(null);    // Reset timeline data


            try {
                const userIdToUse = userId || user?.email || '';
                const question = allQuestions.find(q => q.id === selectedSymptom);

                 if (!question) { 
                    throw new Error('Selected question not found'); // Or handle gracefully
                 }

                // Fetch timeline data (always needed)
                 const timelineResponse = await api.get(
                    `/api/metrics/chart/timeline?user_id=${userIdToUse}&symptom=${selectedSymptom}&metric=${selectedMetric}`
                 ); 
                 setTimelineData(timelineResponse); 

                 // Fetch correlation data only if needed (based on currentMetricsType)
                 if (currentMetricsType === 'mouse') { 
                    try { 
                         const correlationResponse = await api.get( 
                            `/api/metrics/chart/correlation?user_id=${userIdToUse}&symptom=${selectedSymptom}&metric=${selectedMetric}` 
                         ); 
                         setCorrelationData(correlationResponse); 
                    } catch (corrError) { 
                        console.warn('Could not load correlation data:', corrError); 
                        setCorrelationData(null); // Explicitly set to null on error
                    } 
                 } else { 
                     setCorrelationData(null); // Ensure it's null for non-mouse
                 } 

                 // Check for data presence (mainly timeline)
                 const hasTimelineData = timelineResponse?.data?.datasets?.length > 0 && timelineResponse?.data?.labels?.length > 0; 
                 setNoData(!hasTimelineData); 
                 if (!hasTimelineData) { 
                     setErrorMessage('No data available for visualization'); 
                 }

            } catch (error) { 
                console.error('Error updating charts:', error); 
                setErrorMessage(`Failed to load chart data: ${error.message}`); 
                setNoData(true); 
                 setTimelineData(null); // Clear data on error
                 setCorrelationData(null);
            } finally { 
                setIsLoading(false); 
            }
        };

        updateCharts();
    }, [selectedSymptom, selectedMetric, userId, allQuestions, currentMetricsType]); // Add allQuestions and currentMetricsType dependencies

    // Group questions (memoized for performance)
    const questionGroups = useMemo(() => { 
        const groups = { mouse: [], keyboard: [], cpt: [], tmt: [], digit_span: [] }; 
        allQuestions.forEach(question => { 
            const metricsType = getQuestionMetricsType(question); 
            if (groups[metricsType]) { 
                groups[metricsType].push(question); 
            } else { 
                groups.mouse.push(question); // Default to mouse
            } 
        }); 
        return groups; 
    }, [allQuestions]);

    // Handlers exposed by the hook
    const handleSymptomChange = useCallback((e) => { 
        const symptomId = e.target.value; 
        setSelectedSymptom(symptomId); 

        const question = allQuestions.find(q => q.id === symptomId); 
        if (question) { 
            const newMetricsType = getQuestionMetricsType(question); 
            const newMetrics = metricsByType[newMetricsType] || []; 
            setAvailableMetrics(newMetrics); 

            // Reset selected metric to the first available one
            if (newMetrics.length > 0) { 
                setSelectedMetric(newMetrics[0].value); 
            } else {
                setSelectedMetric(''); // No metrics available
            }
             // Reset error/no data state, will be re-evaluated by useEffect
             setErrorMessage('');
             setNoData(false);
        } else {
             // Handle case where question isn't found (shouldn't happen ideally)
             setAvailableMetrics([]);
             setSelectedMetric('');
        }
    }, [allQuestions]); // Dependency on allQuestions

    const handleMetricChange = useCallback((e) => { 
        setSelectedMetric(e.target.value); 
         // Reset error/no data state, will be re-evaluated by useEffect
         setErrorMessage('');
         setNoData(false);
    }, []);

    // Determine if correlation chart should be shown
    const shouldShowCorrelationChart = useMemo(() => { 
        // Based on the derived currentMetricsType state
        return currentMetricsType === 'mouse' && correlationData !== null;
    }, [currentMetricsType, correlationData]);

    // Return values needed by the component
    return {
        userId,
        isLoading,
        noData,
        errorMessage,
        selectedSymptom,
        selectedMetric,
        availableMetrics,
        questionGroups, // Use the memoized group
        correlationData,
        timelineData,
        metricsTypeForExplanation: currentMetricsType, // Use the derived state
        shouldShowCorrelationChart, // Use the memoized value
        handleSymptomChange,
        handleMetricChange,
        // Optionally return allQuestions if needed directly in component
        allQuestions
    };
}