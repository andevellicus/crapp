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
  
  // Load symptom questions from API
  useEffect(() => {
    const loadSymptomQuestions = async () => {
      try {
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
  
  // Update charts when selections change
  useEffect(() => {
    if (selectedSymptom && selectedMetric && !isLoading) {
      updateCharts();
    }
  }, [selectedSymptom, selectedMetric, userId, isLoading]);
  
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
    }
  };
  
  // Handle metric selection change
  const handleMetricChange = (e) => {
    setSelectedMetric(e.target.value);
  };
  
  // Update charts with selected data
  const updateCharts = async () => {
    if (!selectedSymptom || !selectedMetric) return;
    
    try {
      setIsLoading(true);
      setNoData(false);
      setErrorMessage('');
      
      const userIdToUse = userId || '';
      
      // Fetch pre-formatted data from API endpoints
      const [correlationResponse, timelineResponse] = await Promise.all([
        api.get(`/api/metrics/chart/correlation?user_id=${userIdToUse}&symptom=${selectedSymptom}&metric=${selectedMetric}`),
        api.get(`/api/metrics/chart/timeline?user_id=${userIdToUse}&symptom=${selectedSymptom}&metric=${selectedMetric}`)
      ]);
      
      // Store the data in state
      setCorrelationData(correlationResponse);
      setTimelineData(timelineResponse);
      
      // Check if we have data
      const hasCorrelationData = correlationResponse.data && 
                              correlationResponse.data.datasets && 
                              correlationResponse.data.datasets.length > 0 &&
                              correlationResponse.data.datasets[0].data?.length > 0;
                              
      const hasTimelineData = timelineResponse.data && 
                           timelineResponse.data.datasets && 
                           timelineResponse.data.datasets.length > 0 &&
                           timelineResponse.data.labels?.length > 0;
      
      setNoData(!hasCorrelationData && !hasTimelineData);
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error updating charts:', error);
      setErrorMessage(`Failed to load data: ${error.message}`);
      setIsLoading(false);
      setNoData(true);
    }
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
        </div>
        
        <div className="context-display">
          <p>This visualization shows the relationship between reported symptom severity and interaction metrics while answering each specific question.</p>
          <p><span id="metric-type-indicator">{metricType === 'keyboard' ? 'Keyboard' : 'Mouse'} metrics</span> are shown for the selected question type.</p>
        </div>
        
        {isLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading chart data...</p>
          </div>
        ) : noData ? (
          <div id="no-data" className="no-data">
            <h3>No Data Available</h3>
            <p>{errorMessage || "There isn't enough data available for this symptom and metric combination."}</p>
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
        
        <div className="metrics-help">
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
        </div>
      </div>
    </div>
  );
};

export default AdminUserCharts;