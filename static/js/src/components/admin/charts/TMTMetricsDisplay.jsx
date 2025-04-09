// src/components/admin/charts/TrailMetricsDisplay.jsx
const TrailMetricsDisplay = ({ metrics }) => {
    const renderMetricCard = (label, value, unit = '', format = 'decimal') => {
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
      <div className="cpt-metrics-container">
        <h3>Trail Making Test Performance Metrics</h3>
        <p>Based on {metrics.test_count} test(s)</p>
        
        <div className="cpt-metrics-grid">
          {renderMetricCard('Part A Completion Time', metrics.avg_part_a_time, 'ms')}
          {renderMetricCard('Part A Errors', metrics.avg_part_a_errors, '', 'integer')}
          {renderMetricCard('Part B Completion Time', metrics.avg_part_b_time, 'ms')}
          {renderMetricCard('Part B Errors', metrics.avg_part_b_errors, '', 'integer')}
          {renderMetricCard('B/A Ratio', metrics.avg_b_to_a_ratio)}
        </div>
        
        <div className="cpt-metrics-explanation">
          <h4>What These Metrics Mean</h4>
          <ul>
            <li><strong>Part A Completion Time:</strong> Time to connect numbers in sequence (lower is better)</li>
            <li><strong>Part B Completion Time:</strong> Time to connect alternating numbers and letters (lower is better)</li>
            <li><strong>Errors:</strong> Number of incorrect connections made during the test</li>
            <li><strong>B/A Ratio:</strong> Ratio of Part B to Part A completion times (closer to 1 is better)</li>
          </ul>
        </div>
      </div>
    );
  };
  
  export default TrailMetricsDisplay;