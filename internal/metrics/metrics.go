package metrics

import "github.com/andevellicus/crapp/internal/models"

// MetricCalculator calculates interaction metrics from raw data
type MetricCalculator struct {
	InteractionData *InteractionData
	CPTData         *CPTData
}

// MetricResult represents a calculated metric with status and metadata
type MetricResult struct {
	Value      float64 `json:"value"`
	Calculated bool    `json:"calculated"`
	SampleSize int     `json:"sampleSize,omitempty"`
}

type CalculatedMetrics struct {
	GlobalInteractionMetrics models.AssessmentMetric            `json:"globalInteractionMetrics"`
	QuestionMetrics          map[string]models.AssessmentMetric `json:"questionMetrics"`
	CPTMetrics               models.CPTResult                   `json:"cptMetrics"`
}

// NewMetricCalculator creates a new metric calculator
func NewMetricCalculator(interactions *InteractionData, cpt *CPTData) *MetricCalculator {
	return &MetricCalculator{
		InteractionData: interactions,
		CPTData:         cpt,
	}
}

// CalculateAllMetrics calculates all interaction metrics
func (mc *MetricCalculator) CalculateMetrics() map[string]any {
	metrics := make(map[string]any)

	// Global mouse metrics
	metrics["click_precision"] = mc.calculateClickPrecision(nil)
	metrics["path_efficiency"] = mc.calculatePathEfficiency(nil)
	metrics["overshoot_rate"] = mc.calculateOvershootRate(nil)
	metrics["average_velocity"] = mc.calculateAverageVelocity(nil)
	metrics["velocity_variability"] = mc.calculateVelocityVariability(nil)

	// Add keyboard metrics
	keyboardMetrics := mc.calculateKeyboardMetrics(nil)
	for k, v := range keyboardMetrics {
		metrics[k] = v
	}

	// Per-question metrics
	questionMetrics := mc.calculatePerQuestionMetrics()
	metrics["questionMetrics"] = questionMetrics

	return metrics
}
