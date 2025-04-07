import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Chart as ChartJS, 
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import api from '../../services/api';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ScatterController
);

const AdminUserCharts = () => {
  const location = useLocation();
  const userId = new URLSearchParams(location.search).get('user_id');
  
  const [symptomQuestions, setSymptomQuestions] = useState([]);
  const [mouseQuestions, setMouseQuestions] = useState([]);
  const [keyboardQuestions, setKeyboardQuestions] = useState([]);
  const [selectedSymptom, setSelectedSymptom] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('');
  const [metricType, setMetricType] = useState('mouse');
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
  
  // Metric definitions
  const mouseMetrics = [
    { value: 'click_precision', label: 'Click Precision' },
    { value: 'path_efficiency', label: 'Path Efficiency' },
    { value: 'overshoot_rate', label: 'Overshoot Rate' },
    { value: 'average_velocity', label: 'Average Velocity' },
    { value: 'velocity_variability', label: 'Velocity Variability' }
  ];
  
  const keyboardMetrics = [
    { value: 'typing_speed', label: 'Typing Speed' },
    { value: 'average_inter_key_interval', label: 'Inter-Key Interval' },
    { value: 'typing_rhythm_variability', label: 'Typing Rhythm Variability' },
    { value: 'average_key_hold_time', label: 'Key Hold Time' },
    { value: 'key_press_variability', label: 'Key Press Variability' },
    { value: 'correction_rate', label: 'Correction Rate' },
    { value: 'pause_rate', label: 'Pause Rate' }
  ];
  
  // Split the effects to avoid conflicting state updates
  // 1. Load symptom questions
  useEffect(() => {
    const loadSymptomQuestions = async () => {
      try {
        setIsLoading(true);
        const questions = await api.get('/api/questions');
        
        // Group questions by input type
        const mouseQs = questions.filter(q => q.metrics_type === 'mouse' || q.type === 'radio' || q.type === 'dropdown');
        const keyboardQs = questions.filter(q => q.metrics_type === 'keyboard' || q.type === 'text');
        
        setMouseQuestions(mouseQs);
        setKeyboardQuestions(keyboardQs);
        setSymptomQuestions([...mouseQs, ...keyboardQs]);
        
        // Set default selections
        if (mouseQs.length > 0) {
          setSelectedSymptom(mouseQs[0].id);
          setSelectedMetric(mouseMetrics[0].value);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load question definitions:', error);
        setErrorMessage('Failed to load question definitions.');
        setIsLoading(false);
      }
    };
    
    loadSymptomQuestions();
  }, []);
  
  // 2. Check for CPT metrics in a separate effect after questions are loaded
  useEffect(() => {
    // Only run this effect when userId changes and questions are loaded
    if (symptomQuestions.length > 0 && userId) {
      checkForCptMetrics(userId);
    }
  }, [userId, symptomQuestions.length]);
  
  // Update charts when selections change
  useEffect(() => {
    if (selectedSymptom && selectedMetric) {
      updateCharts();
    }
  }, [selectedSymptom, selectedMetric, userId, showCptMetrics]); // removed isLoading from dependencies
  
  // Check for CPT metrics availability - only run once during initial load
  const checkForCptMetrics = async (userIdToCheck) => {
    try {
      const userIdToUse = userIdToCheck || userId || '';
      
      // Try to fetch CPT metrics
      const cptMetricsResponse = await api.get(`/api/cognitive-tests/cpt/metrics?user_id=${userIdToUse}`);
      
      if (cptMetricsResponse && 
          typeof cptMetricsResponse === 'object' && 
          cptMetricsResponse.test_count && 
          cptMetricsResponse.test_count > 0) {
        // Set both states in a single update cycle to avoid multiple renders
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
  
  // Handle symptom selection change
  const handleSymptomChange = (e) => {
    const symptomId = e.target.value;
    setSelectedSymptom(symptomId);
    
    // Find the question
    const question = symptomQuestions.find(q => q.id === symptomId);
    
    // Update metric type and reset selected metric
    if (question) {
      const newMetricType = question.metrics_type === 'keyboard' || question.type === 'text' 
        ? 'keyboard' 
        : 'mouse';
      
      setMetricType(newMetricType);
      
      // Set default metric
      if (newMetricType === 'keyboard' && keyboardMetrics.length > 0) {
        setSelectedMetric(keyboardMetrics[0].value);
      } else if (newMetricType === 'mouse' && mouseMetrics.length > 0) {
        setSelectedMetric(mouseMetrics[0].value);
      }
      
      // Skip certain question types for charts (e.g., free text emotional events)
      if (question.id === 'emotional_events' || (question.type === 'text' && !question.required)) {
        setNoData(true);
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
  const toggleCptMetrics = () => {
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
        // If showing CPT metrics, fetch them (we've already checked availability)
        try {
          const response = await api.get(`/api/cognitive-tests/cpt/metrics?user_id=${userIdToUse}`);
          
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
      } else if (selectedSymptom === 'emotional_events' || selectedSymptom === 'medication_changes') {
        // Don't try to show correlation or timeline charts for free text inputs
        setNoData(true);
        setErrorMessage('Chart visualization not available for free text inputs.');
      } else {
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
  
  // Remove the redundant fetchCptMetrics function since this logic is now in updateCharts
  
  // Render CPT metrics card
  const renderCptMetricCard = (label, value, unit = '', format = 'decimal') => {
    let displayValue = value;
    
    if (format === 'decimal' && typeof value === 'number') {
      displayValue = value.toFixed(2);
    } else if (format === 'percent' && typeof value === 'number') {
      displayValue = (value * 100).toFixed(1) + '%';
    } else if (format === 'integer' && typeof value === 'number') {
      displayValue = Math.round(value);
    }
    
    return (
      <div className="cpt-metric-card">
        <h4>{label}</h4>
        <div className="cpt-metric-value">
          {displayValue}
          {unit && <span className="cpt-metric-unit">{unit}</span>}
        </div>
      </div>
    );
  };
  
  return (
    <div>
      <div className="admin-header">
        <h2>User Analytics</h2>
        {userId && <p>Viewing data for user: {userId}</p>}
      </div>
      
      <div id="data-content" style={{ display: 'block' }}>
        <div className="controls">
          <div className="control-group">
            <label htmlFor="symptom-select">Symptom Question:</label>
            <select 
              id="symptom-select"
              value={selectedSymptom}
              onChange={handleSymptomChange}
            >
              <optgroup label="Mouse Input Questions">
                {mouseQuestions.map(question => (
                  <option key={question.id} value={question.id}>
                    {question.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Keyboard Input Questions">
                {keyboardQuestions.map(question => (
                  <option key={question.id} value={question.id}>
                    {question.title}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          
          <div className="control-group">
            <label htmlFor="metric-select">Interaction Metric:</label>
            <select 
              id="metric-select"
              value={selectedMetric}
              onChange={handleMetricChange}
              disabled={showCptMetrics}
            >
              {metricType === 'keyboard' ? (
                keyboardMetrics.map(metric => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))
              ) : (
                mouseMetrics.map(metric => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {/* CPT Metrics Toggle */}
          {cptMetricsAvailable && (
            <div className="control-group" style={{ marginLeft: '20px' }}>
              <button 
                className="toggle-cpt-button"
                onClick={toggleCptMetrics}
                style={{
                  backgroundColor: showCptMetrics ? '#4a6fa5' : '#f5f5f5',
                  color: showCptMetrics ? 'white' : '#333',
                  border: '1px solid #ddd',
                  padding: '8px 15px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {showCptMetrics ? 'Show Interaction Metrics' : 'Show CPT Metrics'}
              </button>
            </div>
          )}
        </div>
        
        <div className="context-display">
          {showCptMetrics ? (
            <p>Viewing Continuous Performance Test (CPT) metrics that measure attention and response control.</p>
          ) : selectedSymptom === 'emotional_events' || selectedSymptom === 'medication_changes' ? (
            <p>Chart visualization is not available for free text inputs. These metrics are best viewed directly in the assessment responses.</p>
          ) : (
            <p>This visualization shows the relationship between reported symptom severity and interaction metrics while answering each specific question.</p>
          )}
          {!showCptMetrics && metricType === 'mouse' && (
            <p><span id="metric-type-indicator">Mouse metrics</span> are shown for the selected question type.</p>
          )}
          {!showCptMetrics && metricType === 'keyboard' && !(selectedSymptom === 'emotional_events' || selectedSymptom === 'medication_changes') && (
            <p><span id="metric-type-indicator">Keyboard metrics</span> are shown for the selected question type.</p>
          )}
        </div>
        
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading chart data...</p>
          </div>
        ) : noData ? (
          <div id="no-data" className="no-data">
            <h3>No Data Available</h3>
            <p>{errorMessage || "There isn't enough data available for this selection."}</p>
          </div>
        ) : (
          <>
            {showCptMetrics && cptMetricsAvailable && cptMetrics ? (
              <div className="cpt-metrics-container">
                <h3>CPT Performance Metrics</h3>
                <p>Based on {cptMetrics.test_count} test(s)</p>
                
                <div className="cpt-metrics-grid">
                  {renderCptMetricCard('Average Reaction Time', cptMetrics.avg_reaction_time, 'ms')}
                  {renderCptMetricCard('Detection Rate', cptMetrics.avg_detection_rate, '', 'percent')}
                  {renderCptMetricCard('Omission Error Rate', cptMetrics.avg_omission_rate, '', 'percent')}
                  {renderCptMetricCard('Commission Error Rate', cptMetrics.avg_commission_rate, '', 'percent')}
                </div>
                
                <div className="cpt-metrics-explanation">
                  <h4>What These Metrics Mean</h4>
                  <ul>
                    <li><strong>Reaction Time:</strong> Average time to respond to target stimuli (lower is better)</li>
                    <li><strong>Detection Rate:</strong> Percentage of correct responses to targets (higher is better)</li>
                    <li><strong>Omission Error Rate:</strong> Rate of missing targets (lower is better)</li>
                    <li><strong>Commission Error Rate:</strong> Rate of responding to non-targets (lower is better)</li>
                  </ul>
                </div>
              </div>
            ) : metricType === 'keyboard' && (selectedSymptom === 'emotional_events' || selectedSymptom === 'medication_changes') ? (
              <div className="no-data" style={{ backgroundColor: '#f0f5ff', borderColor: '#4a6fa5' }}>
                <h3>Text Input Analysis</h3>
                <p>Chart visualization is not available for free text inputs.</p>
                <p>Keyboard metrics for text inputs are best analyzed in the context of the specific responses.</p>
              </div>
            ) : (
              <>
                {correlationData && (
                  <div className="chart-container">
                    <Scatter 
                      data={correlationData.data}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          title: {
                            display: true,
                            text: correlationData.title
                          }
                        },
                        scales: {
                          x: {
                            title: {
                              display: true,
                              text: correlationData.xLabel
                            }
                          },
                          y: {
                            title: {
                              display: true,
                              text: correlationData.yLabel
                            }
                          }
                        }
                      }}
                    />
                  </div>
                )}
                
                {timelineData && (
                  <div className="chart-container">
                    <Line 
                      data={timelineData.data}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          title: {
                            display: true,
                            text: timelineData.title
                          }
                        },
                        scales: {
                          y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                              display: true,
                              text: timelineData.yLabel
                            }
                          },
                          y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                              display: true,
                              text: timelineData.y2Label
                            },
                            grid: {
                              drawOnChartArea: false
                            }
                          }
                        }
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        <div className="metrics-help">
          {showCptMetrics ? (
            <>
              <h3>Understanding CPT Metrics</h3>
              <p>The Continuous Performance Test (CPT) is a neuropsychological test that measures sustained attention and impulsivity.</p>
              <ul>
                <li><strong>Reaction Time:</strong> Measures processing speed and attention.</li>
                <li><strong>Detection Rate:</strong> Measures ability to correctly identify targets.</li>
                <li><strong>Omission Errors:</strong> Missing targets suggests inattention or distractibility.</li>
                <li><strong>Commission Errors:</strong> Responding to non-targets suggests impulsivity or poor inhibitory control.</li>
              </ul>
            </>
          ) : (
            <>
              <h3>Understanding Interaction Metrics</h3>
              
              <div id="mouse-metrics-help" style={{ display: metricType === 'mouse' ? 'block' : 'none' }}>
                <h4>Mouse Metrics</h4>
                <ul>
                  <li><strong>Click Precision:</strong> How accurately the user clicks on targets (higher is better)</li>
                  <li><strong>Path Efficiency:</strong> How directly the mouse moves to targets (higher is better)</li>
                  <li><strong>Overshoot Rate:</strong> How often the user overshoots targets (lower is better)</li>
                  <li><strong>Average Velocity:</strong> How quickly the mouse moves (can indicate focus or cognitive load)</li>
                  <li><strong>Velocity Variability:</strong> How consistent the mouse movement speed is (lower can indicate better motor control)</li>
                </ul>
              </div>
              
              <div id="keyboard-metrics-help" style={{ display: metricType === 'keyboard' ? 'block' : 'none' }}>
                <h4>Keyboard Metrics</h4>
                <ul>
                  <li><strong>Typing Speed:</strong> Characters per second typed (higher indicates faster typing)</li>
                  <li><strong>Inter-Key Interval:</strong> Average time between keypresses in milliseconds (lower indicates faster typing)</li>
                  <li><strong>Typing Rhythm Variability:</strong> Consistency of typing rhythm (lower indicates more consistent typing)</li>
                  <li><strong>Key Hold Time:</strong> Average time each key is held down (can indicate motor control)</li>
                  <li><strong>Key Press Variability:</strong> Consistency of key press durations (lower is more consistent)</li>
                  <li><strong>Correction Rate:</strong> Frequency of backspace/delete usage (indicates error correction)</li>
                  <li><strong>Pause Rate:</strong> Frequency of pauses while typing (can indicate cognitive processing)</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserCharts;