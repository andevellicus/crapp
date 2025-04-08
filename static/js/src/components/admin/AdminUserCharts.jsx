// src/components/admin/AdminUserCharts.jsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';
import ChartControls from './charts/ChartControls';
import CorrelationChart from './charts/CorrelationChart';
import TimelineChart from './charts/TimelineChart';
import CPTMetricsDisplay from './charts/CPTMetricsDisplay';
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
  
  // CPT metrics data
  const [cptMetricsAvailable, setCptMetricsAvailable] = useState(false);
  const [cptMetrics, setCptMetrics] = useState(null);
  const [showCptMetrics, setShowCptMetrics] = useState(false);

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
    cpt: []
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
        
        // Check for CPT availability if userId is provided
        if (userId) {
          checkForCptMetrics(userId);
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
  
  // Check for CPT metrics availability
  const checkForCptMetrics = async (userIdToCheck) => {
    try {
      const userIdToUse = userIdToCheck || userId || '';
      
      // Try to fetch CPT metrics
      const cptMetricsResponse = await api.get(`/api/metrics/cpt/results?user_id=${userIdToUse}`);
      
      if (cptMetricsResponse && 
          typeof cptMetricsResponse === 'object' && 
          cptMetricsResponse.test_count && 
          cptMetricsResponse.test_count > 0) {
        
        setCptMetrics({
          test_count: cptMetricsResponse.test_count || 0,
          avg_reaction_time: cptMetricsResponse.avg_reaction_time || 0,
          avg_detection_rate: cptMetricsResponse.avg_detection_rate || 0, 
          avg_omission_rate: cptMetricsResponse.avg_omission_rate || 0,
          avg_commission_rate: cptMetricsResponse.avg_commission_rate || 0
        });
        
        setCptMetricsAvailable(true);
      } else {
        setCptMetricsAvailable(false);
      }
    } catch (error) {
      console.error('Error checking for CPT metrics:', error);
      setCptMetricsAvailable(false);
    }
  };
  
  // Update charts when selections change
  useEffect(() => {
    if (selectedSymptom && selectedMetric) {
      updateCharts();
    }
  }, [selectedSymptom, selectedMetric, userId, showCptMetrics]);
  
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
                                question.type === 'scale';
                                
      setNoData(!isSuitableForChart);
      
      if (!isSuitableForChart) {
        setErrorMessage('This question type does not support chart visualization.');
      }
    }
    
    // Reset CPT view mode when changing symptom
    setShowCptMetrics(false);
  };
  
  // Handle metric selection change
  const handleMetricChange = (e) => {
    setSelectedMetric(e.target.value);
  };
  
  // Toggle between interaction metrics and CPT metrics
  const handleToggleCptMetrics = () => {
    setShowCptMetrics(!showCptMetrics);
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
      
      if (showCptMetrics && cptMetricsAvailable) {
        // If showing CPT metrics, fetch them
        try {
          const response = await api.get(`/api/metrics/cpt/results?user_id=${userIdToUse}`);
          
          if (response && response.test_count && response.test_count > 0) {
            // Ensure we have valid data with all the properties we need
            const validCptMetrics = {
              test_count: response.test_count || 0,
              avg_reaction_time: response.avg_reaction_time || 0,
              avg_detection_rate: response.avg_detection_rate || 0,
              avg_omission_rate: response.avg_omission_rate || 0,
              avg_commission_rate: response.avg_commission_rate || 0
            };
            setCptMetrics(validCptMetrics);
            setNoData(false);
          } else {
            setNoData(true);
          }
        } catch (error) {
          console.error('Error fetching CPT metrics:', error);
          setErrorMessage('Failed to load CPT metrics');
          setNoData(true);
        }
      } else {
        // Find the question
        const question = allQuestions.find(q => q.id === selectedSymptom);
        
        // Check if this question type is suitable for charts
        if (question && (question.type === 'text' || question.type === 'cognitive_test')) {
          setNoData(true);
          setErrorMessage(`Chart visualization not available for ${question.type} questions.`);
          return;
        }
        
        // Fetch pre-formatted data from API endpoints for interaction metrics
        const [correlationResponse, timelineResponse] = await Promise.all([
          api.get(`/api/metrics/chart/correlation?user_id=${userIdToUse}&symptom=${selectedSymptom}&metric=${selectedMetric}`),
          api.get(`/api/metrics/chart/timeline?user_id=${userIdToUse}&symptom=${selectedSymptom}&metric=${selectedMetric}`)
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
      }
    } catch (error) {
      console.error('Error updating charts:', error);
      setErrorMessage(`Failed to load data: ${error.message}`);
      setNoData(true);
    } finally {
      setIsLoading(false);
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
          cptMetricsAvailable={cptMetricsAvailable}
          showCptMetrics={showCptMetrics}
          onSymptomChange={handleSymptomChange}
          onMetricChange={handleMetricChange}
          onToggleCptMetrics={handleToggleCptMetrics}
        />
        
        <div className="context-display">
          {showCptMetrics ? (
            <p>Viewing Continuous Performance Test (CPT) metrics that measure attention and response control.</p>
          ) : selectedSymptom && allQuestions.length > 0 && (() => {
            const question = allQuestions.find(q => q.id === selectedSymptom);
            if (!question) return null;
            
            const questionType = question.type;
            if (questionType === 'text') {
              return <p>Chart visualization is not available for free text inputs. These metrics are best viewed directly in the assessment responses.</p>;
            } else if (questionType === 'cognitive_test') {
              return <p>This is a cognitive test question. Please use the CPT metrics view to see results.</p>;
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
            {showCptMetrics && cptMetricsAvailable && cptMetrics ? (
              <CPTMetricsDisplay metrics={cptMetrics} />
            ) : (
              <>
                {correlationData && <CorrelationChart data={correlationData} />}
                {timelineData && <TimelineChart data={timelineData} />}
              </>
            )}
          </>
        )}
        
        <MetricsExplanation 
          showCptMetrics={showCptMetrics} 
          metricsType={getMetricsTypeForSelectedSymptom()}
          availableMetrics={availableMetrics}
        />
      </div>
    </div>
  );
};

export default AdminUserCharts;