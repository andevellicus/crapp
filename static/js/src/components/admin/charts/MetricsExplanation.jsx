// src/components/admin/charts/MetricsExplanation.jsx
const MetricsExplanation = ({ metricsType, selectedMetric }) => { 
  if (metricsType === 'cpt') {
      return (
      <div className="metrics-help">
          <h3>Understanding CPT Timeline Chart</h3>
          <p>The Continuous Performance Test (CPT) timeline shows how cognitive performance changes over time. Each data point represents a completed test.</p>
          <ul>
          <li><strong>Reaction Time (ms):</strong> Average time to respond to target stimuli. Lower values indicate faster processing speed.</li>
          <li><strong>Detection Rate (%):</strong> Percentage of correct responses to targets. Higher values indicate better sustained attention.</li>
          <li><strong>Omission Error Rate (%):</strong> Percentage of missed targets. Higher values suggest inattention or distractibility.</li>
          <li><strong>Commission Error Rate (%):</strong> Percentage of responses to non-targets. Higher values suggest impulsivity or poor inhibitory control.</li>
          </ul>
      </div>
      );
  } else if (metricsType === 'keyboard') {
      return (
      <div className="metrics-help">
          <h3>Understanding Keyboard Metrics</h3>
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
      );
  } else {
      // Default is mouse metrics
      return (
      <div className="metrics-help">
          <h3>Understanding Mouse Metrics</h3>
          <ul>
            <li><strong>Click Precision:</strong> How accurately the user clicks on targets (higher is better)</li>
            <li><strong>Path Efficiency:</strong> How directly the mouse moves to targets (higher is better)</li>
            <li><strong>Overshoot Rate:</strong> How often the user overshoots targets (lower is better)</li>
            <li><strong>Average Velocity:</strong> How quickly the mouse moves (can indicate focus or cognitive load)</li>
            <li><strong>Velocity Variability:</strong> How consistent the mouse movement speed is (lower can indicate better motor control)</li>
          </ul>
      </div>
      );
  }
};

export default MetricsExplanation;