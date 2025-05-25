// src/components/charts/ChartControls.jsx
const ChartControls = ({
    selectedSymptom,
    selectedMetric,
    availableMetrics,
    questionGroups,
    onSymptomChange,
    onMetricChange
  }) => {
    return (
      <div className="controls">
        <div className="control-group">
          <label htmlFor="symptom-select">Symptom Question/Task:</label>
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
              <optgroup label="Continuous Performance Test">
                {questionGroups.cpt.map(question => (
                  <option key={question.id} value={question.id}>
                    {question.title}
                  </option>
                ))}
              </optgroup>
            )}
            {/* Trail Making Test questions */}
            {questionGroups.tmt.length > 0 && (
              <optgroup label="Trail Making Test">
                {questionGroups.tmt.map(question => (
                  <option key={question.id} value={question.id}>
                    {question.title}
                  </option>
                ))}
              </optgroup>
            )}
          {/* Digit Span */}
          {questionGroups.digit_span.length > 0 && (
            <optgroup label="Digit Span Test">
              {questionGroups.digit_span.map(question => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </optgroup>
          )}
          </select>
        </div>
        
        <div className="control-group">
          <label htmlFor="metric-select">Metric:</label>
          <select 
            id="metric-select"
            value={selectedMetric}
            onChange={onMetricChange}
            disabled={availableMetrics.length === 0}
          >
            {availableMetrics.map(metric => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };
  
  export default ChartControls;