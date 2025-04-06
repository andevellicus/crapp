package metrics

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

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
	// Global metrics (for entire assessment)
	GlobalMetrics []models.AssessmentMetric

	// Per-question metrics
	QuestionMetrics []models.AssessmentMetric

	// CPT metrics if available
	CPTResult *models.CPTResult
}

// NewMetricCalculator creates a new metric calculator
func NewMetricCalculator(interactions *InteractionData, cpt *CPTData) *MetricCalculator {
	return &MetricCalculator{
		InteractionData: interactions,
		CPTData:         cpt,
	}
}

// CalculateAllMetrics calculates all interaction metrics
func (mc *MetricCalculator) CalculateMetrics() *CalculatedMetrics {
	result := &CalculatedMetrics{
		GlobalMetrics:   []models.AssessmentMetric{},
		QuestionMetrics: []models.AssessmentMetric{},
	}

	// Get global mouse metrics
	globalMetrics := map[string]MetricResult{
		"click_precision":      mc.calculateClickPrecision(nil),
		"path_efficiency":      mc.calculatePathEfficiency(nil),
		"overshoot_rate":       mc.calculateOvershootRate(nil),
		"average_velocity":     mc.calculateAverageVelocity(nil),
		"velocity_variability": mc.calculateVelocityVariability(nil),
	}

	// Add keyboard metrics
	keyboardMetrics := mc.calculateKeyboardMetrics(nil)
	for k, v := range keyboardMetrics {
		globalMetrics[k] = v
	}

	// Convert global metrics to AssessmentMetric models
	for metricKey, metricResult := range globalMetrics {
		if metricResult.Calculated {
			result.GlobalMetrics = append(result.GlobalMetrics, models.AssessmentMetric{
				QuestionID:  "global",
				MetricKey:   metricKey,
				MetricValue: metricResult.Value,
				SampleSize:  metricResult.SampleSize,
				CreatedAt:   time.Now(),
			})
		}
	}

	// Calculate per-question metrics
	questionMetricsMap := mc.calculatePerQuestionMetrics()

	// Convert question metrics to AssessmentMetric models
	for questionID, metricsMap := range questionMetricsMap {
		for metricKey, metricResult := range metricsMap {
			if metricResult.Calculated {
				result.QuestionMetrics = append(result.QuestionMetrics, models.AssessmentMetric{
					QuestionID:  questionID,
					MetricKey:   metricKey,
					MetricValue: metricResult.Value,
					SampleSize:  metricResult.SampleSize,
					CreatedAt:   time.Now(),
				})
			}
		}
	}

	// If CPT data is available, calculate those metrics too
	if mc.CPTData != nil {
		// Create CPT result model with all fields properly populated
		cptResult := &models.CPTResult{
			// These fields will be set by the handler
			// UserEmail, DeviceID, AssessmentID

			// Time fields
			TestStartTime: time.Unix(0, int64(mc.CPTData.TestStartTime)*int64(time.Millisecond)),
			TestEndTime:   time.Unix(0, int64(mc.CPTData.TestEndTime)*int64(time.Millisecond)),

			// Performance metrics
			CorrectDetections:   mc.countCorrectDetections(),
			CommissionErrors:    mc.countCommissionErrors(),
			OmissionErrors:      mc.countOmissionErrors(),
			AverageReactionTime: mc.calculateAverageReactionTime(),
			ReactionTimeSD:      mc.calculateReactionTimeSD(),
			DetectionRate:       mc.calculateDetectionRate(),
			OmissionErrorRate:   mc.calculateOmissionErrorRate(),
			CommissionErrorRate: mc.calculateCommissionErrorRate(),

			// Store the raw data for future analysis
			RawData:   mc.serializeCPTData(),
			CreatedAt: time.Now(),
			TestType:  models.CPTest,
		}

		result.CPTResult = cptResult
	}

	return result
}
