package models

import (
	"encoding/json"
	"time"
)

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

// AssessmentSubmission is used for incoming API requests
type AssessmentSubmission struct {
	UserEmail string          `json:"user_email"`
	DeviceID  string          `json:"device_id"`
	Responses JSON            `json:"responses"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
}

// MetricResult represents a calculated metric with status and metadata
// This is used for the calculation result but not stored directly
type MetricResult struct {
	Value      float64 `json:"value"`
	Calculated bool    `json:"calculated"`
	SampleSize int     `json:"sampleSize,omitempty"`
}
