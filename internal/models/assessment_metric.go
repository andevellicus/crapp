package models

import (
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
