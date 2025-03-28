package models

import (
	"encoding/json"
	"time"
)

// AssessmentMetric represents an indexed metric for efficient querying
type AssessmentMetric struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	AssessmentID uint      `json:"assessment_id" gorm:"index"`
	QuestionID   string    `json:"question_id" gorm:"index"`
	MetricKey    string    `json:"metric_key" gorm:"index"`
	MetricValue  float64   `json:"metric_value"`
	SampleSize   int       `json:"sample_size"`
	CreatedAt    time.Time `json:"created_at"`

	// Relationships
	Assessment Assessment `json:"-" gorm:"foreignKey:AssessmentID"`
}

// MetricResult represents a calculated metric with status and metadata
// This is used for the calculation result but not stored directly
type MetricResult struct {
	Value      float64 `json:"value"`
	Calculated bool    `json:"calculated"`
	SampleSize int     `json:"sampleSize,omitempty"`
}

// ToAssessmentMetric converts a MetricResult to an AssessmentMetric
func (m MetricResult) ToAssessmentMetric(assessmentID uint, questionID, metricKey string) *AssessmentMetric {
	if !m.Calculated {
		return nil
	}

	return &AssessmentMetric{
		AssessmentID: assessmentID,
		QuestionID:   questionID,
		MetricKey:    metricKey,
		MetricValue:  m.Value,
		SampleSize:   m.SampleSize,
		CreatedAt:    time.Now(),
	}
}

// Assessment represents a submitted symptom assessment
type Assessment struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	UserEmail   string    `json:"user_email" gorm:"index"`
	DeviceID    string    `json:"device_id" gorm:"index"`
	Date        time.Time `json:"date" gorm:"default:CURRENT_TIMESTAMP"`
	SubmittedAt time.Time `json:"submitted_at" gorm:"default:CURRENT_TIMESTAMP"`

	// Responses (stored as JSON)
	Responses JSON `json:"responses" gorm:"type:text"`

	// All metrics stored as JSON
	Metrics JSON `json:"metrics,omitempty" gorm:"type:text"`

	// Per-question metrics (stored as JSON)
	QuestionMetrics JSON `json:"question_metrics,omitempty" gorm:"type:text"`

	// Metadata
	RawData JSON `json:"raw_data,omitempty" gorm:"type:text"`
}

// AssessmentSubmission is used for incoming API requests
type AssessmentSubmission struct {
	UserEmail string          `json:"user_email"`
	DeviceID  string          `json:"device_id"`
	Responses JSON            `json:"responses"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// AssessmentSummary is used for API responses
type AssessmentSummary struct {
	ID                 uint      `json:"id"`
	Date               time.Time `json:"date"`
	Responses          JSON      `json:"responses"`
	InteractionMetrics struct {
		ClickPrecision      *float64 `json:"click_precision,omitempty"`
		PathEfficiency      *float64 `json:"path_efficiency,omitempty"`
		OvershootRate       *float64 `json:"overshoot_rate,omitempty"`
		AverageVelocity     *float64 `json:"average_velocity,omitempty"`
		VelocityVariability *float64 `json:"velocity_variability,omitempty"`
	} `json:"interaction_metrics"`
	QuestionMetrics JSON `json:"question_metrics,omitempty"`
	RawData         JSON `json:"raw_data,omitempty"`
}
