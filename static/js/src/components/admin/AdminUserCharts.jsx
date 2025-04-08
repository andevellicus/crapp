// src/components/admin/charts/AdminUserCharts.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import ChartControls from './charts/ChartControls';
import CorrelationChart from './charts/CorrelationChart';
import TimelineChart from './charts/TimelineChart';
import MetricsExplanation from './charts/MetricsExplanation';
import LoadingSpinner from '../common/LoadingSpinner';
import NoDataMessage from '../common/NoDataMessage';

const AdminUserCharts = () => {
  const location = useLocation();
  const userId = new URLSearchParams(location.search).get('user_id');
  
  // State for questions and metrics
  const [allQuestions, setAllQuestions] = useState([]);
  const [selectedSymptom, setSelectedSymptom] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('');
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [noData, setNoData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Chart data states
  const [correlationData, setCorrelationData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  
  // Define common metrics by metrics_type
  const metricsByType = {
    mouse: [
      { value: 'click_precision', label: 'Click Precision' },
      { value: 'path_efficiency', label: 'Path Efficiency' },
      { value: 'overshoot_rate', label: 'Overshoot Rate' },
      { value: 'average_velocity', label: 'Average Velocity' },
      { value: 'velocity_variability', label: 'Velocity Variability' }
    ],
    keyboard: [
      { value: 'typing_speed', label: 'Typing Speed' },
      { value: 'average_inter_key_interval', label: 'Inter-Key Interval' },
      { value: 'typing_rhythm_variability', label: 'Typing Rhythm Variability' },
      { value: 'average_key_hold_time', label: 'Key Hold Time' },
      { value: 'key_press_variability', label: 'Key Press Variability' },
      { value: 'correction_rate', label: 'Correction Rate' },
      { value: 'pause_rate', label: 'Pause Rate' }
    ],
    cpt: [
      { value: 'reaction_time', label: 'Reaction Time' },
      { value: 'detection_rate', label: 'Detection Rate' },
      { value: 'omission_error_rate', label: 'Omission Error Rate' },
      { value: 'commission_error_rate', label: 'Commission Error Rate' }
    ]
  };
  
  // 1. Load questions and check for CPT availability
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setIsLoading(true);
        // Get all questions from the API
        const questions = await api.get('/api/questions');
        
        // Group questions and set state
        setAllQuestions(questions);
        
        // Set default selections
        if (questions.length > 0) {
          // Find first question that's suitable for charts (not free text)
          const defaultQuestion = questions.find(q => 
            q.type === 'radio' || q.type === 'dropdown' || q.type === 'scale'
          );
          
          if (defaultQuestion) {
            setSelectedSymptom(defaultQuestion.id);
            
            // Determine metrics type based on question properties
            const metricsType = getQuestionMetricsType(defaultQuestion);
            
            // Set available metrics based on metrics type
            const metrics = metricsByType[metricsType] || [];
            setAvailableMetrics(metrics);
            
            if (metrics.length > 0) {
              setSelectedMetric(metrics[0].value);
            }
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load question definitions:', error);
        setErrorMessage('Failed to load question definitions.');
        setIsLoading(false);
      }
    };
    
    loadQuestions();
  }, [userId]);

  // Helper to determine question metrics type
  const getQuestionMetricsType = (question) => {
    // If metrics_type is explicitly defined, use it
    if (question.metrics_type) {
      return question.metrics_type;
    }
    
    // Otherwise infer from question type
    if (question.type === 'text') {
      return 'keyboard';
    } else if (question.type === 'cognitive_test') {
      return 'cpt';
    } else {
      // Default to mouse interactions for radio, dropdown, etc.
      return 'mouse';
    }
  };
  
  // Update charts when selections change
  useEffect(() => {
    if (selectedSymptom && selectedMetric) {
      updateCharts();
    }
  }, [selectedSymptom, selectedMetric, userId]);
  
  // Handle symptom selection change
  const handleSymptomChange = (e) => {
    const symptomId = e.target.value;
    setSelectedSymptom(symptomId);
    
    // Find the selected question
    const question = allQuestions.find(q => q.id === symptomId);
    
    if (question) {
      // Get metrics type based on question type/metrics_type
      const metricsType = getQuestionMetricsType(question);
      
      // Set available metrics based on metrics type
      const metrics = metricsByType[metricsType] || [];
      setAvailableMetrics(metrics);
      
      // Reset selected metric with first available metric
      if (metrics.length > 0) {
        setSelectedMetric(metrics[0].value);
      }
      
      // Skip certain question types for charts (e.g., free text)
      const isSuitableForChart = question.type === 'radio' || 
                                question.type === 'dropdown' || 
                                question.type === 'scale' ||
                                question.type === 'cognitive_test';
                                
      setNoData(!isSuitableForChart);
      
      if (!isSuitableForChart) {
        setErrorMessage('This question type does not support chart visualization.');
      }
    }
  };
  
  // Handle metric selection change
  const handleMetricChange = (e) => {
    setSelectedMetric(e.target.value);
  };
  
  // Update charts with selected data
  const updateCharts = async () => {
    if (!selectedSymptom || !selectedMetric) return;
    
    // Prevent duplicate requests while loading
    if (isLoading) return;
    
    try {
      setIsLoading(true);
      setNoData(false);
      setErrorMessage('');
      
      const userIdToUse = userId || '';
      
      // Find the question
      const question = allQuestions.find(q => q.id === selectedSymptom);
      if (!question) {
        setNoData(true);
        setErrorMessage('Question not found');
        setIsLoading(false);
        return;
      }
      
      const metricsType = getQuestionMetricsType(question);
      
      // Handle CPT metrics specially
      if (metricsType === 'cpt') {
        await loadCptTimelineData(userIdToUse, selectedMetric);
      } else {
        // For interaction metrics, fetch correlation and timeline data
        await loadInteractionMetricsData(userIdToUse, selectedSymptom, selectedMetric);
      }
    } catch (error) {
      console.error('Error updating charts:', error);
      setErrorMessage(`Failed to load data: ${error.message}`);
      setNoData(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Load CPT timeline data
  const loadCptTimelineData = async (userIdToUse, metricKey) => {
    try {
      // We need to call a new endpoint that returns CPT data over time
      const response = await api.get(`/api/metrics/chart/cpt-timeline?user_id=${userIdToUse}&metric=${metricKey}`);
      
      // Check if we have valid data
      const hasTimelineData = response && 
                          response.data && 
                          response.data.datasets && 
                          response.data.datasets.length > 0 &&
                          response.data.labels?.length > 0;
      
      if (hasTimelineData) {
        setTimelineData(response);
        setNoData(false);
      } else {
        setNoData(true);
        setErrorMessage('No CPT metrics data available for timeline visualization');
      }
      
      // Clear correlation data since it's not applicable for CPT metrics
      setCorrelationData(null);
      
    } catch (error) {
      console.error('Error loading CPT timeline data:', error);
      setNoData(true);
      setErrorMessage('Failed to load CPT metrics timeline data');
      throw error;
    }
  };
  
  // Load interaction metrics data
  const loadInteractionMetricsData = async (userIdToUse, symptomKey, metricKey) => {
    try {
      // Fetch pre-formatted data from API endpoints for interaction metrics
      const [correlationResponse, timelineResponse] = await Promise.all([
        api.get(`/api/metrics/chart/correlation?user_id=${userIdToUse}&symptom=${symptomKey}&metric=${metricKey}`),
        api.get(`/api/metrics/chart/timeline?user_id=${userIdToUse}&symptom=${symptomKey}&metric=${metricKey}`)
      ]);
      
      // Store the data in state
      setCorrelationData(correlationResponse);
      setTimelineData(timelineResponse);
      
      // Check if we have data
      const hasCorrelationData = correlationResponse && 
                              correlationResponse.data && 
                              correlationResponse.data.datasets && 
                              correlationResponse.data.datasets.length > 0 &&
                              correlationResponse.data.datasets[0].data?.length > 0;
                              
      const hasTimelineData = timelineResponse && 
                           timelineResponse.data && 
                           timelineResponse.data.datasets && 
                           timelineResponse.data.datasets.length > 0 &&
                           timelineResponse.data.labels?.length > 0;
      
      setNoData(!hasCorrelationData && !hasTimelineData);
    } catch (error) {
      console.error('Error loading interaction metrics data:', error);
      setNoData(true);
      throw error;
    }
  };

  // Group questions by metrics type
  const groupQuestionsByMetricsType = () => {
    const groups = {
      mouse: [],
      keyboard: [],
      cpt: []
    };

    // Group questions based on their metrics_type
    allQuestions.forEach(question => {
      const metricsType = getQuestionMetricsType(question);
      if (groups[metricsType]) {
        groups[metricsType].push(question);
      } else {
        // Default to mouse type if unknown
        groups.mouse.push(question);
      }
    });

    return groups;
  };

  // Get grouped questions for selection dropdown
  const questionGroups = groupQuestionsByMetricsType();

  const getMetricsTypeForSelectedSymptom = () => {
    if (!selectedSymptom) return 'mouse';
    
    const question = allQuestions.find(q => q.id === selectedSymptom);
    if (!question) return 'mouse';
    
    return getQuestionMetricsType(question);
  };
  
  // Determine if we should show the correlation chart
  const shouldShowCorrelationChart = () => {
    const metricsType = getMetricsTypeForSelectedSymptom();
    // Only show correlation chart for mouse and keyboard metrics, not for CPT
    return metricsType !== 'cpt' && correlationData !== null;
  };
  
  return (
    <div>
      <div className="admin-header">
        <h2>User Analytics</h2>
        {userId && <p>Viewing data for user: {userId}</p>}
      </div>
      
      <div id="data-content" style={{ display: 'block' }}>
        <ChartControls
          selectedSymptom={selectedSymptom}
          selectedMetric={selectedMetric}
          availableMetrics={availableMetrics}
          questionGroups={questionGroups}
          onSymptomChange={handleSymptomChange}
          onMetricChange={handleMetricChange}
        />
        
        <div className="context-display">
          {selectedSymptom && allQuestions.length > 0 && (() => {
            const question = allQuestions.find(q => q.id === selectedSymptom);
            if (!question) return null;
            
            const questionType = question.type;
            if (questionType === 'text') {
              return <p>Chart visualization is not available for free text inputs. These metrics are best viewed directly in the assessment responses.</p>;
            } else if (questionType === 'cognitive_test') {
              return <p>Viewing cognitive test metrics over time. Select different metrics to see various aspects of test performance.</p>;
            } else {
              const metricsType = getQuestionMetricsType(question);
              return (
                <p>
                  This visualization shows the relationship between reported symptom severity and 
                  <span id="metric-type-indicator"> {metricsType} metrics</span> while answering each specific question.
                </p>
              );
            }
          })()}
        </div>
        
        {isLoading ? (
          <LoadingSpinner message="Loading chart data..." />
        ) : noData ? (
          <NoDataMessage message={errorMessage || "There isn't enough data available for this selection."} />
        ) : (
          <>
            {shouldShowCorrelationChart() && <CorrelationChart data={correlationData} />}
            {timelineData && <TimelineChart data={timelineData} />}
          </>
        )}
        
        <MetricsExplanation 
          metricsType={getMetricsTypeForSelectedSymptom()}
          availableMetrics={availableMetrics}
        />
      </div>
    </div>
  );
};

export default AdminUserCharts;