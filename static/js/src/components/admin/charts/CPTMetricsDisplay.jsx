// src/components/admin/charts/CPTMetricsDisplay.jsx
const CPTMetricsDisplay = ({ metrics }) => {
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
      <h3>CPT Performance Metrics</h3>
      <p>Based on {metrics.test_count} test(s)</p>
      
      <div className="cpt-metrics-grid">
        {renderMetricCard('Average Reaction Time', metrics.avg_reaction_time, 'ms')}
        {renderMetricCard('Detection Rate', metrics.avg_detection_rate, '', 'percent')}
        {renderMetricCard('Omission Error Rate', metrics.avg_omission_rate, '', 'percent')}
        {renderMetricCard('Commission Error Rate', metrics.avg_commission_rate, '', 'percent')}
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
  );
};

export default CPTMetricsDisplay;