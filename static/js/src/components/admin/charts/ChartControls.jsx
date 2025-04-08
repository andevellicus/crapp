// src/components/admin/charts/ChartControls.jsx
const ChartControls = ({
  selectedSymptom,
  selectedMetric,
  availableMetrics,
  questionGroups,
  cptMetricsAvailable,
  showCptMetrics,
  onSymptomChange,
  onMetricChange,
  onToggleCptMetrics
}) => {
  return (
    <div className="controls">
      <div className="control-group">
        <label htmlFor="symptom-select">Symptom Question:</label>
        <select 
          id="symptom-select"
          value={selectedSymptom}
          onChange={onSymptomChange}
        >
          {/* Mouse input questions */}
          {questionGroups.mouse.length > 0 && (
            <optgroup label="Mouse Input Questions">
              {questionGroups.mouse.map(question => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </optgroup>
          )}
          
          {/* Keyboard input questions */}
          {questionGroups.keyboard.length > 0 && (
            <optgroup label="Keyboard Input Questions">
              {questionGroups.keyboard.map(question => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </optgroup>
          )}
          
          {/* CPT questions */}
          {questionGroups.cpt.length > 0 && (
            <optgroup label="Cognitive Test Questions">
              {questionGroups.cpt.map(question => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      
      <div className="control-group">
        <label htmlFor="metric-select">Interaction Metric:</label>
        <select 
          id="metric-select"
          value={selectedMetric}
          onChange={onMetricChange}
          disabled={showCptMetrics || availableMetrics.length === 0}
        >
          {availableMetrics.map(metric => (
            <option key={metric.value} value={metric.value}>
              {metric.label}
            </option>
          ))}
        </select>
      </div>
      
      {/* CPT Metrics Toggle */}
      {cptMetricsAvailable && (
        <div className="control-group" style={{ marginLeft: '20px' }}>
          <button 
            className="toggle-cpt-button"
            onClick={onToggleCptMetrics}
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
  );
};

export default ChartControls;